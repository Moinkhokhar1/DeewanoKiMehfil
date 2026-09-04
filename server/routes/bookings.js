const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { requireBuyer } = require('../middleware/auth');
const { uploadScreenshot } = require('../middleware/upload');

function genBookingRef() {
  return 'BK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function getCategories(eventId) {
  return db.prepare('SELECT * FROM ticket_categories WHERE event_id = ? ORDER BY sort_order, id').all(eventId);
}

// Step 1: choose category + quantity
router.get('/book/:eventId', requireBuyer, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.eventId);
  if (!event) return res.status(404).render('404');
  res.render('book', { event, categories: getCategories(event.id), error: null });
});

router.post('/book/:eventId', requireBuyer, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.eventId);
  if (!event) return res.status(404).render('404');
  const categories = getCategories(event.id);

  const category = categories.find(c => c.id === parseInt(req.body.category_id, 10));
  if (!category) {
    return res.render('book', { event, categories, error: 'Please select a valid ticket category.' });
  }

  let qty = parseInt(req.body.quantity, 10);
  if (!qty || qty < 1) qty = 1;
  if (qty > 10) qty = 10;

  const total = +(category.price * qty).toFixed(2);
  const ref = genBookingRef();
  const info = db.prepare(`INSERT INTO bookings (booking_ref, event_id, buyer_id, quantity, total_amount, status, category_id, category_name, unit_price)
    VALUES (?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?)`)
    .run(ref, event.id, req.session.buyerId, qty, total, category.id, category.name, category.price);
  res.redirect(`/checkout/${info.lastInsertRowid}`);
});

// Step 2: show admin QR + collect transaction screenshot
router.get('/checkout/:id', requireBuyer, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking || booking.buyer_id !== req.session.buyerId) return res.status(404).render('404');
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(booking.event_id);
  const admin = db.prepare('SELECT qr_image, payment_note FROM admins ORDER BY id ASC LIMIT 1').get();
  if (booking.status !== 'pending_payment') {
    return res.redirect(`/booking/${booking.id}/status`);
  }
  res.render('checkout', { booking, event, admin, error: null });
});

router.post('/checkout/:id/submit', requireBuyer, (req, res, next) => {
  uploadScreenshot.single('screenshot')(req, res, (err) => {
    if (err) {
      const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
      const event = db.prepare('SELECT * FROM events WHERE id = ?').get(booking.event_id);
      const admin = db.prepare('SELECT qr_image, payment_note FROM admins ORDER BY id ASC LIMIT 1').get();
      return res.render('checkout', { booking, event, admin, error: err.message });
    }
    next();
  });
}, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking || booking.buyer_id !== req.session.buyerId) return res.status(404).render('404');

  if (!req.file) {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(booking.event_id);
    const admin = db.prepare('SELECT qr_image, payment_note FROM admins ORDER BY id ASC LIMIT 1').get();
    return res.render('checkout', { booking, event, admin, error: 'Please upload a screenshot of your payment transaction.' });
  }

  const screenshotPath = '/uploads/screenshots/' + req.file.filename;
  const note = (req.body.transaction_note || '').trim();
  db.prepare(`UPDATE bookings SET status = 'pending_verification', transaction_screenshot = ?, transaction_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(screenshotPath, note, booking.id);

  res.redirect(`/booking/${booking.id}/status`);
});

// Status page - pending / confirmed / rejected
router.get('/booking/:id/status', requireBuyer, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking || booking.buyer_id !== req.session.buyerId) return res.status(404).render('404');
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(booking.event_id);
  res.render('booking-status', { booking, event });
});

// Buyer's booking list
router.get('/my-bookings', requireBuyer, (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, e.title as event_title, e.venue as event_venue, e.start_date, e.event_time, e.images
    FROM bookings b JOIN events e ON e.id = b.event_id
    WHERE b.buyer_id = ? ORDER BY b.created_at DESC
  `).all(req.session.buyerId);
  bookings.forEach(b => { try { b.imageList = JSON.parse(b.images || '[]'); } catch (e) { b.imageList = []; } });
  res.render('my-bookings', { bookings });
});

// Ticket page (only when confirmed)
router.get('/ticket/:id', requireBuyer, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking || booking.buyer_id !== req.session.buyerId) return res.status(404).render('404');
  if (booking.status !== 'confirmed') return res.redirect(`/booking/${booking.id}/status`);
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(booking.event_id);
  const buyer = req.session.buyer;
  res.render('ticket', { booking, event, buyer });
});

module.exports = router;