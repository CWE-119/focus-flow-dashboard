// Focus Flow Backend - SQLite Edition
// Pure Node.js - no TypeScript compilation needed

const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

let server;

// Initialize SQLite Database
// In development we keep the DB in the backend folder.
// In production (Electron) we prefer a writable userData directory,
// which is passed in via FOCUSFLOW_DB_PATH from the Electron main process.
const dbPath = process.env.FOCUSFLOW_DB_PATH || path.join(__dirname, 'focusflow.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('✗ Database error:', err.message);
    process.exit(1);
  }
  console.log('✓ SQLite Database connected:', dbPath);

  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA synchronous = NORMAL');

  // Create tables if they don't exist
  const initSQL = `
    CREATE TABLE IF NOT EXISTS todos (
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

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      folderId INTEGER,
      revision INTEGER DEFAULT 1,
      pinned INTEGER DEFAULT 0,
      lastViewedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS note_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      noteId INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      folderId INTEGER,
      revision INTEGER,
      savedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS note_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sourceNoteId INTEGER NOT NULL,
      targetTitle TEXT NOT NULL,
      targetNormalized TEXT NOT NULL,
      targetNoteId INTEGER,
      raw TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sourceNoteId) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (targetNoteId) REFERENCES notes(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS note_mentions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sourceNoteId INTEGER NOT NULL,
      targetNoteId INTEGER NOT NULL,
      targetNormalized TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      excerpt TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sourceNoteId) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (targetNoteId) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      data TEXT,
      date TEXT,
      duration INTEGER,
      startTime TEXT,
      endTime TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      duration INTEGER,
      date TEXT,
      focusTime INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      dueDate DATETIME,
      completed INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS drawings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      data TEXT NOT NULL,
      thumbnail TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      noteId TEXT NOT NULL UNIQUE,
      data TEXT NOT NULL,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.exec(initSQL, (err) => {
    if (err) {
      console.error('✗ Error initializing tables:', err);
      startServer();
      return;
    }

    console.log('✓ Database tables initialized');

    // Perform lightweight migrations: add missing columns if present tables are older schema
    function ensureColumn(table, columnDef, columnName, cb) {
      db.all(`PRAGMA table_info(${table})`, (err, rows) => {
        if (err) return cb(err);
        const has = rows && rows.some(r => r.name === columnName);
        if (has) return cb(null, false);
        const alterSQL = `ALTER TABLE ${table} ADD COLUMN ${columnDef}`;
        db.run(alterSQL, (err) => cb(err, true));
      });
    }

    function runStartupStatements(statements, done) {
      let statementIndex = 0;
      function runNext() {
        if (statementIndex >= statements.length) {
          done();
          return;
        }
        const statement = statements[statementIndex++];
        db.run(statement, (err) => {
          if (err) console.warn('⚠ Startup SQL failed:', err.message);
          runNext();
        });
      }
      runNext();
    }

    function finishStartup() {
      runStartupStatements([
        'CREATE INDEX IF NOT EXISTS idx_history_date ON history(date)',
        'CREATE INDEX IF NOT EXISTS idx_history_action_date ON history(action, date)',
        'CREATE INDEX IF NOT EXISTS idx_history_createdAt ON history(createdAt)',
        'CREATE INDEX IF NOT EXISTS idx_notes_folderId ON notes(folderId)',
        'CREATE INDEX IF NOT EXISTS idx_notes_updatedAt ON notes(updatedAt)',
        'CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title)',
        'CREATE INDEX IF NOT EXISTS idx_notes_pinned_updatedAt ON notes(pinned, updatedAt)',
        'CREATE INDEX IF NOT EXISTS idx_note_versions_noteId_savedAt ON note_versions(noteId, savedAt)',
        'CREATE INDEX IF NOT EXISTS idx_note_links_source ON note_links(sourceNoteId)',
        'CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(targetNoteId)',
        'CREATE INDEX IF NOT EXISTS idx_note_links_target_normalized ON note_links(targetNormalized)',
        'CREATE INDEX IF NOT EXISTS idx_note_mentions_source ON note_mentions(sourceNoteId)',
        'CREATE INDEX IF NOT EXISTS idx_note_mentions_target ON note_mentions(targetNoteId)',
        `INSERT OR IGNORE INTO schema_migrations (id) VALUES
         ('001_initial_runtime_schema'),
         ('002_notes_revision_pin_recent'),
         ('003_note_link_indexes')`,
      ], () => {
        rebuildAllNoteIndexes();
        startServer();
      });
    }

    // Ensure folders.color and history-related columns
    ensureColumn('folders', 'color TEXT', 'color', (errFolders, addedFolders) => {
      if (errFolders) console.warn('⚠ Could not ensure folders.color:', errFolders.message);
      else if (addedFolders) console.log('✓ Added missing column folders.color');

      // Ensure history.createdAt (can't add column with non-constant default in SQLite)
      ensureColumn('history', 'createdAt DATETIME', 'createdAt', (err, added) => {
        if (err) console.warn('⚠ Could not ensure history.createdAt:', err.message);
        else if (added) {
          console.log('✓ Added missing column history.createdAt');
          // backfill existing rows with current timestamp
          db.run("UPDATE history SET createdAt = CURRENT_TIMESTAMP WHERE createdAt IS NULL", (uerr) => {
            if (uerr) console.warn('⚠ Could not backfill history.createdAt:', uerr.message);
          });
        }

        // Ensure reminders.dueDate
        ensureColumn('reminders', 'dueDate DATETIME', 'dueDate', (err2, added2) => {
          if (err2) console.warn('⚠ Could not ensure reminders.dueDate:', err2.message);
          else if (added2) console.log('✓ Added missing column reminders.dueDate');

          const historyColumns = [
            ['action TEXT', 'action'],
            ['data TEXT', 'data'],
            ['date TEXT', 'date'],
            ['duration INTEGER', 'duration'],
            ['startTime TEXT', 'startTime'],
            ['endTime TEXT', 'endTime'],
          ];
          let historyIdx = 0;
          function ensureNextHistoryCol(done) {
            if (historyIdx >= historyColumns.length) {
              done();
              return;
            }
            const [colDef, colName] = historyColumns[historyIdx++];
            ensureColumn('history', colDef, colName, (err, added) => {
              if (err) console.warn(`⚠ Could not ensure history.${colName}:`, err.message);
              else if (added) console.log(`✓ Added missing column history.${colName}`);
              ensureNextHistoryCol(done);
            });
          }

          const noteColumns = [
            ['revision INTEGER DEFAULT 1', 'revision'],
            ['pinned INTEGER DEFAULT 0', 'pinned'],
            ['lastViewedAt DATETIME', 'lastViewedAt'],
          ];
          let noteIdx = 0;
          function ensureNextNoteCol(done) {
            if (noteIdx >= noteColumns.length) {
              done();
              return;
            }
            const [colDef, colName] = noteColumns[noteIdx++];
            ensureColumn('notes', colDef, colName, (err, added) => {
              if (err) console.warn(`⚠ Could not ensure notes.${colName}:`, err.message);
              else if (added) console.log(`✓ Added missing column notes.${colName}`);
              ensureNextNoteCol(done);
            });
          }

          // Ensure todos repeat/dueDate fields
          const todoColumns = [
            ['dueDate TEXT', 'dueDate'],
            ['repeatType TEXT', 'repeatType'],
            ['repeatInterval INTEGER', 'repeatInterval'],
            ['repeatDays TEXT', 'repeatDays'],
            ['repeatLimit INTEGER', 'repeatLimit'],
            ['repeatCount INTEGER', 'repeatCount'],
            ['repeatEndDate TEXT', 'repeatEndDate'],
          ];
          let idx = 0;
          function ensureNextTodoCol() {
            if (idx >= todoColumns.length) {
              ensureNextNoteCol(finishStartup);
              return;
            }
            const [colDef, colName] = todoColumns[idx++];
            ensureColumn('todos', colDef, colName, (err, added) => {
              if (err) console.warn(`⚠ Could not ensure todos.${colName}:`, err.message);
              else if (added) console.log(`✓ Added missing column todos.${colName}`);
              ensureNextTodoCol();
            });
          }

          ensureNextHistoryCol(ensureNextTodoCol);
        });
      });
    });
  });
});

// API Routes

// Todos
app.get('/api/todos', (req, res) => {
  db.all('SELECT * FROM todos ORDER BY createdAt DESC', (err, rows) => {
    if (err) {
      console.error('Error fetching todos:', err);
      return res.status(500).json({ error: 'Failed to fetch todos' });
    }
    res.json(rows || []);
  });
});

app.post('/api/todos', (req, res) => {
  const { title, completed, priority, dueDate, repeatType, repeatInterval, repeatDays, repeatLimit, repeatEndDate } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const repeatDaysStr = repeatDays ? JSON.stringify(repeatDays) : null;
  db.run(
    `INSERT INTO todos (title, completed, priority, dueDate, repeatType, repeatInterval, repeatDays, repeatLimit, repeatCount, repeatEndDate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      title.trim(),
      completed ? 1 : 0,
      priority || 'medium',
      dueDate || null,
      repeatType || 'none',
      repeatInterval || null,
      repeatDaysStr,
      repeatLimit || null,
      repeatEndDate || null,
    ],
    function(err) {
      if (err) {
        console.error('Error creating todo:', err);
        return res.status(500).json({ error: 'Failed to create todo' });
      }
      db.get('SELECT * FROM todos WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: 'Failed to fetch created todo' });
        res.status(201).json(row);
      });
    }
  );
});

