const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

router.get('/register', (req, res) => {
  if (req.session.buyerId) return res.redirect('/');
  res.render('register', { error: null, old: {} });
});

router.post('/register', (req, res) => {
  const { name, email, phone, password, confirm_password } = req.body;
  if (!name || !email || !password) {
    return res.render('register', { error: 'Please fill in all required fields.', old: req.body });
  }
  if (password !== confirm_password) {
    return res.render('register', { error: 'Passwords do not match.', old: req.body });
  }
  if (password.length < 6) {
    return res.render('register', { error: 'Password must be at least 6 characters.', old: req.body });
  }
  const existing = db.prepare('SELECT id FROM buyers WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    return res.render('register', { error: 'An account with this email already exists.', old: req.body });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO buyers (name, email, phone, password_hash) VALUES (?, ?, ?, ?)')
    .run(name.trim(), email.toLowerCase().trim(), phone || '', hash);

  const buyer = db.prepare('SELECT id, name, email, phone FROM buyers WHERE id = ?').get(info.lastInsertRowid);
  req.session.buyerId = buyer.id;
  req.session.buyer = buyer;
  const dest = req.session.returnTo || '/';
  delete req.session.returnTo;
  res.redirect(dest);
});

router.get('/login', (req, res) => {
  if (req.session.buyerId) return res.redirect('/');
  res.render('login', { error: null, old: {} });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const row = db.prepare('SELECT * FROM buyers WHERE email = ?').get((email || '').toLowerCase().trim());
  if (!row || !bcrypt.compareSync(password || '', row.password_hash)) {
    return res.render('login', { error: 'Invalid email or password.', old: req.body });
  }
  const buyer = { id: row.id, name: row.name, email: row.email, phone: row.phone };
  req.session.buyerId = buyer.id;
  req.session.buyer = buyer;
  const dest = req.session.returnTo || '/';
  delete req.session.returnTo;
  res.redirect(dest);
});

router.post('/logout', (req, res) => {
  req.session.buyerId = null;
  req.session.buyer = null;
  res.redirect('/');
});

router.get('/logout', (req, res) => {
  req.session.buyerId = null;
  req.session.buyer = null;
  res.redirect('/');
});

module.exports = router;
