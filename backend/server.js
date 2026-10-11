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

const playlistInfo = require('./api/playlist-info');
const uninstallHandler = require('./api/uninstall');

const app = express();
const PORT = process.env.PORT || 3000;

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
  if (req.path === '/uninstall') return next();
  helmet()(req, res, next);
});
app.use(compression());
app.use(express.json());
app.use(morgan('tiny'));

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