app.put('/api/todos/:id', (req, res) => {
  const { title, completed, priority, dueDate, repeatType, repeatInterval, repeatDays, repeatLimit, repeatCount, repeatEndDate } = req.body;
  const updates = [];
  const values = [];

  if (title !== undefined) { updates.push('title = ?'); values.push(title); }
  if (completed !== undefined) { updates.push('completed = ?'); values.push(completed ? 1 : 0); }
  if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
  if (dueDate !== undefined) { updates.push('dueDate = ?'); values.push(dueDate || null); }
  if (repeatType !== undefined) { updates.push('repeatType = ?'); values.push(repeatType); }
  if (repeatInterval !== undefined) { updates.push('repeatInterval = ?'); values.push(repeatInterval || null); }
  if (repeatDays !== undefined) { updates.push('repeatDays = ?'); values.push(repeatDays ? JSON.stringify(repeatDays) : null); }
  if (repeatLimit !== undefined) { updates.push('repeatLimit = ?'); values.push(repeatLimit || null); }
  if (repeatCount !== undefined) { updates.push('repeatCount = ?'); values.push(repeatCount); }
  if (repeatEndDate !== undefined) { updates.push('repeatEndDate = ?'); values.push(repeatEndDate || null); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  updates.push('updatedAt = CURRENT_TIMESTAMP');
  values.push(req.params.id);

  db.run(`UPDATE todos SET ${updates.join(', ')} WHERE id = ?`, values, function(err) {
    if (err) {
      console.error('Error updating todo:', err);
      return res.status(500).json({ error: 'Failed to update todo' });
    }
    db.get('SELECT * FROM todos WHERE id = ?', [req.params.id], (err2, row) => {
      if (err2) return res.status(500).json({ error: 'Failed to fetch updated todo' });
      res.json(row);
    });
  });
});

app.delete('/api/todos/:id', (req, res) => {
  db.run('DELETE FROM todos WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Error deleting todo:', err);
      return res.status(500).json({ error: 'Failed to delete todo' });
    }
    res.json({ success: true });
  });
});

