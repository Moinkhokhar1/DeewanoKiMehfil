const express = require('express');
const router = express.Router();
const db = require('../db');

function parseImages(row) {
  try { row.imageList = JSON.parse(row.images || '[]'); } catch (e) { row.imageList = []; }
  return row;
}

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  let events;
  if (q) {
    const like = `%${q}%`;
    events = db.prepare(
      `SELECT * FROM events WHERE is_published = 1 AND (title LIKE ? OR category LIKE ? OR venue LIKE ?) ORDER BY datetime(start_date) ASC`
    ).all(like, like, like);
  } else {
    events = db.prepare(`SELECT * FROM events WHERE is_published = 1 ORDER BY datetime(start_date) ASC`).all();
  }
  events = events.map(parseImages);
  res.render('index', { events, q });
});

router.get('/event/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).render('404');
  parseImages(event);
  let interested = false;
  if (req.session.buyerId) {
    const row = db.prepare('SELECT 1 FROM interests WHERE event_id = ? AND buyer_id = ?').get(event.id, req.session.buyerId);
    interested = !!row;
  }
  res.render('event', { event, interested });
});

router.post('/event/:id/interest', (req, res) => {
  if (!req.session.buyerId) {
    req.session.returnTo = `/event/${req.params.id}`;
    return res.redirect('/login');
  }
  const eventId = req.params.id;
  const buyerId = req.session.buyerId;
  const existing = db.prepare('SELECT 1 FROM interests WHERE event_id = ? AND buyer_id = ?').get(eventId, buyerId);
  if (existing) {
    db.prepare('DELETE FROM interests WHERE event_id = ? AND buyer_id = ?').run(eventId, buyerId);
    db.prepare('UPDATE events SET interested_count = MAX(0, interested_count - 1) WHERE id = ?').run(eventId);
  } else {
    db.prepare('INSERT INTO interests (event_id, buyer_id) VALUES (?, ?)').run(eventId, buyerId);
    db.prepare('UPDATE events SET interested_count = interested_count + 1 WHERE id = ?').run(eventId);
  }
  res.redirect(`/event/${eventId}`);
});

module.exports = router;
