const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const http = require('node:http');
const { createServer } = require('node:net');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const sqlite3 = require('sqlite3').verbose();

const rootDir = path.resolve(__dirname, '..', '..');
let backendProcess;
let databasePath;
let connectionOptions;
let tempDir;
let backendOutput = '';

function createLegacyDatabase(filename) {
  const sql = `
    CREATE TABLE todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'medium',
      dueDate TEXT,
      repeatType TEXT DEFAULT 'none',
      repeatInterval INTEGER,
      repeatDays TEXT,
      repeatLimit INTEGER,
      repeatCount INTEGER DEFAULT 0,
      repeatEndDate TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO todos (title) VALUES ('Legacy task');
  `;

  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(filename);
    database.exec(sql, (error) => {
      database.close((closeError) => {
        if (error || closeError) reject(error || closeError);
        else resolve();
      });
    });
  });
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function waitForBackend(timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (backendProcess.exitCode !== null) {
      throw new Error(`Backend exited before becoming ready.\n${backendOutput}`);
    }
    try {
      const { response } = await request('/categories');
      if (response.statusCode === 200) return;
    } catch {
      // Startup migrations are still running.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Backend did not become ready.\n${backendOutput}`);
}

async function request(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body || null;
    const req = http.request({
      ...connectionOptions,
      path: `/api${pathname}`,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...options.headers,
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ response, body: raw ? JSON.parse(raw) : null });
        } catch (error) {
          reject(new Error(`Invalid JSON response (${response.statusCode}): ${raw}`, { cause: error }));
        }
      });
    });
    req.once('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

before(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'focusflow-categories-'));
  databasePath = path.join(tempDir, 'legacy.db');
  await createLegacyDatabase(databasePath);

  const port = await getAvailablePort();
  const listenTarget = String(port);
  connectionOptions = { hostname: '127.0.0.1', port };
  backendProcess = spawn(process.execPath, [path.join(rootDir, 'backend', 'index.js')], {
    cwd: rootDir,
    env: {
      ...process.env,
      FOCUSFLOW_DB_PATH: databasePath,
      PORT: listenTarget,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backendProcess.stdout.on('data', (chunk) => { backendOutput += chunk.toString(); });
  backendProcess.stderr.on('data', (chunk) => { backendOutput += chunk.toString(); });
  await waitForBackend();
});

after(async () => {
  if (backendProcess && backendProcess.exitCode === null) {
    backendProcess.kill('SIGINT');
    await Promise.race([
      new Promise((resolve) => backendProcess.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  }
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

test('migrates legacy tasks and persists category CRUD and assignments', async () => {
  const initialCategories = await request('/categories');
  assert.equal(initialCategories.response.statusCode, 200);
  assert.deepEqual(
    initialCategories.body.map(({ id, name, color }) => ({ id, name, color })),
    [
      { id: 'cat-work', name: 'Work', color: '#5ca8e0' },
      { id: 'cat-personal', name: 'Personal', color: '#9b7ed9' },
      { id: 'cat-study', name: 'Study', color: '#e09746' },
    ]
  );

  const migratedTodos = await request('/todos');
  assert.equal(migratedTodos.response.statusCode, 200);
  assert.equal(migratedTodos.body.length, 1);
  assert.equal(migratedTodos.body[0].title, 'Legacy task');
  assert.equal(migratedTodos.body[0].categoryId, null);

  const unsafeCategory = await request('/categories', {
    method: 'POST',
    body: JSON.stringify({ id: 'bad category', name: 'Bad', color: '#123456' }),
  });
  assert.equal(unsafeCategory.response.statusCode, 400);

  const createdCategory = await request('/categories', {
    method: 'POST',
    body: JSON.stringify({ id: 'cat-migrated-client-id', name: 'Errands', color: '#6bcf7f' }),
  });
  assert.equal(createdCategory.response.statusCode, 201);
  assert.equal(createdCategory.body.id, 'cat-migrated-client-id');

  const unknownCategoryTodo = await request('/todos', {
    method: 'POST',
    body: JSON.stringify({ title: 'Invalid assignment', categoryId: 'cat-missing' }),
  });
  assert.equal(unknownCategoryTodo.response.statusCode, 400);
  assert.equal(unknownCategoryTodo.body.error, 'Category not found');

  const createdTodo = await request('/todos', {
    method: 'POST',
    body: JSON.stringify({ title: 'Buy groceries', categoryId: createdCategory.body.id }),
  });
  assert.equal(createdTodo.response.statusCode, 201);
  assert.equal(createdTodo.body.categoryId, createdCategory.body.id);

  const renamedCategory = await request(`/categories/${createdCategory.body.id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: 'Home errands', color: '#5cd0d0' }),
  });
  assert.equal(renamedCategory.response.statusCode, 200);
  assert.equal(renamedCategory.body.name, 'Home errands');
  assert.equal(renamedCategory.body.color, '#5cd0d0');

  const clearedTodo = await request(`/todos/${createdTodo.body.id}`, {
    method: 'PUT',
    body: JSON.stringify({ categoryId: null }),
  });
  assert.equal(clearedTodo.response.statusCode, 200);
  assert.equal(clearedTodo.body.categoryId, null);

  const reassignedTodo = await request(`/todos/${createdTodo.body.id}`, {
    method: 'PUT',
    body: JSON.stringify({ categoryId: createdCategory.body.id }),
  });
  assert.equal(reassignedTodo.response.statusCode, 200);
  assert.equal(reassignedTodo.body.categoryId, createdCategory.body.id);

  const deletedCategory = await request(`/categories/${createdCategory.body.id}`, { method: 'DELETE' });
  assert.equal(deletedCategory.response.statusCode, 200);
  assert.deepEqual(deletedCategory.body, { success: true });

  const todosAfterDelete = await request('/todos');
  const todoAfterDelete = todosAfterDelete.body.find((todo) => todo.id === createdTodo.body.id);
  assert.equal(todoAfterDelete.categoryId, null);
});

test('creates and retrieves a single note by its SQLite id', async () => {
  const createdNote = await request('/notes', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Release notes',
      content: 'A focused workspace for connected work.',
    }),
  });

  assert.equal(createdNote.response.statusCode, 201);

  const fetchedNote = await request(`/notes/${createdNote.body.id}`);
  assert.equal(fetchedNote.response.statusCode, 200);
  assert.equal(fetchedNote.body.id, createdNote.body.id);
  assert.equal(fetchedNote.body.title, 'Release notes');
});

test('keeps connection credentials private and validates integration access', async () => {
  const forbidden = await request('/integrations/deadlines', { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(forbidden.response.statusCode, 403);
  const invalid = await request('/integrations/deadlines/canvas', {
    method: 'PUT', body: JSON.stringify({ baseUrl: 'http://localhost:8080', credential: 'fake-token' }),
  });
  assert.equal(invalid.response.statusCode, 400);
  const publicPrimary = await request('/integrations/deadlines/google', {
    method: 'PUT', body: JSON.stringify({ calendarId: 'primary', authMode: 'apiKey', credential: 'fake-key' }),
  });
  assert.equal(publicPrimary.response.statusCode, 400);
  const saved = await request('/integrations/deadlines/canvas', {
    method: 'PUT', body: JSON.stringify({ baseUrl: 'https://school.instructure.com', credential: 'fake-token' }),
  });
  assert.equal(saved.response.statusCode, 200);
  assert.equal(saved.body.find((entry) => entry.provider === 'canvas').configured, true);
  assert.equal(JSON.stringify(saved.body).includes('fake-token'), false);
  const status = await request('/integrations/deadlines', { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(status.response.statusCode, 200);
  assert.equal(status.response.headers['cache-control'], 'no-store');
  assert.equal(JSON.stringify(status.body).includes('fake-token'), false);
  const disconnected = await request('/integrations/deadlines/canvas', { method: 'DELETE' });
  assert.equal(disconnected.response.statusCode, 200);
  assert.equal(disconnected.body.find((entry) => entry.provider === 'canvas').configured, false);
  const unconfigured = await request('/integrations/deadlines/canvas/sync', { method: 'POST', body: '{}' });
  assert.equal(unconfigured.response.statusCode, 502);
  assert.match(unconfigured.body.error, /Save this connection/);
});

test('persists deadlines and glossary terms for dashboard features', async () => {
  const invalidDeadline = await request('/deadlines', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Bad source',
      source: 'email',
      end: '2026-01-03T15:00:00.000Z',
    }),
  });
  assert.equal(invalidDeadline.response.statusCode, 400);

  const createdDeadline = await request('/deadlines', {
    method: 'POST',
    body: JSON.stringify({
      id: 'deadline-dashboard-test',
      title: 'Data structures quiz',
      context: 'CS 310',
      source: 'canvas',
      start: '2026-01-03T14:30:00.000Z',
      end: '2026-01-03T15:00:00.000Z',
      url: 'https://canvas.example.test/courses/310',
    }),
  });
  assert.equal(createdDeadline.response.statusCode, 201);
  assert.equal(createdDeadline.body.id, 'deadline-dashboard-test');
  assert.equal(createdDeadline.body.source, 'canvas');

  const updatedDeadline = await request('/deadlines/deadline-dashboard-test', {
    method: 'PUT',
    body: JSON.stringify({ title: 'Data structures quiz 4', context: null }),
  });
  assert.equal(updatedDeadline.response.statusCode, 200);
  assert.equal(updatedDeadline.body.title, 'Data structures quiz 4');
  assert.equal(updatedDeadline.body.context, null);

  const deadlines = await request('/deadlines');
  assert.equal(deadlines.response.statusCode, 200);
  assert.equal(deadlines.body.length, 1);
  assert.equal(deadlines.body[0].id, 'deadline-dashboard-test');

  const createdTerm = await request('/glossary', {
    method: 'POST',
    body: JSON.stringify({
      id: 'glossary-flow-test',
      term: 'Flow',
      description: 'A state of focused momentum.',
    }),
  });
  assert.equal(createdTerm.response.statusCode, 201);
  assert.equal(createdTerm.body.term, 'Flow');

  const duplicateTerm = await request('/glossary', {
    method: 'POST',
    body: JSON.stringify({ term: 'flow', description: 'Duplicate casing.' }),
  });
  assert.equal(duplicateTerm.response.statusCode, 409);

  const updatedTerm = await request('/glossary/glossary-flow-test', {
    method: 'PUT',
    body: JSON.stringify({ description: 'Focused momentum with low friction.' }),
  });
  assert.equal(updatedTerm.response.statusCode, 200);
  assert.equal(updatedTerm.body.description, 'Focused momentum with low friction.');

  const glossary = await request('/glossary');
  assert.equal(glossary.response.statusCode, 200);
  assert.equal(glossary.body.length, 1);
  assert.equal(glossary.body[0].id, 'glossary-flow-test');

  const deletedDeadline = await request('/deadlines/deadline-dashboard-test', { method: 'DELETE' });
  assert.equal(deletedDeadline.response.statusCode, 200);
  assert.deepEqual(deletedDeadline.body, { success: true });

  const deletedTerm = await request('/glossary/glossary-flow-test', { method: 'DELETE' });
  assert.equal(deletedTerm.response.statusCode, 200);
  assert.deepEqual(deletedTerm.body, { success: true });
});
