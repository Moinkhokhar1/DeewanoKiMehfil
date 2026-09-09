const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function makeStorage(subdir) {
  const dest = path.join(__dirname, '..', '..', 'public', 'uploads', subdir);
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const name = crypto.randomBytes(16).toString('hex') + ext;
      cb(null, name);
    }
  });
}

const imageFilter = (req, file, cb) => {
  const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only image files (png, jpg, jpeg, webp, gif) are allowed'));
};

const uploadEventImages = multer({
  storage: makeStorage('events'),
  fileFilter: imageFilter,
  // 8 event photos + 1 priceinfo image = 9 total files per request
  limits: { fileSize: 8 * 1024 * 1024, files: 9 }
});

const uploadQr = multer({
  storage: makeStorage('qr'),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});

const uploadScreenshot = multer({
  storage: makeStorage('screenshots'),
  fileFilter: imageFilter,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }
});

module.exports = { uploadEventImages, uploadQr, uploadScreenshot };