const mapNoteRow = (row) => row ? ({ ...row, _id: row.id, pinned: Boolean(row.pinned) }) : row;

const normalizeTitle = (value = '') =>
  String(value)
    .trim()
    .replace(/\.md$/i, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

const displayWikiTarget = (value = '') => String(value).trim().replace(/\.md$/i, '');

const parseWikiLinks = (content = '') => {
  const links = [];
  const seen = new Set();
  const re = /!?\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = re.exec(content || ''))) {
    const [targetWithHeading] = String(match[1]).split('|');
    const [target] = targetWithHeading.split('#');
    const title = displayWikiTarget(target);
    const normalized = normalizeTitle(title);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    links.push({ raw: match[0], targetTitle: title, targetNormalized: normalized });
  }
  return links;
};

const stripCodeAndLinks = (content = '') =>
  String(content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[\[[^\]]+\]\]/g, ' ')
    .replace(/!?\[[^\]]*\]\([^)]+\)/g, ' ');

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const excerptAround = (content, index, length) => {
  const start = Math.max(0, index - 54);
  const end = Math.min(content.length, index + length + 72);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';
  return `${prefix}${content.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
};

const indexNoteWithStatements = (note, notes, linkStmt, mentionStmt) => {
  const titleToNote = new Map();
  (notes || []).forEach((candidate) => titleToNote.set(normalizeTitle(candidate.title), candidate));

  const linkedTargets = new Set();
  parseWikiLinks(note.content).forEach((link) => {
    const target = titleToNote.get(link.targetNormalized);
    linkedTargets.add(link.targetNormalized);
    linkStmt.run(note.id, link.targetTitle, link.targetNormalized, target?.id || null, link.raw);
  });

  const searchable = stripCodeAndLinks(note.content);
  (notes || []).forEach((target) => {
    if (target.id === note.id) return;
    const normalized = normalizeTitle(target.title);
    if (!normalized || linkedTargets.has(normalized)) return;

    const title = displayWikiTarget(target.title);
    if (title.length < 2) return;
    const pattern = escapeRegExp(title).replace(/\s+/g, '\\s+');
    const hasWordEdges = /^[\w\s-]+$/.test(title);
    const re = hasWordEdges
      ? new RegExp(`(^|[^\\p{L}\\p{N}_])(${pattern})(?=$|[^\\p{L}\\p{N}_])`, 'giu')
      : new RegExp(`(${pattern})`, 'giu');
    let count = 0;
    let firstIndex = -1;
    let match;
    while ((match = re.exec(searchable))) {
      count += 1;
      if (firstIndex === -1) firstIndex = match.index;
    }
    if (count > 0) {
      mentionStmt.run(note.id, target.id, normalized, count, excerptAround(searchable, firstIndex, title.length));
    }
  });
};

const rebuildAllNoteIndexes = () => {
  db.all('SELECT * FROM notes', (err, notes) => {
    if (err) {
      console.warn('⚠ Could not rebuild note indexes:', err.message);
      return;
    }

    db.serialize(() => {
      db.run('DELETE FROM note_links');
      db.run('DELETE FROM note_mentions');

      const linkStmt = db.prepare(
        `INSERT INTO note_links (sourceNoteId, targetTitle, targetNormalized, targetNoteId, raw)
         VALUES (?, ?, ?, ?, ?)`
      );
      const mentionStmt = db.prepare(
        `INSERT INTO note_mentions (sourceNoteId, targetNoteId, targetNormalized, count, excerpt)
         VALUES (?, ?, ?, ?, ?)`
      );

      (notes || []).forEach((note) => {
        indexNoteWithStatements(note, notes, linkStmt, mentionStmt);
      });

      linkStmt.finalize();
      mentionStmt.finalize();
    });
  });
};

const refreshNoteIndex = (noteId, cb) => {
  db.all('SELECT * FROM notes', (err, notes) => {
    if (err) {
      console.warn('⚠ Could not refresh note index:', err.message);
      if (cb) cb(err);
      return;
    }
    const note = (notes || []).find((candidate) => String(candidate.id) === String(noteId));
    if (!note) {
      if (cb) cb();
      return;
    }

    db.serialize(() => {
      db.run('DELETE FROM note_links WHERE sourceNoteId = ?', [noteId], (linkDeleteErr) => {
        if (linkDeleteErr) console.warn('⚠ Could not clear note links:', linkDeleteErr.message);
        db.run('DELETE FROM note_mentions WHERE sourceNoteId = ?', [noteId], (mentionDeleteErr) => {
          if (mentionDeleteErr) console.warn('⚠ Could not clear note mentions:', mentionDeleteErr.message);

          const linkStmt = db.prepare(
            `INSERT INTO note_links (sourceNoteId, targetTitle, targetNormalized, targetNoteId, raw)
             VALUES (?, ?, ?, ?, ?)`
          );
          const mentionStmt = db.prepare(
            `INSERT INTO note_mentions (sourceNoteId, targetNoteId, targetNormalized, count, excerpt)
             VALUES (?, ?, ?, ?, ?)`
          );

          indexNoteWithStatements(note, notes, linkStmt, mentionStmt);
          linkStmt.finalize();
          mentionStmt.finalize((finalizeErr) => {
            if (finalizeErr) console.warn('⚠ Could not finalize note index refresh:', finalizeErr.message);
            if (cb) cb(finalizeErr || mentionDeleteErr || linkDeleteErr || null);
          });
        });
      });
    });
  });
};

const createNoteVersion = (note, cb) => {
  if (!note) return cb && cb();
  db.run(
    `INSERT INTO note_versions (noteId, title, content, folderId, revision)
     VALUES (?, ?, ?, ?, ?)`,
    [note.id, note.title, note.content || '', note.folderId || null, note.revision || 1],
    (err) => {
      if (err) console.warn('⚠ Could not snapshot note version:', err.message);
      if (cb) cb();
    }
  );
};

// Notes
app.get('/api/notes', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 1000, 2000);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const q = String(req.query.q || '').trim();
  const folderId = req.query.folderId;
  const sort = req.query.sort === 'updated' ? 'updatedAt' : 'createdAt';
  const where = [];
  const params = [];

  if (q) {
    where.push('(title LIKE ? OR content LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (folderId) {
    where.push('folderId = ?');
    params.push(folderId);
  }

  params.push(limit, offset);
  const sql = `
    SELECT * FROM notes
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY pinned DESC, ${sort} DESC
    LIMIT ? OFFSET ?
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error fetching notes:', err);
      return res.status(500).json({ error: 'Failed to fetch notes' });
    }
    res.json((rows || []).map(mapNoteRow));
  });
});

