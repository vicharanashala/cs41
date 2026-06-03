import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'faqs.db');

let db;

export async function initDb() {
  const SQL = await initSqlJs();

  // Load existing or create new
  let data;
  if (fs.existsSync(DB_PATH)) {
    data = fs.readFileSync(DB_PATH);
  }

  db = new SQL.Database(data);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'intern',
      is_verified INTEGER DEFAULT 0,
      reputation INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      views INTEGER DEFAULT 0,
      is_faq INTEGER DEFAULT 0,
      promoted_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      is_accepted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (question_id) REFERENCES questions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS AppliedMigrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  // Migration: add is_faq column if it doesn't exist
  try {
    db.run('ALTER TABLE questions ADD COLUMN is_faq INTEGER DEFAULT 0');
  } catch(e) { /* column already exists */ }
  try {
    db.run('ALTER TABLE questions ADD COLUMN promoted_at TEXT DEFAULT NULL');
  } catch(e) { /* column already exists */ }
  
  // Migration: add role and is_verified columns to users
  try {
    db.run('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "intern"');
  } catch(e) { /* column already exists */ }
  try {
    db.run('ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0');
  } catch(e) { /* column already exists */ }

  // Seed if empty
  const result = db.exec('SELECT COUNT(*) as count FROM users');
  if (result.length === 0 || result[0].values[0][0] === 0) {
    await seed();
  }

  return db;
}

export function getDb() {
  if (!db) throw new Error('DB not initialized — call initDb() first');
  return db;
}

export function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

