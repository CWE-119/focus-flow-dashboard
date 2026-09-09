const { randomUUID } = require('node:crypto');
const { openDatabase, fail, textValue, integer, handler } = require('./db-utils.cjs');

const STUDY_SCHEMA = `
  CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS workspace_notes (workspaceId TEXT REFERENCES workspaces(id) ON DELETE CASCADE, noteId INTEGER REFERENCES notes(id) ON DELETE CASCADE, PRIMARY KEY(workspaceId, noteId));
  CREATE TABLE IF NOT EXISTS workspace_deadlines (workspaceId TEXT REFERENCES workspaces(id) ON DELETE CASCADE, deadlineId TEXT REFERENCES deadlines(id) ON DELETE CASCADE, PRIMARY KEY(workspaceId, deadlineId));
  CREATE TABLE IF NOT EXISTS workspace_sessions (workspaceId TEXT REFERENCES workspaces(id) ON DELETE CASCADE, historyId INTEGER REFERENCES history(id) ON DELETE CASCADE, PRIMARY KEY(workspaceId, historyId));
  CREATE TABLE IF NOT EXISTS readings (id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, title TEXT NOT NULL, url TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS study_steps (id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, deadlineId TEXT REFERENCES deadlines(id) ON DELETE SET NULL, title TEXT NOT NULL, date TEXT NOT NULL, minutes INTEGER NOT NULL, completed INTEGER NOT NULL DEFAULT 0, targetEnd TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS flashcards (id TEXT PRIMARY KEY, workspaceId TEXT REFERENCES workspaces(id) ON DELETE SET NULL, noteId INTEGER REFERENCES notes(id) ON DELETE SET NULL, glossaryId TEXT REFERENCES glossary_terms(id) ON DELETE SET NULL, question TEXT NOT NULL, answer TEXT NOT NULL, dueAt TEXT NOT NULL, interval REAL NOT NULL DEFAULT 0, ease REAL NOT NULL DEFAULT 2.5, repetitions INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS card_reviews (id TEXT PRIMARY KEY, cardId TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE, grade TEXT NOT NULL, reviewedAt TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_cards_due ON flashcards(dueAt);
  CREATE INDEX IF NOT EXISTS idx_steps_date ON study_steps(date);
`;

function scheduleReview(card, grade, now = new Date()) {
  if (!['again', 'hard', 'good', 'easy'].includes(grade)) fail('Choose Again, Hard, Good, or Easy.');
  let interval;
  let repetitions = card.repetitions;
  let ease = card.ease;
  if (grade === 'again') { interval = 0; repetitions = 0; ease = Math.max(1.3, ease - 0.2); }
  else {
    repetitions++;
    if (grade === 'hard') { interval = Math.max(1, Math.ceil(card.interval * 1.2)); ease = Math.max(1.3, ease - 0.15); }
    else if (grade === 'easy') { interval = card.interval ? Math.ceil(card.interval * ease * 1.3) : 4; ease += 0.15; }
    else interval = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.ceil(card.interval * ease);
  }
  interval = Math.min(interval, 3650);
  return { interval, repetitions, ease, dueAt: new Date(now.getTime() + (grade === 'again' ? 600000 : interval * 86400000)).toISOString() };
}

function planStudy(startDate, endDate, minutes, dailyMinutes) {
  integer(minutes, 1, 60000, 'Estimated minutes');
  integer(dailyMinutes, 15, 480, 'Daily study minutes');
  const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(startDate) || !validDate(endDate)) fail('Choose valid study dates.');
  const days = Math.floor((Date.parse(endDate) - Date.parse(startDate)) / 86400000);
  if (days < 1 || days > 366) fail('Choose a deadline between tomorrow and one year from the start date.');
  if (days * dailyMinutes < minutes) fail(`Only ${days * dailyMinutes} study minutes fit before the deadline. Increase your daily budget or start earlier.`);
  const steps = [];
  let remaining = minutes;
  for (let offset = 1; remaining > 0; offset++) {
    const amount = Math.min(remaining, dailyMinutes);
    steps.unshift({ date: new Date(Date.parse(endDate) - offset * 86400000).toISOString().slice(0, 10), minutes: amount });
    remaining -= amount;
  }
  return steps;
}

