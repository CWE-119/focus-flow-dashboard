const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const { promisify } = require('node:util');
const express = require('express');
const { openDatabase, fail, handler, localOnly, textValue } = require('./db-utils.cjs');
const { localSecrets } = require('./local-secrets.cjs');

const TABLES = ['categories', 'folders', 'notes', 'todos', 'history', 'sessions', 'reminders', 'drawings', 'annotations', 'deadlines', 'glossary_terms', 'note_versions', 'note_links', 'note_mentions', 'workspaces', 'workspace_notes', 'workspace_deadlines', 'workspace_sessions', 'readings', 'study_steps', 'flashcards', 'card_reviews'];
const MAX_BYTES = 32 * 1024 * 1024;
const scrypt = promisify(crypto.scrypt);
const hash = (snapshot) => crypto.createHash('sha256').update(JSON.stringify(snapshot.tables)).digest('hex');

async function seal(snapshot, passphrase) {
  const salt = crypto.randomBytes(16);
  const nonce = crypto.randomBytes(12);
  const key = await scrypt(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(snapshot)));
  const data = Buffer.concat([cipher.update(compressed), cipher.final()]);
  return JSON.stringify({ format: 'focusflow-encrypted-v1', salt: salt.toString('base64'), nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
}

async function unseal(raw, passphrase) {
  try {
    if (Buffer.byteLength(raw) > MAX_BYTES) fail('Backup exceeds the 32 MB limit.');
    const envelope = JSON.parse(raw);
    if (envelope.format !== 'focusflow-encrypted-v1') throw new Error();
    const salt = Buffer.from(envelope.salt, 'base64');
    const nonce = Buffer.from(envelope.nonce, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    if (salt.length !== 16 || nonce.length !== 12 || tag.length !== 16) throw new Error();
    const key = await scrypt(passphrase, salt, 32);
    const cipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    cipher.setAuthTag(tag);
    const decrypted = Buffer.concat([cipher.update(Buffer.from(envelope.data, 'base64')), cipher.final()]);
    return JSON.parse(zlib.gunzipSync(decrypted, { maxOutputLength: 128 * 1024 * 1024 }).toString('utf8'));
  } catch { fail('Could not decrypt backup. Check your passphrase and file integrity.'); }
}

async function githubRequest(endpoint, token, options = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options, redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'FocusFlow', 'Content-Type': 'application/json', ...options.headers },
  });
  if (response.status === 404 && options.allowMissing) return null;
  if (response.status === 409 || response.status === 422) fail('GitHub changed during sync. Run sync again to review the latest version.', 409);
  if (!response.ok) fail(`GitHub returned HTTP ${response.status}. Check repository access and token permissions.`, 502);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES * 2) { await reader.cancel(); fail('Remote backup is too large.'); }
    chunks.push(Buffer.from(value));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return options.raw ? raw : JSON.parse(raw);
}

