import initSqlJs from 'sql.js';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./db/faqs.db'));

const result = db.exec("SELECT email, role, is_verified FROM users");
console.log('All users:', JSON.stringify(result));

const hashRow = db.exec("SELECT password_hash FROM users WHERE email = 'faculty@admin.com'");
if (hashRow.length && hashRow[0].values.length) {
  console.log('Faculty hash valid?', bcrypt.compareSync('demo1234', hashRow[0].values[0][0]));
} else {
  console.log('Faculty NOT found');
}