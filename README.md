# EventBook — Ticket Booking System

A complete, self-hosted event ticket booking system: buyers browse events (with an
image carousel), sign up/log in, book tickets, pay by scanning an admin-uploaded QR
code, upload their payment screenshot, and get a QR ticket once the admin verifies
the payment. Fully mobile responsive.

## What's included

- **Buyer site**: event listing, search, event detail page with a swipeable image
  carousel (like an Insider/BookMyShow-style page), "Interested" counter, sign
  up/login with session cookies, booking, checkout, "My Bookings", and a printable
  ticket with a generated QR code.
- **Admin panel**: login, dashboard (stats + recent bookings), event management
  (create/edit/delete, upload multiple photos directly from your device — no image
  links needed), a **Profile** page to upload your payment **QR code** and payment
  instructions, and a bookings screen to **approve or reject** payment screenshots.
  Approving a booking auto-generates the buyer's ticket + QR code.
- **No Razorpay / payment gateway** — buyers scan the QR code you upload and then
  upload a screenshot of their transaction as proof; you confirm manually from the
  admin panel.

## Tech stack

Node.js, Express, EJS templates, SQLite (via `better-sqlite3`, a single file
database — no separate DB server to install), `express-session` with a SQLite
session store (session/login cookies persist across restarts), Multer for image
uploads, and the `qrcode` package to generate ticket QR codes. Plain CSS (mobile
first) and vanilla JS for the carousel — no build step required.

## 1. Install & run locally

Requires Node.js 18+ (works with the Node version you have — tested on Node 22).

```bash
cd ticket-booking-system
npm install
cp .env.example .env      # optional: edit PORT / SESSION_SECRET
npm start
```

Open:
- Buyer site: http://localhost:3000
- Admin panel: http://localhost:3000/admin/login

**Default admin login** (auto-created on first run):
- Username: `admin`
- Password: `admin123`

⚠️ **Change this password immediately** from Admin → Profile → Change Password
(or edit it directly before going live).

## 2. First-time admin setup

1. Log in to `/admin/login`.
2. Go to **Profile & QR Code** and upload your payment QR code (UPI/bank QR,
   whatever you use) plus any payment instructions buyers should see. This QR is
   what buyers will scan on the checkout page.
3. Go to **Events → + Add New Event** and fill in the details, then upload event
   photos directly (multiple images supported — first photo becomes the cover
   image shown on the listing page and in the carousel).
4. That's it — the event is live on the buyer site immediately (uncheck
   "Published" on an event if you want to keep it as a draft).

## 3. How a booking works end-to-end

1. Buyer signs up / logs in (session cookie keeps them logged in for 30 days).
2. Buyer opens an event → sees the photo carousel, details, "Interested" count.
3. Buyer taps **Book Now** → picks quantity → sees your QR code + payment note.
4. Buyer scans the QR, pays outside the app (their UPI/banking app), then uploads
   a screenshot of the transaction (+ optional reference note) and submits.
5. Booking status becomes **Pending Verification**. Admin sees it under
   **Bookings → Pending Verification**, opens it, views the screenshot, and
   clicks **Confirm & Generate Ticket** (or **Reject** with a reason).
6. On confirm, a unique ticket code + QR code are generated automatically. The
   buyer's booking status flips to **Confirmed**, and they can view/print their
   ticket from **My Bookings**.

## 4. Data & uploads

- Database file: `data/app.db` (SQLite — just a file, back it up by copying it).
- Sessions: `data/sessions.db` (buyer/admin login cookies persist across
  restarts).
- Uploaded images are saved under `public/uploads/` in subfolders: `events/`,
  `qr/`, `screenshots/`, `misc/` (generated ticket QR codes).
- Nothing is stored in the cloud — everything lives on whichever machine/server
  you run this on, so make sure to back up the `data/` and `public/uploads/`
  folders.

## 5. Deploying so it's live on the internet

This runs anywhere Node.js runs. Easiest options:

- **Render / Railway / Fly.io**: connect your GitHub repo (or upload this
  folder), set the start command to `npm start`, add a **persistent disk/volume**
  mounted so `data/` and `public/uploads/` survive restarts (otherwise your DB and
  images reset on every deploy), and set `SESSION_SECRET` as an environment
  variable to a long random string.
- **A VPS (DigitalOcean, EC2, etc.)**: `git clone` or upload the folder, run
  `npm install && npm start` (use `pm2` or a systemd service to keep it running,
  and put it behind Nginx + HTTPS/Let's Encrypt).

Whichever you choose, two things matter most for production:
1. Set `SESSION_SECRET` in `.env` to a long random string (don't use the default).
2. Make sure `data/` and `public/uploads/` are on **persistent storage**, not an
   ephemeral filesystem that gets wiped on redeploy.

## 6. Customizing

- Colors/branding: edit the `:root` CSS variables at the top of
  `public/css/style.css` (`--primary`, `--dark`, etc.).
- Site name "EventBook": search-and-replace in the EJS files under `views/`.
- Ticket/ QR design: `views/ticket.ejs` + the `.ticket-*` CSS classes.
- Add more fields to events: extend the `events` table in `server/db.js`, the
  form in `views/admin/event-form.ejs`, and the display in `views/event.ejs`.

## Project structure

```
server/
  index.js          Express app entry point
  db.js             SQLite schema + seed admin
  middleware/
    auth.js         login guards (buyer / admin)
    upload.js       multer config for image uploads
  routes/
    auth.js         buyer register/login/logout
    events.js       public event listing/detail/"interested"
    bookings.js      booking → checkout → screenshot → status → ticket
    admin.js        admin login, events CRUD, QR upload, booking approval
views/               EJS templates (buyer pages + views/admin/* for admin)
public/
  css/style.css      all styling, mobile-first
  js/main.js         carousel + admin sidebar toggle
  uploads/           event photos, QR codes, screenshots, ticket QR codes
data/                SQLite database files (created on first run)
```
