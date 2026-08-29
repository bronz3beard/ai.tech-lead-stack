import Database from 'better-sqlite3';
import path from 'node:path';

let db: Database.Database | null = null;

export interface VoiceLogEntry {
  prompt: string;
  task_class: string;
  raw_markdown: string;
  raw_spoken: string;
  repaired_spoken: string;
}

function initDB() {
  if (db) return db;
  
  // Resolve path correctly relative to the current file / root
  // We'll put the db in the voice-relay folder root (where package.json is)
  const getDirname = () => {
    if (typeof __dirname !== 'undefined') {
      return __dirname;
    }
    const cwd = process.cwd();
    return cwd.endsWith('voice-relay')
      ? path.join(cwd, 'src', 'db')
      : path.join(cwd, 'peripherals/voice-relay/src/db');
  };
  
  const dbPath = path.resolve(getDirname(), '../../voice_logs.db');
  db = new Database(dbPath);

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      prompt TEXT,
      task_class TEXT,
      raw_markdown TEXT,
      raw_spoken TEXT,
      repaired_spoken TEXT
    );
  `);

  return db;
}

export function logResponse(entry: VoiceLogEntry) {
  try {
    const database = initDB();
    
    // Auto-rotation: Check count
    const countStmt = database.prepare('SELECT COUNT(*) as count FROM logs');
    const { count } = countStmt.get() as { count: number };
    
    if (count >= 1000) {
      // Wipe the DB to prevent bloat
      database.exec('DELETE FROM logs;');
      console.log('[SQLite Logger] Reached 1000 logs. Cleared database for auto-rotation.');
    }

    // Insert
    const insertStmt = database.prepare(`
      INSERT INTO logs (prompt, task_class, raw_markdown, raw_spoken, repaired_spoken)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      entry.prompt,
      entry.task_class,
      entry.raw_markdown,
      entry.raw_spoken,
      entry.repaired_spoken
    );
  } catch (err) {
    console.error('[SQLite Logger] Failed to log response:', err);
  }
}
