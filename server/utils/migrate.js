import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { beginTransaction, commitTransaction, rollbackTransaction } from '../db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Strip ALL comments from SQL: -- lines and /* blocks, then strip inline -- comments.
// This prevents comment-embedded semicolons and pipe characters from breaking tokenization.
function stripComments(sql) {
  // Remove block comments first (multi-line and single-line)
  let s = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove single-line -- comments (but not --- which might be used as a separator)
  s = s.split('\n').map(line => {
    let inStr = false, strChar = '', i = 0, result = '';
    while (i < line.length) {
      const ch = line[i];
      if (inStr) {
        result += ch;
        if (ch === strChar && line[i+1] === strChar) { i += 2; continue; }
        if (ch === strChar) inStr = false;
        i++; continue;
      }
      if (ch === "'" || ch === '"') { inStr = true; strChar = ch; result += ch; i++; continue; }
      if (ch === '-' && line[i+1] === '-' && line[i+2] !== '-') { return result; }
      result += ch; i++;
    }
    return result;
  }).join('\n');
  return s;
}

// True if every line is empty or whitespace-only (comments already stripped)
function isCommentOnly(stmt) {
  return stmt.split('\n').every(line => line.trim() === '');
}

function tokenizeStatements(sql) {
  const s = stripComments(sql);
  const stmts = [];
  let i = 0, buf = '', inStr = false, strChar = '', inBlock = false;
  while (i < s.length) {
    const ch = s[i];
    if (inBlock) { buf += ch; if (s[i]==='*'&&s[i+1]==='/'){ buf+='/'; i+=2; inBlock=false; continue; } i++; continue; }
    if (inStr) { buf += ch; if (ch===strChar&&s[i+1]===strChar){ buf+=s[i+1]; i+=2; continue; } if(ch===strChar) inStr=false; i++; continue; }
    if (ch==="'"||ch==='"'){ buf+=ch; inStr=true; strChar=ch; i++; continue; }
    if (ch==='/'&&s[i+1]==='*'){ buf+='/*'; i+=2; inBlock=true; continue; }
    if (ch===';'){ const st=buf.trim(); if(!isCommentOnly(st)) stmts.push(st); buf=''; i++; continue; }
    buf += ch; i++;
  }
  const last = buf.trim();
  if (!isCommentOnly(last)) stmts.push(last);
  return stmts;
}

export function runMigrations(db) {
  const migrationsDir = path.join(__dirname, '../migrations');
  const applied = new Set(
    db.exec('SELECT name FROM AppliedMigrations')[0]?.values.map(r=>r[0]) || []
  );
  const files = fs.readdirSync(migrationsDir).filter(f=>f.endsWith('.sql')).sort();
  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const stmts = tokenizeStatements(sql);
    console.log(`  Running: ${file} (${stmts.length} stmt${stmts.length!==1?'s':''})`);
    // Use the raw db passed in. beginTransaction/commitTransaction/rollbackTransaction
    // are imported so they use the shared _inTransaction guard from database.js.
    db.run('BEGIN IMMEDIATE');
    try {
      for (const stmt of stmts) db.run(stmt);
      db.run('INSERT INTO AppliedMigrations (name, applied_at) VALUES (?, ?)', [file, Date.now()]);
      commitTransaction();
      count++;
    } catch(err) {
      rollbackTransaction();
      console.error(`  ❌ ${file} failed: ${err.message}`);
      throw err;
    }
  }
  return count;
}
