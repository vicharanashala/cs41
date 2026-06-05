import initSqlJs from 'sql.js';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./db/faqs.db'));

const hash = bcrypt.hashSync('demo1234', 10);
const id = 'faculty-admin-001';

db.run("DELETE FROM users WHERE email = ?", ['faculty@admin.com']);
db.run("INSERT INTO users (id, name, email, password_hash, role, is_verified, reputation) VALUES (?, ?, ?, ?, ?, ?, ?)",
  [id, 'Faculty Admin', 'faculty@admin.com', hash, 'faculty', 1, 0]);

const all = db.exec("SELECT email, role FROM users");
console.log('Users after insert:', JSON.stringify(all));

const check = db.exec("SELECT password_hash FROM users WHERE email = 'faculty@admin.com'");
if (check.length && check[0].values.length) {
  console.log('Hash valid?', bcrypt.compareSync('demo1234', check[0].values[0][0]));
}

fs.writeFileSync('./db/faqs.db', Buffer.from(db.export()));
console.log('Saved!');