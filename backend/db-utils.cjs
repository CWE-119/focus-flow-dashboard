const sqlite3 = require('sqlite3');

function openDatabase(filename) {
  const database = new sqlite3.Database(filename);
  database.configure('busyTimeout', 10000);
  return {
    run: (sql, params = []) => new Promise((resolve, reject) => database.run(sql, params, function(error) {
      if (error) reject(error); else resolve(this);
    })),
    all: (sql, params = []) => new Promise((resolve, reject) => database.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows))),
    exec: (sql) => new Promise((resolve, reject) => database.exec(sql, (error) => error ? reject(error) : resolve())),
    close: () => new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve())),
  };
}

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const textValue = (value, max, label) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${label} must be between 1 and ${max} characters.`);
  return value.trim();
};
const integer = (value, min, max, label) => {
  if (!Number.isInteger(value) || value < min || value > max) fail(`${label} must be ${min}–${max}.`);
  return value;
};
const handler = (operation) => async (req, res) => {
  try { res.json(await operation(req, res)); }
  catch (error) { res.status(error.status || (error.code === 'SQLITE_CONSTRAINT' ? 409 : 500)).json({ error: error.code ? 'Could not save data; check that linked items still exist.' : error.message }); }
};

function localOnly(req, res, next) {
  res.set('Cache-Control', 'no-store');
  const allowed = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', process.env.FOCUSFLOW_FRONTEND_ORIGIN];
  const origin = req.get('Origin');
  if (origin === 'null' && (!process.env.FOCUSFLOW_LOCAL_TOKEN || req.get('X-FocusFlow-Desktop-Token') !== process.env.FOCUSFLOW_LOCAL_TOKEN)) {
    return res.status(403).json({ error: 'Open this setting in the FocusFlow desktop app or local browser app.' });
  }
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || (origin && origin !== 'null' && !allowed.includes(origin))) {
    return res.status(403).json({ error: 'Open this setting in the local FocusFlow app.' });
  }
  if (req.method !== 'GET' && req.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return res.status(415).json({ error: 'JSON required.' });
  next();
}

module.exports = { openDatabase, fail, textValue, integer, handler, localOnly };
