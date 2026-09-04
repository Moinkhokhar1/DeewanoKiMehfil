const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { uploadEventImages, uploadQr } = require('../middleware/upload');

function parseImages(row) {
  try { row.imageList = JSON.parse(row.images || '[]'); } catch (e) { row.imageList = []; }
  return row;
}

function normalizeArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseCategories(body) {
  const names = normalizeArray(body.category_name).map(s => (s || '').trim());
  const prices = normalizeArray(body.category_price).map(p => parseFloat(p));
  return names
    .map((name, i) => ({ name, price: prices[i] }))
    .filter(c => c.name && !isNaN(c.price) && c.price >= 0);
}

function getCategories(eventId) {
  return db.prepare('SELECT * FROM ticket_categories WHERE event_id = ? ORDER BY sort_order, id').all(eventId);
}

// ---------- Auth ----------
router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin/dashboard');
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const row = db.prepare('SELECT * FROM admins WHERE username = ?').get((username || '').trim());
  if (!row || !bcrypt.compareSync(password || '', row.password_hash)) {
    return res.render('admin/login', { error: 'Invalid username or password.' });
  }
  req.session.adminId = row.id;
  res.redirect('/admin/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.adminId = null;
  res.redirect('/admin/login');
});

// ---------- Dashboard ----------
router.get('/dashboard', requireAdmin, (req, res) => {
  const eventCount = db.prepare('SELECT COUNT(*) c FROM events').get().c;
  const pendingCount = db.prepare("SELECT COUNT(*) c FROM bookings WHERE status = 'pending_verification'").get().c;
  const confirmedCount = db.prepare("SELECT COUNT(*) c FROM bookings WHERE status = 'confirmed'").get().c;
  const revenue = db.prepare("SELECT COALESCE(SUM(total_amount),0) s FROM bookings WHERE status = 'confirmed'").get().s;
  const recentBookings = db.prepare(`
    SELECT b.*, e.title as event_title, buy.name as buyer_name, buy.email as buyer_email
    FROM bookings b
    JOIN events e ON e.id = b.event_id
    JOIN buyers buy ON buy.id = b.buyer_id
    ORDER BY b.created_at DESC LIMIT 8
  `).all();
  res.render('admin/dashboard', { eventCount, pendingCount, confirmedCount, revenue, recentBookings });
});

// ---------- Events CRUD ----------
router.get('/events', requireAdmin, (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY created_at DESC').all().map(parseImages);
  res.render('admin/events', { events });
});

router.get('/events/new', requireAdmin, (req, res) => {
  res.render('admin/event-form', { event: null, categories: [], error: null });
});