function createContinuityService(filename, request = githubRequest) {
  const database = openDatabase(filename);
  const vault = localSecrets(filename);
  const directory = `${filename}.backups`;
  let queue = database.exec(`PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS continuity_settings (id INTEGER PRIMARY KEY CHECK (id = 1), config TEXT NOT NULL, secrets TEXT NOT NULL, baseHash TEXT, lastSyncAt TEXT, lastBackupAt TEXT, lastError TEXT);`);
  const serial = (operation) => { const result = queue.then(operation); queue = result.catch(() => {}); return result; };
  const config = async () => {
    const [row] = await database.all('SELECT * FROM continuity_settings WHERE id = 1');
    return row ? { ...row, config: JSON.parse(row.config) } : null;
  };
  const snapshot = async () => {
    const tables = {};
    await database.run('BEGIN');
    try {
      for (const table of TABLES) {
        const columns = await database.all(`PRAGMA table_info("${table}")`);
        if (!columns.length) fail(`Missing table ${table}; update FocusFlow before syncing.`);
        const primary = columns.filter((column) => column.pk).sort((first, second) => first.pk - second.pk).map((column) => `"${column.name}"`).join(', ');
        tables[table] = await database.all(`SELECT * FROM "${table}" ORDER BY ${primary || 'rowid'}`);
      }
      await database.run('COMMIT');
    } catch (error) { await database.run('ROLLBACK'); throw error; }
    return { format: 'focusflow-snapshot-v1', createdAt: new Date().toISOString(), tables };
  };
  const validate = async (value) => {
    if (value?.format !== 'focusflow-snapshot-v1' || !value.tables || Object.keys(value.tables).length !== TABLES.length) fail('Unsupported or incomplete workspace backup.');
    for (const table of TABLES) {
      if (!Array.isArray(value.tables[table]) || value.tables[table].length > 500000) fail(`Invalid ${table} backup.`);
      const columns = (await database.all(`PRAGMA table_info("${table}")`)).map((column) => column.name);
      for (const row of value.tables[table]) {
        if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).length !== columns.length || columns.some((column) => !Object.hasOwn(row, column)) ||
          Object.values(row).some((entry) => entry !== null && !['string', 'number'].includes(typeof entry))) fail(`Incompatible ${table} columns. Use the same app version on both devices.`);
      }
    }
    const temporary = openDatabase(':memory:');
    try {
      await temporary.exec('PRAGMA foreign_keys = ON; BEGIN; PRAGMA defer_foreign_keys = ON;');
      for (const table of TABLES) {
        const [schema] = await database.all('SELECT sql FROM sqlite_master WHERE type = ? AND name = ?', ['table', table]);
        await temporary.exec(schema.sql);
      }
      for (const table of TABLES) {
        for (const row of value.tables[table]) {
          const columns = Object.keys(row);
          await temporary.run(`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, Object.values(row));
        }
      }
      if ((await temporary.all('PRAGMA foreign_key_check')).length) fail('Backup contains broken references.');
      await temporary.run('COMMIT');
    } finally { await temporary.close(); }
    return value;
  };
  const writeBackup = async (value, reason) => {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const name = `${Date.now()}-${crypto.randomUUID()}-${reason}.json`;
    const temporary = path.join(directory, `${name}.tmp`);
    await fs.writeFile(temporary, vault.encrypt(value), { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, path.join(directory, name));
    const names = (await fs.readdir(directory)).filter((entry) => entry.endsWith('-auto.json')).sort().reverse();
    for (const expired of names.slice(30)) await fs.unlink(path.join(directory, expired));
    await database.run('UPDATE continuity_settings SET lastBackupAt = ? WHERE id = 1', [new Date().toISOString()]);
    return name;
  };
  const restore = async (value, expectedHash) => {
    await validate(value);
    const current = await snapshot();
    if (expectedHash && hash(current) !== expectedHash) fail('Local data changed during restore. Preview it again.', 409);
    const backup = await writeBackup(current, 'before-restore');
    await database.run('BEGIN IMMEDIATE');
    try {
      const lockedTables = {};
      for (const table of TABLES) {
        const columns = await database.all(`PRAGMA table_info("${table}")`);
        const primary = columns.filter((column) => column.pk).sort((first, second) => first.pk - second.pk).map((column) => `"${column.name}"`).join(', ');
        lockedTables[table] = await database.all(`SELECT * FROM "${table}" ORDER BY ${primary || 'rowid'}`);
      }
      if (hash({ tables: lockedTables }) !== hash(current)) fail('Local edits arrived during restore. Try again.', 409);
      await database.run('PRAGMA defer_foreign_keys = ON');
      for (const table of [...TABLES].reverse()) await database.run(`DELETE FROM "${table}"`);
      for (const table of TABLES) {
        for (const row of value.tables[table]) {
          const columns = Object.keys(row);
          await database.run(`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, Object.values(row));
        }
      }
      const [importsTable] = await database.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deadline_imports'");
      if (importsTable) await database.run(`INSERT OR IGNORE INTO deadline_imports (deadlineId, provider)
        SELECT id, source FROM deadlines WHERE source IN ('google', 'canvas') AND id LIKE 'import-' || source || '-%'`);
      if ((await database.all('PRAGMA foreign_key_check')).length) fail('Backup contains broken references. Current data was kept.');
      await database.run('COMMIT');
    } catch (error) { await database.run('ROLLBACK'); throw error; }
    return { restored: true, backup };
  };
  const status = async () => {
    const row = await config();
    let backups = [];
    try { backups = (await fs.readdir(directory)).filter((name) => /^\d+-[a-f0-9-]+-(auto|manual|before-restore|conflict-remote)\.json$/.test(name)).sort().reverse(); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return { configured: Boolean(row), config: row?.config || {}, lastSyncAt: row?.lastSyncAt || null, lastBackupAt: row?.lastBackupAt || (backups[0] ? new Date(Number(backups[0].split('-')[0])).toISOString() : null), lastError: row?.lastError || null, backups };
  };
  const loadBackup = async (name) => {
    if (!/^\d+-[a-f0-9-]+-(auto|manual|before-restore|conflict-remote)\.json$/.test(name)) fail('Invalid backup name.');
    return validate(vault.decrypt(await fs.readFile(path.join(directory, name), 'utf8')));
  };
  const counts = (value) => Object.fromEntries(TABLES.filter((table) => !table.startsWith('note_')).map((table) => [table, value.tables[table].length]));

  const service = {
    status: () => serial(status),
    save: (input) => serial(async () => {
      const previous = await config();
      const owner = textValue(input.owner, 100, 'GitHub owner');
      const repo = textValue(input.repo, 100, 'Repository');
      if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo) || ['.', '..'].includes(repo)) fail('Enter a valid GitHub owner and repository name.');
      const settings = { owner, repo, autoSync: input.autoSync === true, autoBackup: input.autoBackup !== false };
      const secrets = previous ? vault.decrypt(previous.secrets) : {};
      const changed = previous && (previous.config.owner !== owner || previous.config.repo !== repo);
      if (changed && (!input.token || !input.passphrase)) fail('Enter credentials for the new repository.');
      if (input.token) secrets.token = textValue(input.token, 8192, 'GitHub token');
      if (input.passphrase) {
        if (input.passphrase.length < 12 || input.passphrase.length > 1024) fail('Use a sync passphrase of 12–1024 characters.');
        if (previous?.baseHash && !changed && input.passphrase !== secrets.passphrase) fail('Keep the existing passphrase for this repository. To change it, connect a new repository and retain the old passphrase for old backups.');
        secrets.passphrase = input.passphrase;
      }
      if (!secrets.token || !secrets.passphrase) fail('Enter a GitHub token and sync passphrase.');
      await database.run(`INSERT INTO continuity_settings (id, config, secrets) VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET config = excluded.config, secrets = excluded.secrets, baseHash = CASE WHEN ? THEN NULL ELSE baseHash END, lastError = NULL`, [JSON.stringify(settings), vault.encrypt(secrets), Number(Boolean(changed))]);
      return status();
    }),
    disconnect: () => serial(async () => { await database.run('DELETE FROM continuity_settings'); return status(); }),
    backup: (reason = 'manual') => serial(async () => ({ name: await writeBackup(await snapshot(), reason) })),
    preview: (name) => serial(async () => { const value = await loadBackup(name); const current = await snapshot(); return { createdAt: value.createdAt, counts: counts(value), localHash: hash(current) }; }),
    restore: (name, expectedHash) => serial(async () => { if (!expectedHash) fail('Preview the backup before restoring.'); return restore(await loadBackup(name), expectedHash); }),
    export: (passphrase) => serial(async () => { if (typeof passphrase !== 'string' || passphrase.length < 12 || passphrase.length > 1024) fail('Use a passphrase of 12–1024 characters.'); return { file: await seal(await snapshot(), passphrase) }; }),
    importPreview: (raw, passphrase) => serial(async () => { const value = await validate(await unseal(raw, passphrase)); return { counts: counts(value), localHash: hash(await snapshot()), createdAt: value.createdAt }; }),
    import: (raw, passphrase, expectedHash) => serial(async () => { if (!expectedHash) fail('Preview the file before restoring.'); return restore(await unseal(raw, passphrase), expectedHash); }),
    sync: (resolution, automatic = false) => serial(async () => {
      const row = await config();
      if (!row) fail('Connect a private GitHub repository first.');
      const { token, passphrase } = vault.decrypt(row.secrets);
      const root = `/repos/${encodeURIComponent(row.config.owner)}/${encodeURIComponent(row.config.repo)}`;
      const repository = await request(root, token);
      if (repository.private !== true) fail('Choose a private GitHub repository.');
      const filePath = `${root}/contents/focusflow/workspace.enc.json`;
      const metadata = await request(filePath, token, { allowMissing: true });
      let remote = null;
      if (metadata) {
        if (metadata.type !== 'file' || metadata.size > MAX_BYTES || !metadata.sha) fail('Remote backup is not a supported file.');
        const raw = metadata.encoding === 'base64' ? Buffer.from(metadata.content, 'base64').toString('utf8')
          : await request(`${root}/git/blobs/${metadata.sha}`, token, { headers: { Accept: 'application/vnd.github.raw+json' }, raw: true });
        remote = await validate(await unseal(raw, passphrase));
      }
      const local = await snapshot();
      const localHash = hash(local);
      const remoteHash = remote && hash(remote);
      if (automatic && remote && remoteHash !== localHash && remoteHash !== row.baseHash) {
        await database.run('UPDATE continuity_settings SET lastError = ? WHERE id = 1', ['GitHub has new changes. Open Backups & sync and choose Sync now to review them.']);
        return { needsPull: true };
      }
      if (resolution && (!['local', 'remote'].includes(resolution.choice) || resolution.localHash !== localHash || resolution.remoteSha !== (metadata?.sha || null))) fail('The workspace changed since the conflict preview. Sync again.', 409);
      if (remote && remoteHash !== localHash && localHash !== row.baseHash && remoteHash !== row.baseHash && !resolution) {
        await database.run('UPDATE continuity_settings SET lastError = ? WHERE id = 1', ['Changes exist on both devices. Open Backups & sync to resolve.']);
        return { conflict: true, localHash, remoteSha: metadata.sha, localCounts: counts(local), remoteCounts: counts(remote) };
      }
      let restored = false;
      let baseHash = localHash;
      if (remote && remoteHash !== localHash && (resolution?.choice === 'remote' || (!resolution && localHash === row.baseHash))) {
        await restore(remote, localHash);
        baseHash = remoteHash;
        restored = true;
      } else if (remoteHash !== localHash) {
        if (resolution?.choice === 'local' && remote) await writeBackup(remote, 'conflict-remote');
        const raw = await seal(local, passphrase);
        if (Buffer.byteLength(raw) > MAX_BYTES) fail('Encrypted workspace exceeds the 32 MB sync limit.');
        await request(filePath, token, { method: 'PUT', body: JSON.stringify({ message: 'Update encrypted FocusFlow workspace', content: Buffer.from(raw).toString('base64'), ...(metadata ? { sha: metadata.sha } : {}) }) });
      }
      await database.run('UPDATE continuity_settings SET baseHash = ?, lastSyncAt = ?, lastError = NULL WHERE id = 1', [baseHash, new Date().toISOString()]);
      return { synced: true, restored };
    }),
    tick: async () => {
      const current = await service.status();
      if ((!current.configured || current.config.autoBackup) && (!current.lastBackupAt || Date.now() - Date.parse(current.lastBackupAt) > 86400000)) await service.backup('auto');
      if (current.config.autoSync && (!current.lastSyncAt || Date.now() - Date.parse(current.lastSyncAt) >= 900000)) {
        try { await service.sync(undefined, true); } catch (error) { await serial(() => database.run('UPDATE continuity_settings SET lastError = ? WHERE id = 1', [error.status ? error.message : 'Sync unavailable. Check your connection and credentials.'])); }
      }
    },
    close: () => serial(() => database.close()),
  };
  return service;
}

function registerContinuity(app, service) {
  app.use('/api/continuity', localOnly, express.json({ limit: '48mb' }));
  app.get('/api/continuity', handler(() => service.status()));
  app.put('/api/continuity', handler((req) => service.save(req.body)));
  app.delete('/api/continuity', handler(() => service.disconnect()));
  app.post('/api/continuity/backup', handler(() => service.backup()));
  app.post('/api/continuity/preview', handler((req) => service.preview(req.body.name)));
  app.post('/api/continuity/restore', handler((req) => service.restore(req.body.name, req.body.localHash)));
  app.post('/api/continuity/export', handler((req) => service.export(req.body.passphrase)));
  app.post('/api/continuity/import-preview', handler((req) => service.importPreview(req.body.file, req.body.passphrase)));
  app.post('/api/continuity/import', handler((req) => service.import(req.body.file, req.body.passphrase, req.body.localHash)));
  app.post('/api/continuity/sync', handler((req) => service.sync(req.body.resolution)));
}

module.exports = { TABLES, seal, unseal, createContinuityService, registerContinuity };