async function seed() {
  const { v4: uuidv4 } = await import('uuid');
  const bcryptModule = await import('bcryptjs');
  const bcrypt = bcryptModule.default || bcryptModule;

  const hash = await bcrypt.hash('demo1234', 10);

  const users = [
    { id: uuidv4(), name: 'Priya Sharma',    email: 'priya@university.edu',  reputation: 245 },
    { id: uuidv4(), name: 'Rahul Verma',     email: 'rahul@institute.edu',  reputation: 182 },
    { id: uuidv4(), name: 'Sneha Patel',     email: 'sneha@college.org',    reputation: 158 },
    { id: uuidv4(), name: 'Arjun Nair',      email: 'arjun@tech.edu',       reputation: 134 },
    { id: uuidv4(), name: 'Zara Khan',       email: 'zara@university.edu',  reputation: 97  },
  ];

  const insertUser = db.prepare('INSERT INTO users (id, name, email, password_hash, role, is_verified, reputation) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const u of users) { insertUser.run([u.id, u.name, u.email, hash, 'intern', 1, u.reputation]); }
  insertUser.free();

  const questionsData = [
    {
      title: 'How to answer "Tell me about yourself" in a internship interview?',
      description: "I have a virtual interview coming up with a big tech company next week and I'm really nervous about the 'Tell me about yourself' question. I never know how much detail to go into or where to start. Should I talk about my academics, projects, or hobbies? How do I make it memorable? Any frameworks or examples would be really helpful.",
      category: 'Interview Prep',
      tags: JSON.stringify(['interview', 'self-introduction', 'tech']),
      user_id: users[0].id,
    },
    {
      title: 'Is it worth doing an unpaid internship in 2026?',
      description: "I received an unpaid internship offer from a startup in the fintech space. They say there's a high chance of conversion to a paid role after 3 months. The work sounds interesting but I'm worried about the financial strain. Has anyone been in a similar situation? Was it worth it in the long run? How do I negotiate at least a stipend?",
      category: 'General Advice',
      tags: JSON.stringify(['unpaid', 'startup', 'conversion']),
      user_id: users[1].id,
    },
    {
      title: 'How to prepare for system design rounds as a sophomore applying for SDE internships?',
      description: "I'm a second-year CS student targeting FAANG internships for next summer. I've prepared algorithms and data structures but I keep hearing about system design interviews even for intern roles. Where do I even start? Are there good resources that are beginner-friendly? Is it more about low-level design or high-level for internships?",
      category: 'Interview Prep',
      tags: JSON.stringify(['system-design', 'FAANG', 'CS-students']),
      user_id: users[2].id,
    },
    {
      title: 'What documents do I need for a US internship visa (J-1)?',
      description: "I just got an offer from a US-based company for a summer internship. They're helping with the J-1 visa process but I need to understand what documents I'll need to gather. DS-2019, DS-7002, SEVIS — honestly confused about all of this. Can someone who has done this before share their experience or a checklist?",
      category: 'Visa & Relocation',
      tags: JSON.stringify(['visa', 'J-1', 'USA', 'documents']),
      user_id: users[3].id,
    },
    {
      title: 'How to research a company before an interview — beyond just the website?',
      description: "Every guide tells me to 'research the company' before an interview but nobody tells me HOW. I usually just read their About page and maybe a couple of news articles. What are the best sources to actually understand a company's culture, recent challenges, product strategy, and what they actually value? I want to ask smart questions and show genuine interest.",
      category: 'Company Research',
      tags: JSON.stringify(['research', 'preparation', 'cultural-fit']),
      user_id: users[4].id,
    },
    {
      title: "Dealing with Imposter Syndrome during internship search — feeling like I don't deserve any opportunity",
      description: "I've been applying to internships for 3 months now and every rejection makes me feel worse. I see my peers getting offers from companies I've never heard of and I can't help but feel like I'm not good enough. I have a decent GPA and one personal project but I feel like I'm leagues behind everyone else. How do you deal with this?",
      category: 'Mental Health',
      tags: JSON.stringify(['imposter-syndrome', 'rejection', 'mental-health']),
      user_id: users[0].id,
    },
    {
      title: 'What is a reasonable salary expectation for a software intern in 2026?',
      description: "I'm in the final round with a Series B startup and they asked about my salary expectations. I have no idea what's reasonable for a backend intern in a major metro city. I don't want to undersell myself but I also don't want to price myself out. What are current intern salary ranges — base, any perks, stock options?",
      category: 'Salary Negotiation',
      tags: JSON.stringify(['salary', 'negotiation', 'startup', 'backend']),
      user_id: users[1].id,
    },
    {
      title: 'How to write a cold email to a recruiter that actually gets a response?',
      description: "I've been LinkedIn stalking recruiters at companies I'm interested in and I want to reach out directly. But every email I write sounds either too desperate or too formal. What's the formula for a cold email that gets a reply? Should I attach my resume? How long should it be? Anyone had success with this approach?",
      category: 'Application Tips',
      tags: JSON.stringify(['cold-email', 'recruiter', 'linkedin', 'outreach']),
      user_id: users[2].id,
    },
  ];

  const insertQuestion = db.prepare('INSERT INTO questions (id, user_id, title, description, category, tags, views) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const questionIds = [];
  for (const q of questionsData) {
    const id = uuidv4();
    questionIds.push(id);
    insertQuestion.run([id, q.user_id, q.title, q.description, q.category, q.tags, Math.floor(Math.random() * 500) + 50]);
  }
  insertQuestion.free();

  const answersData = [
    { question_id: questionIds[0], user_id: users[1].id, content: "The **STAR (Situation, Task, Action, Result)** framework works really well here. Start with a hook that connects your background to the role — something like 'I'm a third-year CS student who recently built a real-time collaboration tool, and I'm excited about your company's approach to developer tools.' Keep it under 2 minutes. The key is: past (projects/experience) → present (why this role) → future (what you'll bring). Don't list your entire life story." },
    { question_id: questionIds[0], user_id: users[4].id, content: "Something that worked for me: frame it as a **story of progression**. Start with what got you interested in the field, then show 2-3 key experiences that built up to this internship. End with WHY this specific company. Recruiters love specificity — 'I want to work at Stripe because their payments infrastructure handles more volume than most banks' hits harder than 'I like fintech.'" },
    { question_id: questionIds[1], user_id: users[2].id, content: "I did an unpaid internship at a Series A startup last summer. Here's my honest take: **it was worth it, but only because I negotiated hard on the learning side**. I got a structured mentorship program, real ownership of a project, and a PPO offer at the end. If they're not offering structured mentorship AND a realistic conversion path, I'd pass. Your time has value — don't let anyone tell you otherwise." },
    { question_id: questionIds[1], user_id: users[3].id, content: "Financial strain is real. If you can afford 3 months without pay (family support, savings, etc.), focus on whether the **learning and network** will pay off long-term. Ask them: 'Can you share examples of previous interns who converted to full-time?' If they can't, that's a red flag. Also try negotiating — even a small monthly stipend shows they value your contribution." },
    { question_id: questionIds[4], user_id: users[0].id, content: "Here's my research stack: **LinkedIn (company page posts from last 6 months)**, **Glassdoor reviews** (filter for 'intern' reviews specifically), **TechCrunch/FinTech/etc. news** about the company, **the product itself** (actually use it!), and **Blind** for employee sentiment. For the interview, note 2-3 things about their product roadmaps and mention them organically. Shows you did the work." },
    { question_id: questionIds[4], user_id: users[3].id, content: "I always look at the **company's engineering blog or tech talks** on YouTube. It's gold — shows you care about how they actually build things, not just the business side. Also check their **careers page** for the exact tech stack they mention. Walking into an interview and saying 'I noticed you recently migrated to Kubernetes — what challenges did that bring' is chef's kiss." },
    { question_id: questionIds[5], user_id: users[2].id, content: "The secret nobody tells you: **everyone feels this**. Even people with offers at top companies. Imposter syndrome is not a sign that you're unqualified — it's a sign you care. One practical thing that helped me: keep a 'wins' document. Every time something goes well — an interviewer compliment, a project that worked, a bug you fixed — write it down. Read it when you're feeling low. Your brain remembers failures more vividly than wins, so you have to actively counter that." },
    { question_id: questionIds[5], user_id: users[4].id, content: "Sending you strength. The internship search is brutal and rejection is not a measure of your worth. Something that helped me: **comparison is the thief of joy AND momentum**. Every person's journey is different — someone might have started coding earlier, had more resources, or just applied to more places. Focus only on your own trajectory. Three months from now, you'll look back at today and realize how much you grew. Keep going." },
  ];

  const insertAnswer = db.prepare('INSERT INTO answers (id, question_id, user_id, content, is_accepted) VALUES (?, ?, ?, ?, ?)');
  for (const a of answersData) { insertAnswer.run([uuidv4(), a.question_id, a.user_id, a.content, 0]); }
  insertAnswer.free();

  saveDb();
  console.log('✅ Database seeded with demo data');
}

// Helper: run a query and return all rows as objects
export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

export function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}