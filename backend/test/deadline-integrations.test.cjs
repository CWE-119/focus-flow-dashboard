const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, rmSync, readFileSync, statSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { fetchDeadlines, canvasOrigin, publicIPv4 } = require('../deadline-providers.cjs');
const { createIntegrationService } = require('../deadline-integrations.cjs');

test('Google imports recurring pages, local calendar days, and skips cancellations', async () => {
  const pages = [];
  const deadlines = await fetchDeadlines('google', { calendarId: 'class@example.com', authMode: 'accessToken' }, { credential: 'test-token' }, async (url, headers) => {
    pages.push(url.href);
    assert.equal(headers.Authorization, 'Bearer test-token');
    assert.equal(url.searchParams.get('singleEvents'), 'true');
    if (!url.searchParams.has('pageToken')) return { data: { summary: 'Classes', nextPageToken: 'page-2', items: [
      { id: 'all-day', summary: 'Reading week', start: { date: '2026-09-09' }, end: { date: '2026-09-12' } },
      { id: 'cancelled', status: 'cancelled', end: { dateTime: '2026-09-10T12:00:00Z' } },
    ] } };
    return { data: { items: [{ id: 'lecture', summary: 'Lecture', start: { dateTime: '2026-09-10T11:00:00+06:00' }, end: { dateTime: '2026-09-10T12:00:00+06:00' }, htmlLink: 'javascript:alert(1)' }] } };
  });
  assert.equal(pages.length, 2);
  assert.equal(deadlines.length, 2);
  assert.equal(deadlines[0].end, '2026-09-11');
  assert.equal(deadlines[0].start, null);
  assert.equal(deadlines[1].end, '2026-09-10T06:00:00.000Z');
  assert.equal(deadlines[1].url, null);
});

test('public Google calendar keys stay out of URLs', async () => {
  await fetchDeadlines('google', { calendarId: 'public', authMode: 'apiKey' }, { credential: 'api-key' }, async (url, headers) => {
    assert.equal(url.href.includes('api-key'), false);
    assert.equal(headers['X-Goog-Api-Key'], 'api-key');
    assert.equal(headers.Authorization, undefined);
    return { data: { items: [] } };
  });
});

test('Canvas imports assignment overrides across pages without forwarding tokens off-site', async () => {
  const settings = { baseUrl: 'https://school.instructure.com' };
  let requests = 0;
  const deadlines = await fetchDeadlines('canvas', settings, { credential: 'canvas-token' }, async (url, headers) => {
    requests++;
    assert.equal(headers.Authorization, 'Bearer canvas-token');
    return { data: [{ plannable_id: 12, course_id: 2, plannable_type: 'assignment', context_name: 'Biology',
      plannable_date: '2026-09-12T12:00:00Z', plannable: { title: 'Lab report', due_at: '2026-09-11T12:00:00Z' }, html_url: '/courses/2/assignments/12' }],
    link: requests === 1 ? '<https://school.instructure.com/api/v1/planner/items?page=2>; rel="next"' : undefined };
  });
  assert.equal(requests, 2);
  assert.equal(deadlines.length, 1);
  assert.equal(deadlines[0].end, '2026-09-12T12:00:00.000Z');
  assert.equal(deadlines[0].url, 'https://school.instructure.com/courses/2/assignments/12');
  await assert.rejects(fetchDeadlines('canvas', settings, { credential: 'canvas-token' }, async () => ({ data: [], link: '<https://other.example/api/v1/planner/items>; rel="next"' })), /unsafe pagination/);
  await assert.rejects(fetchDeadlines('google', { calendarId: 'primary', authMode: 'accessToken' }, { credential: 'token' }, async () => ({ data: { items: [], nextPageToken: 'same' } })), /pagination did not finish/);
});

test('Canvas addresses require public HTTPS origins', () => {
  assert.equal(canvasOrigin('https://school.instructure.com/'), 'https://school.instructure.com');
  for (const value of ['http://school.instructure.com', 'https://localhost', 'https://127.0.0.1', 'https://10.0.0.1', 'https://school.instructure.com/courses/1', 'https://user:pass@school.example']) {
    assert.throws(() => canvasOrigin(value));
  }
  for (const value of ['0.0.0.0', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '::1']) assert.equal(publicIPv4(value), false);
});

test('sync is persistent, idempotent, failure-safe, and preserves manual and historical dates', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'focusflow-deadlines-'));
  const filename = path.join(directory, 'test.db');
  const database = new sqlite3.Database(filename);
  const exec = (sql) => new Promise((resolve, reject) => database.exec(sql, (error) => error ? reject(error) : resolve()));
  const all = (sql) => new Promise((resolve, reject) => database.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
  let service;
  try {
    await exec(`CREATE TABLE deadlines (id TEXT PRIMARY KEY, title TEXT, context TEXT, source TEXT, start TEXT, end TEXT, url TEXT, updatedAt TEXT);
      INSERT INTO deadlines (id, title, source, end) VALUES ('manual', 'My date', 'manual', '2027-01-01');`);
    let fail = false;
    let imported = [{ id: 'import-google-test', title: 'Exam', context: 'Course', source: 'google', start: null, end: new Date(Date.now() + 86400000).toISOString(), url: null },
      { id: 'import-google-history', title: 'Old exam', context: 'Course', source: 'google', start: null, end: '2020-01-01', url: null }];
    const fetchProvider = async (provider, settings, secrets) => {
      assert.equal(secrets.credential, 'private-token');
      if (fail) throw new Error('Provider unavailable');
      return imported;
    };
    service = createIntegrationService(filename, fetchProvider);
    await service.save('google', { calendarId: 'primary', authMode: 'accessToken', credential: 'private-token' });
    assert.equal(JSON.stringify(await service.status()).includes('private-token'), false);
    const stored = await all('SELECT secrets FROM deadline_integrations');
    assert.equal(stored[0].secrets.includes('private-token'), false);
    assert.equal(readFileSync(`${filename}.integrations.key`).length, 32);
    assert.equal(statSync(`${filename}.integrations.key`).mode & 0o777, 0o600);
    await service.sync('google');
    await service.sync('google');
    assert.equal((await all('SELECT * FROM deadlines')).length, 3);
    imported = [{ ...imported[0], title: 'Moved exam', end: new Date(Date.now() + 2 * 86400000).toISOString() }];
    await service.sync('google');
    assert.equal((await all("SELECT title FROM deadlines WHERE id = 'import-google-test'"))[0].title, 'Moved exam');
    fail = true;
    await assert.rejects(service.sync('google'), /unavailable/);
    assert.equal((await all('SELECT * FROM deadlines')).length, 3);
    await service.close();
    service = createIntegrationService(filename, fetchProvider);
    await service.save('google', { calendarId: 'primary', authMode: 'accessToken' });
    await assert.rejects(service.save('google', { calendarId: 'other', authMode: 'accessToken' }), /credential/);
    fail = false;
    imported = [];
    await service.sync('google');
    assert.deepEqual((await all('SELECT id FROM deadlines ORDER BY id')).map((row) => row.id), ['import-google-history', 'manual']);
    await service.disconnect('google');
    assert.equal((await service.status()).find((entry) => entry.provider === 'google').configured, false);
    assert.equal((await all('SELECT * FROM deadlines')).length, 2);
    await assert.rejects(service.sync('google'), /Save this connection/);
  } finally {
    if (service) await service.close();
    await new Promise((resolve) => database.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
