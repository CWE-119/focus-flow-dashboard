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

  let listenTarget;
  if (process.platform === 'win32') {
    const port = await getAvailablePort();
    listenTarget = String(port);
    connectionOptions = { hostname: '127.0.0.1', port };
  } else {
    listenTarget = path.join(tempDir, 'backend.sock');
    connectionOptions = { socketPath: listenTarget };
  }
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