// Get notes by folder
app.get('/api/notes/folder/:folderId', (req, res) => {
  const folderId = req.params.folderId;
  db.all('SELECT * FROM notes WHERE folderId = ? ORDER BY createdAt DESC', [folderId], (err, rows) => {
    if (err) {
      console.error('Error fetching notes by folder:', err);
      return res.status(500).json({ error: 'Failed to fetch notes' });
    }
    res.json((rows || []).map(mapNoteRow));
  });
});

// Get single note
app.get('/api/notes/:id', (req, res) => {
  db.get('SELECT * FROM notes WHERE id = ? OR _id = ?', [req.params.id, req.params.id], (err, row) => {
    if (err) {
      console.error('Error fetching note:', err);
      return res.status(500).json({ error: 'Failed to fetch note' });
    }
    if (!row) return res.status(404).json({ error: 'Note not found' });
    res.json(mapNoteRow(row));
  });
});

app.post('/api/notes/:id/view', (req, res) => {
  db.run('UPDATE notes SET lastViewedAt = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to mark note viewed' });
    res.json({ success: true });
  });
});

app.get('/api/notes/:id/references', (req, res) => {
  const noteId = req.params.id;
  const response = {
    backlinks: [],
    outgoingLinks: [],
    missingLinks: [],
    unlinkedMentions: [],
  };

  db.all(
    `SELECT nl.*, n.id, n.title, n.content, n.folderId, n.updatedAt
     FROM note_links nl
     LEFT JOIN notes n ON n.id = nl.targetNoteId
     WHERE nl.sourceNoteId = ?
     ORDER BY nl.targetTitle COLLATE NOCASE ASC`,
    [noteId],
    (outErr, outgoingRows) => {
      if (outErr) return res.status(500).json({ error: 'Failed to fetch outgoing links' });
      response.outgoingLinks = (outgoingRows || []).filter((row) => row.targetNoteId).map((row) => ({
        target: row.targetTitle,
        type: 'note',
        note: mapNoteRow(row),
      }));
      response.missingLinks = (outgoingRows || []).filter((row) => !row.targetNoteId).map((row) => ({
        target: row.targetTitle,
        type: 'missing',
      }));

      db.all(
        `SELECT n.*
         FROM note_links nl
         JOIN notes n ON n.id = nl.sourceNoteId
         WHERE nl.targetNoteId = ?
         ORDER BY n.updatedAt DESC`,
        [noteId],
        (backErr, backlinkRows) => {
          if (backErr) return res.status(500).json({ error: 'Failed to fetch backlinks' });
          response.backlinks = (backlinkRows || []).map(mapNoteRow);

          db.all(
            `SELECT nm.count, nm.excerpt, n.*
             FROM note_mentions nm
             JOIN notes n ON n.id = nm.sourceNoteId
             WHERE nm.targetNoteId = ?
             ORDER BY nm.count DESC, n.title COLLATE NOCASE ASC`,
            [noteId],
            (mentionErr, mentionRows) => {
              if (mentionErr) return res.status(500).json({ error: 'Failed to fetch mentions' });
              response.unlinkedMentions = (mentionRows || []).map((row) => ({
                count: row.count,
                excerpt: row.excerpt,
                note: mapNoteRow(row),
              }));
              res.json(response);
            }
          );
        }
      );
    }
  );
});

