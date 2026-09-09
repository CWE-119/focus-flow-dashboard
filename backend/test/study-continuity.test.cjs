const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../db-utils.cjs');
const { createStudyService, scheduleReview, planStudy } = require('../study.cjs');
const { createContinuityService, seal, unseal } = require('../continuity.cjs');
const { refreshGoogleToken } = require('../google-token.cjs');

async function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'focusflow-study-test-'));
  const filename = path.join(directory, 'test.db');
  const database = openDatabase(filename);
  const schema = readFileSync(path.join(__dirname, '../index.js'), 'utf8').match(/const initSQL = `([\s\S]*?)`;/)[1];
  await database.exec(`PRAGMA foreign_keys = ON; ${schema}`);
  const study = createStudyService(filename);
  await study.ready;
  return { filename, database, study, close: async () => { await study.close(); await database.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test('plans fit before due dates and recall schedules retain repeat failures', () => {
  const plan = planStudy('2026-09-01', '2026-09-05', 100, 45);
  assert.deepEqual(plan, [{ date: '2026-09-02', minutes: 10 }, { date: '2026-09-03', minutes: 45 }, { date: '2026-09-04', minutes: 45 }]);
  assert.throws(() => planStudy('2026-09-01', '2026-09-02', 100, 45), /Only 45/);
  assert.throws(() => planStudy('2026-02-30', '2026-03-04', 30, 30), /valid study dates/);
  const now = new Date('2026-09-09T12:00:00Z');
  const card = { interval: 10, repetitions: 3, ease: 2.5 };
  assert.equal(scheduleReview(card, 'again', now).dueAt, '2026-09-09T12:10:00.000Z');
  assert.equal(scheduleReview(card, 'again', now).repetitions, 0);
  assert.equal(scheduleReview(card, 'good', now).interval, 25);
  assert.ok(scheduleReview(card, 'easy', now).interval > 25);
});

test('links workspace resources and persists cards, optimistic review checks, and study plans', async () => {
  const context = await fixture();
  try {
    const { database, study } = context;
    await database.run("INSERT INTO notes (title, content) VALUES ('Biology', 'Cell theory')");
    await database.run("INSERT INTO glossary_terms (id, term, description) VALUES ('cell', 'Cell', 'Basic unit of life')");
    await database.run("INSERT INTO deadlines (id, title, source, end) VALUES ('exam', 'Exam', 'manual', '2026-09-12')");
    await database.run("INSERT INTO history (action, duration, date) VALUES ('note_session', 40, '2026-09-09')");
    const workspace = await study.save(null, { name: 'Biology 101', kind: 'course' });
    await study.link(workspace.id, 'notes', 1);
    await study.link(workspace.id, 'deadlines', 'exam');
    await study.link(workspace.id, 'sessions', 1);
    await study.reading(workspace.id, { title: 'Reading', url: 'https://example.org/paper' });
    await assert.rejects(study.reading(workspace.id, { title: 'Bad URL', url: 'javascript:alert(1)' }), /HTTP/);
    await study.plan(workspace.id, { deadlineId: 'exam', minutes: 90, dailyMinutes: 30, startDate: '2026-09-09' });
    const detail = await study.detail(workspace.id);
    assert.equal(detail.notes[0].title, 'Biology');
    assert.equal(detail.sessions[0].duration, 40);
    assert.equal(detail.steps.length, 3);
    await assert.rejects(study.plan(workspace.id, { deadlineId: 'exam', minutes: 90, dailyMinutes: 30, startDate: '2026-09-09' }), /already exists/);
    const card = await study.saveCard(null, { workspaceId: workspace.id, noteId: 1, glossaryId: 'cell', question: 'What is a cell?', answer: 'Basic unit of life' });
    const reviewed = await study.review(card.id, { grade: 'good', revision: card.revision });
    assert.equal(reviewed.interval, 1);
    await assert.rejects(study.review(card.id, { grade: 'good', revision: card.revision }), /already changed/);
    assert.equal((await study.summary()).reviews.length, 1);
    await study.remove(workspace.id);
    assert.equal((await study.cards())[0].workspaceId, null);
    assert.equal((await database.all('SELECT * FROM notes')).length, 1);
  } finally { await context.close(); }
});

test('encrypted backups restore full data and reject corrupt files and stale previews', async () => {
  const context = await fixture();
  const continuity = createContinuityService(context.filename);
  try {
    await context.database.run("INSERT INTO notes (title, content) VALUES ('Private note', 'Secret research')");
    const exported = await continuity.export('correct-passphrase-123');
    assert.equal(exported.file.includes('Secret research'), false);
    await assert.rejects(continuity.importPreview(exported.file, 'wrong-passphrase'), /decrypt/);
    const parsed = await unseal(exported.file, 'correct-passphrase-123');
    assert.equal(parsed.tables.notes[0].content, 'Secret research');
    assert.equal(Object.hasOwn(parsed.tables, 'continuity_settings'), false);
    const backup = await continuity.backup();
    const preview = await continuity.preview(backup.name);
    await context.database.run("UPDATE notes SET content = 'New content'");
    await assert.rejects(continuity.restore(backup.name, preview.localHash), /changed/);
    const refreshed = await continuity.preview(backup.name);
    await continuity.restore(backup.name, refreshed.localHash);
    assert.equal((await context.database.all('SELECT content FROM notes'))[0].content, 'Secret research');
    assert.ok((await continuity.status()).backups.some((name) => name.includes('before-restore')));
    const invalid = structuredClone(parsed);
    invalid.tables.workspace_notes = [{ workspaceId: 'missing', noteId: 1 }];
    await assert.rejects(continuity.importPreview(await seal(invalid, 'correct-passphrase-123'), 'correct-passphrase-123'), /references|FOREIGN KEY/);
    assert.equal((await context.database.all('SELECT content FROM notes'))[0].content, 'Secret research');
  } finally { await continuity.close(); await context.close(); }
});

test('two devices use encrypted GitHub snapshots, detect conflicts, and keep recovery copies', async () => {
  const first = await fixture();
  const second = await fixture();
  let remote = null;
  let counter = 0;
  let publicRepo = false;
  const request = async (endpoint, token, options = {}) => {
    assert.equal(token, 'fake-token');
    if (!endpoint.includes('/contents/')) return { private: !publicRepo };
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      assert.equal(body.sha, remote?.sha);
      remote = { type: 'file', content: body.content, encoding: 'base64', size: Buffer.from(body.content, 'base64').length, sha: `version-${++counter}` };
      return { content: { sha: remote.sha } };
    }
    return remote;
  };
  const firstSync = createContinuityService(first.filename, request);
  const secondSync = createContinuityService(second.filename, request);
  try {
    const settings = { owner: 'student', repo: 'private-notes', token: 'fake-token', passphrase: 'shared-passphrase-123', autoSync: false };
    await firstSync.save(settings); await secondSync.save(settings);
    await first.database.run("INSERT INTO notes (title, content) VALUES ('Shared', 'Original')");
    await firstSync.sync();
    assert.equal(Buffer.from(remote.content, 'base64').toString().includes('Original'), false);
    let conflict = await secondSync.sync();
    assert.equal(conflict.conflict, true);
    await secondSync.sync({ choice: 'remote', localHash: conflict.localHash, remoteSha: conflict.remoteSha });
    assert.equal((await second.database.all('SELECT content FROM notes'))[0].content, 'Original');
    await first.database.run("UPDATE notes SET content = 'First edit'");
    await firstSync.sync();
    assert.equal((await secondSync.sync(undefined, true)).needsPull, true);
    assert.equal((await second.database.all('SELECT content FROM notes'))[0].content, 'Original');
    await second.database.run("UPDATE notes SET content = 'Second edit'");
    conflict = await secondSync.sync();
    assert.equal(conflict.conflict, true);
    await assert.rejects(secondSync.sync({ choice: 'local', localHash: 'stale', remoteSha: conflict.remoteSha }), /changed/);
    await secondSync.sync({ choice: 'local', localHash: conflict.localHash, remoteSha: conflict.remoteSha });
    assert.ok((await secondSync.status()).backups.some((name) => name.includes('conflict-remote')));
    await firstSync.sync();
    assert.equal((await first.database.all('SELECT content FROM notes'))[0].content, 'Second edit');
    publicRepo = true;
    await assert.rejects(firstSync.sync(), /private GitHub/);
  } finally { await firstSync.close(); await secondSync.close(); await first.close(); await second.close(); }
});

test('Google OAuth refresh uses the supplied client without leaking credentials', async () => {
  const refreshed = await refreshGoogleToken({ refreshToken: 'refresh', clientId: 'client', clientSecret: 'secret' }, async (url, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('grant_type'), 'refresh_token');
    assert.equal(body.get('client_id'), 'client');
    return { ok: true, json: async () => ({ access_token: 'renewed' }) };
  });
  assert.equal(refreshed.credential, 'renewed');
});