function createStudyService(filename) {
  const database = openDatabase(filename);
  const ready = database.exec(`PRAGMA foreign_keys = ON; ${STUDY_SCHEMA}`);
  let queue = ready;
  const serial = (operation) => { const result = queue.then(operation); queue = result.catch(() => {}); return result; };
  const transaction = async (operation) => {
    await database.run('BEGIN IMMEDIATE');
    try { const value = await operation(); await database.run('COMMIT'); return value; }
    catch (error) { await database.run('ROLLBACK'); throw error; }
  };
  const requireWorkspace = async (id) => {
    const [workspace] = await database.all('SELECT * FROM workspaces WHERE id = ?', [id]);
    if (!workspace) fail('Workspace not found.', 404);
    return workspace;
  };
  return {
    ready,
    list: () => serial(() => database.all('SELECT * FROM workspaces ORDER BY name COLLATE NOCASE')),
    save: (id, input) => serial(async () => {
      const name = textValue(input.name, 120, 'Workspace name');
      if (!['course', 'research'].includes(input.kind)) fail('Choose course or research.');
      const description = typeof input.description === 'string' ? input.description.trim().slice(0, 2000) : '';
      if (id) { await requireWorkspace(id); await database.run('UPDATE workspaces SET name = ?, kind = ?, description = ? WHERE id = ?', [name, input.kind, description, id]); }
      else { id = randomUUID(); await database.run('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?)', [id, name, input.kind, description, new Date().toISOString()]); }
      return requireWorkspace(id);
    }),
    remove: (id) => serial(async () => { await database.run('DELETE FROM workspaces WHERE id = ?', [id]); return { success: true }; }),
    detail: (id) => serial(async () => ({
      ...await requireWorkspace(id),
      notes: await database.all('SELECT notes.* FROM notes JOIN workspace_notes ON notes.id = noteId WHERE workspaceId = ?', [id]),
      deadlines: await database.all('SELECT deadlines.* FROM deadlines JOIN workspace_deadlines ON deadlines.id = deadlineId WHERE workspaceId = ? ORDER BY end', [id]),
      sessions: await database.all('SELECT history.* FROM history JOIN workspace_sessions ON history.id = historyId WHERE workspaceId = ? ORDER BY date DESC', [id]),
      readings: await database.all('SELECT * FROM readings WHERE workspaceId = ?', [id]),
      steps: await database.all('SELECT * FROM study_steps WHERE workspaceId = ? ORDER BY date', [id]),
    })),
    link: (id, kind, target, remove = false) => serial(async () => {
      const mapping = { notes: ['workspace_notes', 'noteId'], deadlines: ['workspace_deadlines', 'deadlineId'], sessions: ['workspace_sessions', 'historyId'] };
      if (!mapping[kind]) fail('Unknown workspace item.');
      await requireWorkspace(id);
      const [table, column] = mapping[kind];
      if (remove) await database.run(`DELETE FROM ${table} WHERE workspaceId = ? AND ${column} = ?`, [id, target]);
      else await database.run(`INSERT OR IGNORE INTO ${table} (workspaceId, ${column}) VALUES (?, ?)`, [id, textValue(String(target || ''), 160, 'Item')]);
      return { success: true };
    }),
    reading: (id, input) => serial(async () => {
      await requireWorkspace(id);
      const title = textValue(input.title, 200, 'Reading title');
      let url;
      try { url = new URL(input.url); } catch { fail('Enter a valid reading URL.'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('Use an HTTP or HTTPS reading URL.');
      await database.run('INSERT INTO readings (id, workspaceId, title, url) VALUES (?, ?, ?, ?)', [randomUUID(), id, title, url.href]);
      return { success: true };
    }),
    checkItem: (kind, id, completed, remove) => serial(async () => {
      if (!['readings', 'study_steps'].includes(kind)) fail('Unknown item.');
      if (remove) await database.run(`DELETE FROM ${kind} WHERE id = ?`, [id]);
      else { if (typeof completed !== 'boolean') fail('Completed must be true or false.'); await database.run(`UPDATE ${kind} SET completed = ? WHERE id = ?`, [Number(completed), id]); }
      return { success: true };
    }),
    plan: (id, input) => serial(() => transaction(async () => {
      await requireWorkspace(id);
      const [deadline] = await database.all('SELECT deadlines.* FROM deadlines JOIN workspace_deadlines ON deadlines.id = deadlineId WHERE workspaceId = ? AND deadlineId = ?', [id, input.deadlineId]);
      if (!deadline) fail('Link the deadline to this workspace first.');
      let endDate = deadline.end.slice(0, 10);
      if (deadline.end.length > 10) {
        try { endDate = new Intl.DateTimeFormat('en-CA', { timeZone: input.timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(deadline.end)); }
        catch { fail('Invalid time zone.'); }
      }
      const [existing] = await database.all('SELECT id FROM study_steps WHERE workspaceId = ? AND deadlineId = ?', [id, deadline.id]);
      if (existing) fail('A plan already exists for this deadline. Remove its steps before generating another.', 409);
      const steps = planStudy(input.startDate, endDate, input.minutes, input.dailyMinutes);
      for (const step of steps) await database.run('INSERT INTO study_steps (id, workspaceId, deadlineId, title, date, minutes, targetEnd) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomUUID(), id, deadline.id, `Study: ${deadline.title}`, step.date, step.minutes, deadline.end]);
      return { steps };
    })),
    cards: (workspaceId) => serial(() => database.all(`SELECT * FROM flashcards ${workspaceId ? 'WHERE workspaceId = ?' : ''} ORDER BY dueAt`, workspaceId ? [workspaceId] : [])),
    saveCard: (id, input) => serial(async () => {
      const question = textValue(input.question, 2000, 'Question');
      const answer = textValue(input.answer, 12000, 'Answer');
      if (id) {
        integer(input.revision, 1, Number.MAX_SAFE_INTEGER, 'Card revision');
        const result = await database.run('UPDATE flashcards SET question = ?, answer = ?, workspaceId = ?, revision = revision + 1 WHERE id = ? AND revision = ?', [question, answer, input.workspaceId || null, id, input.revision]);
        if (!result.changes) fail('This card changed in another window. Reload before saving.', 409);
      } else {
        id = randomUUID();
        const now = new Date().toISOString();
        await database.run('INSERT INTO flashcards (id, workspaceId, noteId, glossaryId, question, answer, dueAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, input.workspaceId || null, input.noteId || null, input.glossaryId || null, question, answer, now, now]);
      }
      return (await database.all('SELECT * FROM flashcards WHERE id = ?', [id]))[0];
    }),
    removeCard: (id) => serial(async () => { await database.run('DELETE FROM flashcards WHERE id = ?', [id]); return { success: true }; }),
    review: (id, input) => serial(() => transaction(async () => {
      const [card] = await database.all('SELECT * FROM flashcards WHERE id = ?', [id]);
      if (!card) fail('Card not found.', 404);
      if (card.revision !== input.revision) fail('This card was already changed or reviewed. Reload the queue.', 409);
      const now = new Date();
      if (Date.parse(card.dueAt) > now.getTime()) fail('This card is not due yet.', 409);
      const next = scheduleReview(card, input.grade, now);
      await database.run('UPDATE flashcards SET dueAt = ?, interval = ?, ease = ?, repetitions = ?, revision = revision + 1 WHERE id = ?', [next.dueAt, next.interval, next.ease, next.repetitions, id]);
      await database.run('INSERT INTO card_reviews VALUES (?, ?, ?, ?)', [randomUUID(), id, input.grade, now.toISOString()]);
      return { ...card, ...next, revision: card.revision + 1 };
    })),
    summary: () => serial(async () => ({
      cards: await database.all('SELECT id, question, workspaceId, dueAt FROM flashcards ORDER BY dueAt'),
      steps: await database.all('SELECT * FROM study_steps WHERE completed = 0 ORDER BY date'),
      reviews: await database.all('SELECT reviewedAt FROM card_reviews WHERE reviewedAt >= ?', [new Date(Date.now() - 366 * 86400000).toISOString()]),
    })),
    close: () => serial(() => database.close()),
  };
}

function registerStudy(app, service) {
  app.get('/api/workspaces', handler(() => service.list()));
  app.post('/api/workspaces', handler((req) => service.save(null, req.body)));
  app.get('/api/workspaces/:id', handler((req) => service.detail(req.params.id)));
  app.put('/api/workspaces/:id', handler((req) => service.save(req.params.id, req.body)));
  app.delete('/api/workspaces/:id', handler((req) => service.remove(req.params.id)));
  app.post('/api/workspaces/:id/links/:kind', handler((req) => service.link(req.params.id, req.params.kind, req.body.targetId)));
  app.delete('/api/workspaces/:id/links/:kind/:target', handler((req) => service.link(req.params.id, req.params.kind, req.params.target, true)));
  app.post('/api/workspaces/:id/readings', handler((req) => service.reading(req.params.id, req.body)));
  app.post('/api/workspaces/:id/plan', handler((req) => service.plan(req.params.id, req.body)));
  app.put('/api/study/items/:kind/:id', handler((req) => service.checkItem(req.params.kind, req.params.id, req.body.completed)));
  app.delete('/api/study/items/:kind/:id', handler((req) => service.checkItem(req.params.kind, req.params.id, null, true)));
  app.get('/api/study/cards', handler((req) => service.cards(req.query.workspaceId)));
  app.post('/api/study/cards', handler((req) => service.saveCard(null, req.body)));
  app.put('/api/study/cards/:id', handler((req) => service.saveCard(req.params.id, req.body)));
  app.delete('/api/study/cards/:id', handler((req) => service.removeCard(req.params.id)));
  app.post('/api/study/cards/:id/review', handler((req) => service.review(req.params.id, req.body)));
  app.get('/api/study/summary', handler(() => service.summary()));
}

module.exports = { STUDY_SCHEMA, createStudyService, registerStudy, scheduleReview, planStudy };