app.get('/api/graph', (req, res) => {
  db.all('SELECT * FROM notes ORDER BY updatedAt DESC', (noteErr, notes) => {
    if (noteErr) return res.status(500).json({ error: 'Failed to fetch graph notes' });
    db.all('SELECT sourceNoteId, targetNoteId, targetTitle, targetNormalized FROM note_links', (linkErr, links) => {
      if (linkErr) return res.status(500).json({ error: 'Failed to fetch graph links' });
      res.json({
        notes: (notes || []).map(mapNoteRow),
        links: links || [],
      });
    });
  });
});

app.get('/api/notes/:id/versions', (req, res) => {
  db.all(
    'SELECT * FROM note_versions WHERE noteId = ? ORDER BY savedAt DESC LIMIT 50',
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch note versions' });
      res.json(rows || []);
    }
  );
});

app.post('/api/notes/:id/restore/:versionId', (req, res) => {
  db.get('SELECT * FROM notes WHERE id = ?', [req.params.id], (err, current) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch current note' });
    if (!current) return res.status(404).json({ error: 'Note not found' });

    db.get('SELECT * FROM note_versions WHERE id = ? AND noteId = ?', [req.params.versionId, req.params.id], (err2, version) => {
      if (err2) return res.status(500).json({ error: 'Failed to fetch note version' });
      if (!version) return res.status(404).json({ error: 'Version not found' });

      createNoteVersion(current, () => {
        db.run(
          `UPDATE notes
           SET title = ?, content = ?, folderId = ?, revision = COALESCE(revision, 1) + 1, updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [version.title, version.content || '', version.folderId || null, req.params.id],
          function(updateErr) {
            if (updateErr) return res.status(500).json({ error: 'Failed to restore note version' });
            db.get('SELECT * FROM notes WHERE id = ?', [req.params.id], (fetchErr, row) => {
              if (fetchErr) return res.status(500).json({ error: 'Failed to fetch restored note' });
              if (normalizeTitle(current.title) !== normalizeTitle(row.title)) {
                rebuildAllNoteIndexes();
              } else {
                refreshNoteIndex(req.params.id);
              }
              res.json(mapNoteRow(row));
            });
          }
        );
      });
    });
  });
});

// Update note
app.put('/api/notes/:id', (req, res) => {
  const { title, content, folderId, pinned, clientUpdatedAt } = req.body;
  db.get('SELECT * FROM notes WHERE id = ?', [req.params.id], (err, current) => {
    if (err) {
      console.error('Error fetching note before update:', err);
      return res.status(500).json({ error: 'Failed to update note' });
    }
    if (!current) return res.status(404).json({ error: 'Note not found' });
    if (clientUpdatedAt && current.updatedAt && String(clientUpdatedAt) !== String(current.updatedAt)) {
      return res.status(409).json({ error: 'Note changed in another window', current: mapNoteRow(current) });
    }

    const updates = [];
    const values = [];
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (content !== undefined) { updates.push('content = ?'); values.push(content); }
    if (folderId !== undefined) { updates.push('folderId = ?'); values.push(folderId); }
    if (pinned !== undefined) { updates.push('pinned = ?'); values.push(pinned ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('revision = COALESCE(revision, 1) + 1');
    updates.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    createNoteVersion(current, () => {
      const sql = `UPDATE notes SET ${updates.join(', ')} WHERE id = ?`;
      db.run(sql, values, function(updateErr) {
        if (updateErr) {
          console.error('Error updating note:', updateErr);
          return res.status(500).json({ error: 'Failed to update note' });
        }
        db.get('SELECT * FROM notes WHERE id = ?', [req.params.id], (err2, row) => {
          if (err2) {
            console.error('Error fetching updated note:', err2);
            return res.status(500).json({ error: 'Failed to fetch updated note' });
          }
          if (title !== undefined && normalizeTitle(title) !== normalizeTitle(current.title)) {
            rebuildAllNoteIndexes();
          } else if (content !== undefined) {
            refreshNoteIndex(req.params.id);
          }
          res.json(mapNoteRow(row));
        });
      });
    });
  });
});

// Delete note
app.delete('/api/notes/:id', (req, res) => {
  db.run('DELETE FROM notes WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Error deleting note:', err);
      return res.status(500).json({ error: 'Failed to delete note' });
    }
    res.json({ success: true });
  });
});

app.post('/api/notes', (req, res) => {
  const { title, content, folderId, pinned } = req.body;
  db.run(
    'INSERT INTO notes (title, content, folderId, pinned) VALUES (?, ?, ?, ?)',
    [title, content, folderId || null, pinned ? 1 : 0],
    function(err) {
      if (err) {
        console.error('Error creating note:', err);
        return res.status(500).json({ error: 'Failed to create note' });
      }
      db.get('SELECT * FROM notes WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: 'Failed to fetch created note' });
        rebuildAllNoteIndexes();
        res.status(201).json(mapNoteRow(row));
      });
    }
  );
});

// Folders
app.get('/api/folders', (req, res) => {
  db.all('SELECT * FROM folders ORDER BY createdAt DESC', (err, rows) => {
    if (err) {
      console.error('Error fetching folders:', err);
      return res.status(500).json({ error: 'Failed to fetch folders' });
    }
    res.json(rows || []);
  });
});

app.post('/api/folders', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const finalColor = color || '#3b82f6'; // default blue if not provided

  db.run(
    'INSERT INTO folders (name, color) VALUES (?, ?)',
    [name, finalColor],
    function(err) {
      if (err) {
        console.error('Error creating folder:', err);
        return res.status(500).json({ error: 'Failed to create folder' });
      }
      res.status(201).json({ id: this.lastID, name, color: finalColor });
    }
  );
});

// Update folder (name, color)
app.put('/api/folders/:id', (req, res) => {
  const { name, color } = req.body;
  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (color !== undefined) {
    updates.push('color = ?');
    values.push(color);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.id);
  const sql = `UPDATE folders SET ${updates.join(', ')} WHERE id = ?`;

  db.run(sql, values, function(err) {
    if (err) {
      console.error('Error updating folder:', err);
      return res.status(500).json({ error: 'Failed to update folder' });
    }
    db.get('SELECT * FROM folders WHERE id = ?', [req.params.id], (err2, row) => {
      if (err2) {
        console.error('Error fetching updated folder:', err2);
        return res.status(500).json({ error: 'Failed to fetch updated folder' });
      }
      res.json(row || {});
    });
  });
});

// Delete folder and its notes
app.delete('/api/folders/:id', (req, res) => {
  const folderId = req.params.id;

  // Delete notes belonging to this folder, then the folder itself
  db.serialize(() => {
    db.run('DELETE FROM notes WHERE folderId = ?', [folderId], (err) => {
      if (err) {
        console.error('Error deleting folder notes:', err);
        return res.status(500).json({ error: 'Failed to delete folder notes' });
      }

      db.run('DELETE FROM folders WHERE id = ?', [folderId], function(err2) {
        if (err2) {
          console.error('Error deleting folder:', err2);
          return res.status(500).json({ error: 'Failed to delete folder' });
        }
        res.json({ success: true });
      });
    });
  });
});

// History
app.get('/api/history', (req, res) => {
  db.all('SELECT * FROM history ORDER BY createdAt DESC LIMIT 500', (err, rows) => {
    if (err) {
      console.error('Error fetching history:', err);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }
    res.json(rows || []);
  });
});

app.get('/api/history/activity', (req, res) => {
  const sql = `
    SELECT date, startTime, endTime, duration, action
    FROM history
    WHERE action IN ('focus_session', 'note_session') AND date IS NOT NULL
    ORDER BY date DESC, createdAt DESC
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching activity history:', err);
      return res.status(500).json({ error: 'Failed to fetch activity history' });
    }

    res.json((rows || []).map((row) => ({
      date: row.date,
      start: row.startTime || '00:00',
      end: row.endTime || '00:00',
      duration: row.duration || 0,
      action: row.action,
    })));
  });
});

// Get history by specific date (YYYY-MM-DD)
app.get('/api/history/:date', (req, res) => {
  const { date } = req.params;
  db.all('SELECT * FROM history WHERE date = ? ORDER BY createdAt DESC', [date], (err, rows) => {
    if (err) {
      console.error('Error fetching history by date:', err);
      return res.status(500).json({ error: 'Failed to fetch history by date' });
    }
    res.json(rows || []);
  });
});

// Create history entry (used by focus timer sessions)
app.post('/api/history', (req, res) => {
  const { action, details, duration, startTime, endTime } = req.body;

  const now = new Date();
  const dateKey = req.body.date || now.toISOString().split('T')[0]; // YYYY-MM-DD
  const dataPayload = JSON.stringify({
    details,
    duration,
    startTime,
    endTime,
    metadata: req.body.metadata || null,
  });

  const sql = `
    INSERT INTO history (action, data, date, duration, startTime, endTime)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [action || 'activity', dataPayload, dateKey, Number(duration) || 0, startTime || null, endTime || null],
    function(err) {
      if (err) {
        console.error('Error creating history entry:', err);
        return res.status(500).json({ error: 'Failed to create history entry' });
      }

      db.get('SELECT * FROM history WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) {
          console.error('Error fetching created history entry:', err2);
          return res.status(500).json({ error: 'Failed to fetch created history entry' });
        }
        res.status(201).json(row);
      });
    }
  );
});

// Sessions
app.get('/api/sessions', (req, res) => {
  db.all('SELECT * FROM sessions ORDER BY createdAt DESC LIMIT 100', (err, rows) => {
    if (err) {
      console.error('Error fetching sessions:', err);
      return res.status(500).json({ error: 'Failed to fetch sessions' });
    }
    res.json(rows || []);
  });
});

app.post('/api/sessions', (req, res) => {
  const { duration, date, focusTime } = req.body;
  db.run(
    'INSERT INTO sessions (duration, date, focusTime) VALUES (?, ?, ?)',
    [duration, date, focusTime],
    function(err) {
      if (err) {
        console.error('Error creating session:', err);
        return res.status(500).json({ error: 'Failed to create session' });
      }
      res.status(201).json({ id: this.lastID, duration, date, focusTime });
    }
  );
});

// Reminders
app.get('/api/reminders', (req, res) => {
  // Expose "dueDate" as "date" to match frontend expectations
  const sql = `
    SELECT 
      id,
      title,
      description,
      dueDate AS date,
      completed,
      createdAt
    FROM reminders
    ORDER BY dueDate ASC
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching reminders:', err);
      return res.status(500).json({ error: 'Failed to fetch reminders' });
    }
    res.json(rows || []);
  });
});