router.post('/events/new', requireAdmin, (req, res, next) => {
  uploadEventImages.array('images', 8)(req, res, (err) => {
    if (err) return res.render('admin/event-form', { event: null, categories: [], error: err.message });
    next();
  });
}, (req, res) => {
const { title, category, description, venue, start_date, end_date, event_time, duration, age_limit, languages, terms_conditions } = req.body;
  if (!title || !start_date) {
    return res.render('admin/event-form', { event: null, categories: [], error: 'Title and start date are required.' });
  }

  const cats = parseCategories(req.body);
  if (cats.length === 0) {
    return res.render('admin/event-form', { event: null, categories: [], error: 'Add at least one ticket category with a name and price.' });
  }

  const images = (req.files || []).map(f => '/uploads/events/' + f.filename);
  const startingPrice = Math.min(...cats.map(c => c.price));

const info = db.prepare(`INSERT INTO events (title, category, description, venue, start_date, end_date, event_time, duration, age_limit, languages, terms_conditions, price, images)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  title.trim(), category || '', description || '', venue || '', start_date, end_date || start_date,
  event_time || '', duration || '', age_limit || '', languages || '', terms_conditions || '', startingPrice, JSON.stringify(images)
);

  const insertCat = db.prepare('INSERT INTO ticket_categories (event_id, name, price, sort_order) VALUES (?, ?, ?, ?)');
  cats.forEach((c, i) => insertCat.run(info.lastInsertRowid, c.name, c.price, i));

  res.redirect('/admin/events');
});

router.get('/events/:id/edit', requireAdmin, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).render('404');
  parseImages(event);
  res.render('admin/event-form', { event, categories: getCategories(event.id), error: null });
});

router.post('/events/:id/edit', requireAdmin, (req, res, next) => {
  uploadEventImages.array('images', 8)(req, res, (err) => {
    if (err) {
      const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
      parseImages(event);
      return res.render('admin/event-form', { event, categories: getCategories(event.id), error: err.message });
    }
    next();
  });
}, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).render('404');
 const { title, category, description, venue, start_date, end_date, event_time, duration, age_limit, languages, terms_conditions } = req.body;

  const cats = parseCategories(req.body);
  if (cats.length === 0) {
    parseImages(event);
    return res.render('admin/event-form', { event, categories: getCategories(event.id), error: 'Add at least one ticket category with a name and price.' });
  }

  let images = JSON.parse(event.images || '[]');
  const toRemove = remove_images ? (Array.isArray(remove_images) ? remove_images : [remove_images]) : [];
  images = images.filter(img => !toRemove.includes(img));
  const newImages = (req.files || []).map(f => '/uploads/events/' + f.filename);
  images = images.concat(newImages);

  const startingPrice = Math.min(...cats.map(c => c.price));
db.prepare(`UPDATE events SET title=?, category=?, description=?, venue=?, start_date=?, end_date=?, event_time=?, duration=?, age_limit=?, languages=?, terms_conditions=?, price=?, images=?, is_published=? WHERE id=?`)
  .run(title.trim(), category || '', description || '', venue || '', start_date, end_date || start_date,
    event_time || '', duration || '', age_limit || '', languages || '', terms_conditions || '', startingPrice, JSON.stringify(images),
    is_published ? 1 : 0, event.id);

  db.prepare('DELETE FROM ticket_categories WHERE event_id = ?').run(event.id);
  const insertCat = db.prepare('INSERT INTO ticket_categories (event_id, name, price, sort_order) VALUES (?, ?, ?, ?)');
  cats.forEach((c, i) => insertCat.run(event.id, c.name, c.price, i));

  res.redirect('/admin/events');
});

router.post('/events/:id/delete', requireAdmin, (req, res) => {
  const eventId = req.params.id;
  const bookingCount = db.prepare('SELECT COUNT(*) c FROM bookings WHERE event_id = ?').get(eventId).c;

  if (bookingCount > 0) {
    const events = db.prepare('SELECT * FROM events ORDER BY created_at DESC').all().map(parseImages);
    return res.render('admin/events', {
      events,
      error: `Can't delete this event — it already has ${bookingCount} booking(s). Unpublish it instead if you want to hide it from buyers.`
    });
  }

  const deleteEventTx = db.transaction((id) => {
    db.prepare('DELETE FROM ticket_categories WHERE event_id = ?').run(id);
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
  });
  deleteEventTx(eventId);

  res.redirect('/admin/events');
});

// ---------- Admin profile / QR upload ----------
router.get('/profile', requireAdmin, (req, res) => {
  const admin = db.prepare('SELECT id, username, qr_image, payment_note FROM admins WHERE id = ?').get(req.session.adminId);
  res.render('admin/profile', { admin, message: null, error: null });
});

router.post('/profile/qr', requireAdmin, (req, res, next) => {
  uploadQr.single('qr_image')(req, res, (err) => {
    if (err) {
      const admin = db.prepare('SELECT id, username, qr_image, payment_note FROM admins WHERE id = ?').get(req.session.adminId);
      return res.render('admin/profile', { admin, message: null, error: err.message });
    }
    next();
  });
}, (req, res) => {
  const payment_note = (req.body.payment_note || '').trim();
  if (req.file) {
    const qrPath = '/uploads/qr/' + req.file.filename;
    db.prepare('UPDATE admins SET qr_image = ?, payment_note = ? WHERE id = ?').run(qrPath, payment_note, req.session.adminId);
  } else {
    db.prepare('UPDATE admins SET payment_note = ? WHERE id = ?').run(payment_note, req.session.adminId);
  }
  const admin = db.prepare('SELECT id, username, qr_image, payment_note FROM admins WHERE id = ?').get(req.session.adminId);
  res.render('admin/profile', { admin, message: 'Payment QR / details updated successfully.', error: null });
});

