const crypto = require('node:crypto');
const fs = require('node:fs');
const sqlite3 = require('sqlite3');
const { canvasOrigin, fetchDeadlines } = require('./deadline-providers.cjs');

function createIntegrationService(databasePath, fetchProvider = fetchDeadlines) {
  const database = new sqlite3.Database(databasePath);
  database.configure('busyTimeout', 5000);
  const run = (sql, params = []) => new Promise((resolve, reject) => database.run(sql, params, function(error) {
    if (error) reject(error); else resolve(this);
  }));
  const all = (sql, params = []) => new Promise((resolve, reject) => database.all(sql, params, (error, rows) => {
    if (error) reject(error); else resolve(rows);
  }));
  let queue = run('PRAGMA foreign_keys = ON').then(() => run(`CREATE TABLE IF NOT EXISTS deadline_integrations (
    provider TEXT PRIMARY KEY, settings TEXT NOT NULL, secrets TEXT NOT NULL, lastSyncedAt TEXT
  )`)).then(() => run(`CREATE TABLE IF NOT EXISTS deadline_imports (
    deadlineId TEXT PRIMARY KEY REFERENCES deadlines(id) ON DELETE CASCADE, provider TEXT NOT NULL
  )`));

  function serialize(operation) {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }

  function key() {
    const filename = `${databasePath}.integrations.key`;
    try { fs.writeFileSync(filename, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const value = fs.readFileSync(filename);
    if (value.length !== 32) throw new Error('Invalid credential key. Reconnect your integrations.');
    return value;
  }

  function encrypt(value) {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key(), nonce);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64');
  }

  function decrypt(value) {
    const buffer = Buffer.from(value, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), buffer.subarray(0, 12));
    decipher.setAuthTag(buffer.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8'));
  }

  const status = async () => {
    const rows = await all('SELECT provider, settings, lastSyncedAt FROM deadline_integrations');
    return ['canvas', 'google'].map((provider) => {
      const row = rows.find((entry) => entry.provider === provider);
      return { provider, configured: Boolean(row), settings: row ? JSON.parse(row.settings) : {}, lastSyncedAt: row?.lastSyncedAt || null };
    });
  };

  return {
    status: () => serialize(status),
    save: (provider, input) => serialize(async () => {
      const settings = provider === 'canvas'
        ? { baseUrl: canvasOrigin(input.baseUrl) }
        : { calendarId: typeof input.calendarId === 'string' ? input.calendarId.trim() : '', authMode: input.authMode };
      if (provider === 'google' && (!settings.calendarId || settings.calendarId.length > 320 ||
        !['apiKey', 'accessToken'].includes(settings.authMode))) throw new Error('Enter a calendar ID and choose an authentication method.');
      if (provider === 'google' && settings.authMode === 'apiKey' && settings.calendarId === 'primary') {
        throw new Error('Public calendars need their calendar ID; primary requires an OAuth access token.');
      }
      const [previous] = await all('SELECT * FROM deadline_integrations WHERE provider = ?', [provider]);
      const previousSettings = previous ? JSON.parse(previous.settings) : null;
      const changed = previousSettings && JSON.stringify(previousSettings) !== JSON.stringify(settings);
      if (input.credential !== undefined && (typeof input.credential !== 'string' || /\s/.test(input.credential) || input.credential.length > 8192)) {
        throw new Error('Enter a valid credential without whitespace.');
      }
      if (!input.credential && (!previous || changed)) throw new Error('Enter a credential for this connection.');
      const secrets = input.credential ? encrypt({ credential: input.credential }) : previous.secrets;
      await run(`INSERT INTO deadline_integrations (provider, settings, secrets) VALUES (?, ?, ?)
        ON CONFLICT(provider) DO UPDATE SET settings = excluded.settings, secrets = excluded.secrets, lastSyncedAt = NULL`,
      [provider, JSON.stringify(settings), secrets]);
      return status();
    }),
    sync: (provider) => serialize(async () => {
      const [connection] = await all('SELECT * FROM deadline_integrations WHERE provider = ?', [provider]);
      if (!connection) throw new Error('Save this connection before syncing.');
      let secrets;
      try { secrets = decrypt(connection.secrets); } catch { throw new Error('Could not unlock the saved credential. Enter it again in Connections.'); }
      const deadlines = await fetchProvider(provider, JSON.parse(connection.settings), secrets);
      const timestamp = new Date().toISOString();
      await run('BEGIN IMMEDIATE');
      try {
        const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const old = await all(`SELECT deadlineId FROM deadline_imports JOIN deadlines ON deadlines.id = deadlineId
          WHERE provider = ? AND deadlines.end >= ?`, [provider, from]);
        const current = new Set(deadlines.map((deadline) => deadline.id));
        for (const { deadlineId } of old) {
          if (!current.has(deadlineId)) await run('DELETE FROM deadlines WHERE id = ?', [deadlineId]);
        }
        for (const deadline of deadlines) {
          await run(`INSERT INTO deadlines (id, title, context, source, start, end, url) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET title = excluded.title, context = excluded.context, start = excluded.start,
            end = excluded.end, url = excluded.url, updatedAt = CURRENT_TIMESTAMP`,
          [deadline.id, deadline.title, deadline.context, deadline.source, deadline.start, deadline.end, deadline.url]);
          await run('INSERT OR IGNORE INTO deadline_imports (deadlineId, provider) VALUES (?, ?)', [deadline.id, provider]);
        }
        await run('UPDATE deadline_integrations SET lastSyncedAt = ? WHERE provider = ?', [timestamp, provider]);
        await run('COMMIT');
      } catch (error) {
        await run('ROLLBACK');
        throw error;
      }
      return { count: deadlines.length, lastSyncedAt: timestamp };
    }),
    disconnect: (provider) => serialize(async () => {
      await run('DELETE FROM deadline_integrations WHERE provider = ?', [provider]);
      return status();
    }),
    close: () => serialize(() => new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()))),
  };
}

function registerDeadlineIntegrations(app, databasePath) {
  let service;
  app.use('/api/integrations/deadlines', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const remote = req.socket.remoteAddress;
    const origin = req.get('Origin');
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
    const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];
    if (process.env.FOCUSFLOW_FRONTEND_ORIGIN) allowedOrigins.push(process.env.FOCUSFLOW_FRONTEND_ORIGIN);
    if (!local || (origin && origin !== 'null' && !allowedOrigins.includes(origin))) {
      return res.status(403).json({ error: 'Manage integrations from the local FocusFlow app.' });
    }
    if (req.method !== 'GET' && req.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return res.status(415).json({ error: 'JSON required.' });
    }
    service ||= createIntegrationService(databasePath);
    next();
  });
  const route = (operation) => async (req, res) => {
    if (req.params.provider && !['google', 'canvas'].includes(req.params.provider)) return res.status(400).json({ error: 'Unknown deadline provider.' });
    try { res.json(await operation(req)); }
    catch (error) {
      const message = error.code?.startsWith('SQLITE') ? 'Could not save integration data.' : error.message;
      res.status(req.path.endsWith('/sync') ? 502 : 400).json({ error: message });
    }
  };
  app.get('/api/integrations/deadlines', route(() => service.status()));
  app.put('/api/integrations/deadlines/:provider', route((req) => service.save(req.params.provider, req.body || {})));
  app.post('/api/integrations/deadlines/:provider/sync', route((req) => service.sync(req.params.provider)));
  app.delete('/api/integrations/deadlines/:provider', route((req) => service.disconnect(req.params.provider)));
}

module.exports = { createIntegrationService, registerDeadlineIntegrations };