// Get reminders by date (YYYY-MM-DD or ISO string)
app.get('/api/reminders/date/:date', (req, res) => {
  const { date } = req.params;
  db.all(
    'SELECT id, title, description, dueDate AS date, completed, createdAt FROM reminders WHERE DATE(dueDate) = DATE(?) ORDER BY dueDate ASC',
    [date],
    (err, rows) => {
      if (err) {
        console.error('Error fetching reminders by date:', err);
        return res.status(500).json({ error: 'Failed to fetch reminders by date' });
      }
      res.json(rows || []);
    }
  );
});

app.post('/api/reminders', (req, res) => {
  const { title, description, date, dueDate, completed } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const finalDueDate = dueDate || date || null;
  const isCompleted = completed ? 1 : 0;

  db.run(
    'INSERT INTO reminders (title, description, dueDate, completed) VALUES (?, ?, ?, ?)',
    [title, description, finalDueDate, isCompleted],
    function(err) {
      if (err) {
        console.error('Error creating reminder:', err);
        return res.status(500).json({ error: 'Failed to create reminder' });
      }

      db.get(
        'SELECT id, title, description, dueDate AS date, completed, createdAt FROM reminders WHERE id = ?',
        [this.lastID],
        (err2, row) => {
          if (err2) {
            console.error('Error fetching created reminder:', err2);
            return res.status(500).json({ error: 'Failed to fetch created reminder' });
          }
          res.status(201).json(row);
        }
      );
    }
  );
});