router.post('/profile/password', requireAdmin, (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.session.adminId);
  const publicAdmin = { id: admin.id, username: admin.username, qr_image: admin.qr_image, payment_note: admin.payment_note };
  if (!bcrypt.compareSync(current_password || '', admin.password_hash)) {
    return res.render('admin/profile', { admin: publicAdmin, message: null, error: 'Current password is incorrect.' });
  }
  if (!new_password || new_password.length < 6) {
    return res.render('admin/profile', { admin: publicAdmin, message: null, error: 'New password must be at least 6 characters.' });
  }
  if (new_password !== confirm_password) {
    return res.render('admin/profile', { admin: publicAdmin, message: null, error: 'New passwords do not match.' });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, admin.id);
  res.render('admin/profile', { admin: publicAdmin, message: 'Password changed successfully.', error: null });
});

// ---------- Bookings management ----------
router.get('/bookings', requireAdmin, (req, res) => {
  const filter = req.query.status || 'all';
  let bookings;
  if (filter !== 'all') {
    bookings = db.prepare(`
      SELECT b.*, e.title as event_title, buy.name as buyer_name, buy.email as buyer_email, buy.phone as buyer_phone
      FROM bookings b JOIN events e ON e.id = b.event_id JOIN buyers buy ON buy.id = b.buyer_id
      WHERE b.status = ? ORDER BY b.created_at DESC
    `).all(filter);
  } else {
    bookings = db.prepare(`
      SELECT b.*, e.title as event_title, buy.name as buyer_name, buy.email as buyer_email, buy.phone as buyer_phone
      FROM bookings b JOIN events e ON e.id = b.event_id JOIN buyers buy ON buy.id = b.buyer_id
      ORDER BY b.created_at DESC
    `).all();
  }
  res.render('admin/bookings', { bookings, filter });
});

router.get('/bookings/:id', requireAdmin, (req, res) => {
  const booking = db.prepare(`
    SELECT b.*, e.title as event_title, e.venue as event_venue, e.start_date, e.event_time,
           buy.name as buyer_name, buy.email as buyer_email, buy.phone as buyer_phone
    FROM bookings b JOIN events e ON e.id = b.event_id JOIN buyers buy ON buy.id = b.buyer_id
    WHERE b.id = ?
  `).get(req.params.id);
  if (!booking) return res.status(404).render('404');
  res.render('admin/booking-detail', { booking, error: null });
});

router.post('/bookings/:id/confirm', requireAdmin, async (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).render('404');

  const ticketCode = 'TKT-' + uuidv4().split('-')[0].toUpperCase() + '-' + booking.id;
  const qrDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'misc');
  if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
  const qrFilename = `ticket-${booking.id}-${Date.now()}.png`;
  const qrFullPath = path.join(qrDir, qrFilename);

  try {
    await QRCode.toFile(qrFullPath, JSON.stringify({ ref: booking.booking_ref, ticket: ticketCode }), { width: 400, margin: 1 });
    db.prepare(`UPDATE bookings SET status = 'confirmed', ticket_code = ?, ticket_qr = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(ticketCode, '/uploads/misc/' + qrFilename, booking.id);
  } catch (e) {
    console.error('QR generation failed', e);
    db.prepare(`UPDATE bookings SET status = 'confirmed', ticket_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(ticketCode, booking.id);
  }
  res.redirect(`/admin/bookings/${booking.id}`);
});

router.post('/bookings/:id/reject', requireAdmin, (req, res) => {
  const reason = (req.body.reason || 'Payment could not be verified.').trim();
  db.prepare(`UPDATE bookings SET status = 'rejected', rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(reason, req.params.id);
  res.redirect(`/admin/bookings/${req.params.id}`);
});

module.exports = router;