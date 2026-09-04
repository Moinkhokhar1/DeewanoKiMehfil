const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  qr_image TEXT,
  payment_note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buyers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT,
  description TEXT,
  venue TEXT,
  start_date TEXT,
  end_date TEXT,
  event_time TEXT,
  duration TEXT,
  age_limit TEXT,
  languages TEXT,
  price REAL NOT NULL DEFAULT 0,
  images TEXT DEFAULT '[]',
  is_published INTEGER DEFAULT 1,
  interested_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_ref TEXT UNIQUE NOT NULL,
  event_id INTEGER NOT NULL,
  buyer_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  transaction_screenshot TEXT,
  transaction_note TEXT,
  ticket_code TEXT,
  ticket_qr TEXT,
  ticket_image TEXT,
  rejection_reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(event_id) REFERENCES events(id),
  FOREIGN KEY(buyer_id) REFERENCES buyers(id)
);

CREATE TABLE IF NOT EXISTS interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  buyer_id INTEGER NOT NULL,
  UNIQUE(event_id, buyer_id)
);

CREATE TABLE IF NOT EXISTS ticket_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY(event_id) REFERENCES events(id)
);

`);

// Seed a default admin if none exists
const adminCount = db.prepare('SELECT COUNT(*) as c FROM admins').get().c;
if (adminCount === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('Seeded default admin -> username: admin / password: admin123 (change this after first login)');
}
// --- Migration: add category snapshot columns to bookings if missing ---
// --- Migration: add category snapshot columns to bookings if missing ---
function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

if (!columnExists('bookings', 'category_id')) {
  db.exec('ALTER TABLE bookings ADD COLUMN category_id INTEGER');
}

if (!columnExists('bookings', 'category_name')) {
  db.exec('ALTER TABLE bookings ADD COLUMN category_name TEXT');
}

if (!columnExists('bookings', 'unit_price')) {
  db.exec('ALTER TABLE bookings ADD COLUMN unit_price REAL DEFAULT 0');
}

if (!columnExists('bookings', 'ticket_image')) {
  db.exec('ALTER TABLE bookings ADD COLUMN ticket_image TEXT');
}

if (!columnExists('events', 'terms_conditions')) {
  db.exec("ALTER TABLE events ADD COLUMN terms_conditions TEXT DEFAULT ''");
}

// --- Migration: give any event with no categories yet a "General" category using its old single price ---
db.prepare('SELECT id, price FROM events').all().forEach(ev => {
  const count = db.prepare('SELECT COUNT(*) c FROM ticket_categories WHERE event_id = ?').get(ev.id).c;
  if (count === 0) {
    db.prepare('INSERT INTO ticket_categories (event_id, name, price, sort_order) VALUES (?, ?, ?, 0)')
      .run(ev.id, 'General', ev.price || 0);
  }
});

module.exports = db;