// Update reminder
app.put('/api/reminders/:id', (req, res) => {
  const { title, description, completed, date, dueDate } = req.body;
  const updates = [];
  const values = [];

  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (completed !== undefined) {
    updates.push('completed = ?');
    values.push(completed ? 1 : 0);
  }
  const finalDueDate = dueDate || date;
  if (finalDueDate !== undefined) {
    updates.push('dueDate = ?');
    values.push(finalDueDate);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.id);

  const sql = `UPDATE reminders SET ${updates.join(', ')} WHERE id = ?`;

  db.run(sql, values, function(err) {
    if (err) {
      console.error('Error updating reminder:', err);
      return res.status(500).json({ error: 'Failed to update reminder' });
    }

    db.get(
      'SELECT id, title, description, dueDate AS date, completed, createdAt FROM reminders WHERE id = ?',
      [req.params.id],
      (err2, row) => {
        if (err2) {
          console.error('Error fetching updated reminder:', err2);
          return res.status(500).json({ error: 'Failed to fetch updated reminder' });
        }
        res.json(row);
      }
    );
  });
});

// Delete reminder
app.delete('/api/reminders/:id', (req, res) => {
  db.run('DELETE FROM reminders WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Error deleting reminder:', err);
      return res.status(500).json({ error: 'Failed to delete reminder' });
    }
    res.json({ success: true });
  });
});

