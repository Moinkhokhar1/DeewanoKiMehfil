function requireBuyer(req, res, next) {
  if (req.session && req.session.buyerId) return next();
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.redirect('/admin/login');
}

function attachLocals(req, res, next) {
  res.locals.buyer = req.session.buyer || null;
  res.locals.isAdmin = !!req.session.adminId;
  next();
}

module.exports = { requireBuyer, requireAdmin, attachLocals };
