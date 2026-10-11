/**
 * Portable Express server for the backend API
 * Run locally: node server.js
 * Deploy anywhere: VPS, Docker, Render, Railway, Cloud Run, etc.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');

const path = require('path');
let QRCode;
try {
  QRCode = require('qrcode');
} catch (e) {
  console.warn('QRCode package optional load:', e.message);
}

const playlistInfo = require('./api/playlist-info');
const uninstallHandler = require('./api/uninstall');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory supporters list for verification
const supportersStore = [];

// Middleware
// CORS: allow configured origins; default allow all
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin
    if (!origin) return callback(null, true);
    // Allow all if none configured
    if (allowedOrigins.length === 0) return callback(null, true);
    // Allow explicitly configured origins and Chrome extensions
    if (allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  }
}));

app.use((req, res, next) => {
  if (
    req.path === '/uninstall' ||
    req.path === '/' ||
    req.path === '/support' ||
    req.path === '/support.html' ||
    req.path === '/privacy-policy' ||
    req.path === '/privacy-policy.html' ||
    req.path.startsWith('/assets') ||
    req.path.endsWith('.css') ||
    req.path.endsWith('.js') ||
    req.path.endsWith('.png') ||
    req.path.endsWith('.jpg')
  ) {
    return next();
  }
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })(req, res, next);
});
app.use(compression());
app.use(express.json());
app.use(morgan('tiny'));

// Serve static frontend from docs/
app.use(express.static(path.join(__dirname, '../docs')));

// Root route serves docs/index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/index.html'));
});

// Privacy Policy page
app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/privacy-policy.html'));
});

// Support page (UPI contribution)
app.get(['/support', '/support.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/support.html'));
});

// Dynamic UPI QR Code Generation API
app.get('/api/qr', async (req, res) => {
  try {
    const amount = Math.max(1, parseInt(req.query.amount) || 49);
    const upiUri = `upi://pay?pa=6205921811@axl&pn=Dheeraj%20Kumar&am=${amount}&cu=INR&tn=Support%20PlanUP`;
    if (QRCode && QRCode.toString) {
      const svg = await QRCode.toString(upiUri, {
        type: 'svg',
        margin: 1,
        width: 220,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=30');
      return res.send(svg);
    }
    // Fallback if library missing
    res.redirect('/assets/phonepe_qr.png');
  } catch (err) {
    console.error('QR generation error:', err);
    res.redirect('/assets/phonepe_qr.png');
  }
});

// Supporter contribution confirmation API
app.post('/api/support/confirm', (req, res) => {
  const { name, email, utr, amount } = req.body || {};
  if (!name || !utr) {
    return res.status(400).json({ error: 'Name and Transaction / UTR ID are required.' });
  }
  const contribution = {
    id: Date.now().toString(),
    name: String(name).trim().slice(0, 50),
    email: String(email || '').trim().slice(0, 80),
    utr: String(utr).trim().slice(0, 40),
    amount: Math.max(1, parseInt(amount) || 49),
    timestamp: new Date().toISOString()
  };
  supportersStore.unshift(contribution);
  res.json({
    success: true,
    message: `Thank you ${contribution.name}! Your support of ₹${contribution.amount} has been recorded.`,
    contribution
  });
});

app.get('/api/support/supporters', (req, res) => {
  res.json({ count: supportersStore.length, supporters: supportersStore.slice(0, 10) });
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// PlanUP Uninstall feedback page
app.get('/uninstall', (req, res) => uninstallHandler(req, res));
app.get('/api/uninstall', (req, res) => uninstallHandler(req, res));

// API routes
app.options('/api/playlist-info', (req, res) => res.status(200).json({ ok: true }));
app.get('/api/playlist-info', (req, res) => playlistInfo(req, res));
app.post('/api/playlist-info', (req, res) => playlistInfo(req, res));

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n✅ Backend listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