// Annotations
app.get('/api/annotations/:noteId', (req, res) => {
  db.get('SELECT data FROM annotations WHERE noteId = ?', [req.params.noteId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch annotations' });
    if (!row) return res.json({ annotations: [] });
    try {
      res.json(JSON.parse(row.data));
    } catch {
      res.json({ annotations: [] });
    }
  });
});

app.put('/api/annotations/:noteId', (req, res) => {
  const data = JSON.stringify(req.body);
  db.run(
    `INSERT INTO annotations (noteId, data, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(noteId) DO UPDATE SET data = excluded.data, updatedAt = CURRENT_TIMESTAMP`,
    [req.params.noteId, data],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to save annotations' });
      res.json({ success: true });
    }
  );
});

app.delete('/api/annotations/:noteId', (req, res) => {
  db.run('DELETE FROM annotations WHERE noteId = ?', [req.params.noteId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete annotations' });
    res.json({ success: true });
  });
});

// Drawings
app.get('/api/drawings', (req, res) => {
  db.all('SELECT id, title, thumbnail, createdAt, updatedAt FROM drawings ORDER BY createdAt DESC', (err, rows) => {
    if (err) {
      console.error('Error fetching drawings:', err);
      return res.status(500).json({ error: 'Failed to fetch drawings' });
    }
    res.json(rows || []);
  });
});

app.post('/api/drawings', (req, res) => {
  const { title, data, thumbnail } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (!data) {
    return res.status(400).json({ error: 'Drawing data is required' });
  }
  db.run(
    'INSERT INTO drawings (title, data, thumbnail) VALUES (?, ?, ?)',
    [title.trim(), data, thumbnail || null],
    function(err) {
      if (err) {
        console.error('Error creating drawing:', err);
        return res.status(500).json({ error: 'Failed to create drawing' });
      }
      db.get('SELECT * FROM drawings WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) {
          console.error('Error fetching created drawing:', err2);
          return res.status(500).json({ error: 'Failed to fetch created drawing' });
        }
        res.status(201).json(row);
      });
    }
  );
});

app.get('/api/drawings/:id', (req, res) => {
  db.get('SELECT * FROM drawings WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Error fetching drawing:', err);
      return res.status(500).json({ error: 'Failed to fetch drawing' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    res.json(row);
  });
});

app.put('/api/drawings/:id', (req, res) => {
  const { title, data, thumbnail } = req.body;
  const updates = [];
  const values = [];
  
  if (title !== undefined) { updates.push('title = ?'); values.push(title); }
  if (data !== undefined) { updates.push('data = ?'); values.push(data); }
  if (thumbnail !== undefined) { updates.push('thumbnail = ?'); values.push(thumbnail); }
  
  if (updates.length === 0) return res.json({ error: 'No fields to update' });
  
  updates.push('updatedAt = CURRENT_TIMESTAMP');
  values.push(req.params.id);
  
  db.get(`UPDATE drawings SET ${updates.join(', ')} WHERE id = ? RETURNING *`, values, (err, row) => {
    if (err) {
      console.error('Error updating drawing:', err);
      return res.status(500).json({ error: 'Failed to update drawing' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    res.json(row);
  });
});

app.delete('/api/drawings/:id', (req, res) => {
  db.run('DELETE FROM drawings WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Error deleting drawing:', err);
      return res.status(500).json({ error: 'Failed to delete drawing' });
    }
    res.json({ success: true });
  });
});

const PORT = process.env.PORT || 5000;
function startServer() {
  server = app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`✗ Port ${PORT} is already in use. Stop the existing backend or set PORT to another value.`);
      process.exit(1);
    }
    console.error('✗ Server failed to start:', err);
    process.exit(1);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n✓ Shutting down gracefully...');
  db.close();
  if (server) server.close();
  process.exit(0);
});
