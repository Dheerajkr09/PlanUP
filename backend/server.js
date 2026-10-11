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
app.get('/uninstall', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PlanUp – Uninstall Feedback</title>
  <meta name="description" content="PlanUp - YouTube Playlist & One-Shot Planner. Make every video count.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0e17;
      color: #f1f5f9;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container {
      max-width: 580px;
      width: 100%;
      background: rgba(17, 24, 39, 0.95);
      border: 1px solid rgba(0, 240, 255, 0.22);
      border-radius: 20px;
      padding: 40px 32px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 25px rgba(0, 240, 255, 0.15);
      position: relative;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .brand-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #00f0ff 0%, #7000ff 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      box-shadow: 0 0 16px rgba(0, 240, 255, 0.4);
    }
    .brand-title {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.3px;
    }
    .brand-title span {
      background: linear-gradient(90deg, #00f0ff, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .tagline {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 2px;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #ffffff;
    }
    .subtitle {
      font-size: 14px;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 28px;
    }
    .feedback-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }
    .feedback-option {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 12px 16px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 14px;
    }
    .feedback-option:hover {
      background: rgba(0, 240, 255, 0.06);
      border-color: rgba(0, 240, 255, 0.3);
    }
    .feedback-option input {
      accent-color: #00f0ff;
      width: 16px;
      height: 16px;
    }
    textarea {
      width: 100%;
      height: 90px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 12px;
      color: #fff;
      font-family: inherit;
      font-size: 13px;
      resize: none;
      outline: none;
      margin-bottom: 20px;
    }
    textarea:focus {
      border-color: #00f0ff;
    }
    .btn-submit {
      width: 100%;
      background: linear-gradient(135deg, #00f0ff 0%, #00b4d8 100%);
      color: #070a10;
      font-weight: 700;
      font-size: 14px;
      padding: 12px;
      border: none;
      border-radius: 999px;
      cursor: pointer;
      box-shadow: 0 4px 18px rgba(0, 240, 255, 0.35);
      transition: all 0.2s ease;
    }
    .btn-submit:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(0, 240, 255, 0.5);
    }
    .reinstall-link {
      display: block;
      text-align: center;
      margin-top: 18px;
      font-size: 13px;
      color: #00f0ff;
      text-decoration: none;
    }
    .reinstall-link:hover { text-decoration: underline; }
    .success-msg {
      display: none;
      text-align: center;
      padding: 30px 0;
    }
    .success-msg h2 { color: #00ff85; margin-bottom: 8px; font-size: 22px; }
    .success-msg p { color: #94a3b8; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      <div class="brand-icon">⚡</div>
      <div>
        <div class="brand-title">Plan<span>UP</span></div>
        <div class="tagline">YouTube Playlist & One-Shot Planner</div>
      </div>
    </div>

    <div id="formSection">
      <h1>Before you go...</h1>
      <p class="subtitle">We're sorry to see you leave. One quick feedback helps us make PlanUP better for everyone.</p>

      <div class="feedback-group">
        <label class="feedback-option">
          <input type="radio" name="reason" value="Finished my goal"> I completed my study goals / playlist
        </label>
        <label class="feedback-option">
          <input type="radio" name="reason" value="Too complex"> It was difficult or confusing to use
        </label>
        <label class="feedback-option">
          <input type="radio" name="reason" value="Missing feature"> Missing a feature I wanted
        </label>
        <label class="feedback-option">
          <input type="radio" name="reason" value="Buggy"> I faced technical issues or bugs
        </label>
        <label class="feedback-option">
          <input type="radio" name="reason" value="Other"> Other reason
        </label>
      </div>

      <textarea id="comment" placeholder="Tell us more or what we could do better... (optional)"></textarea>

      <button class="btn-submit" id="submitBtn">Submit Feedback</button>
    </div>

    <div id="successSection" class="success-msg">
      <h2>Thank you for your feedback! ❤️</h2>
      <p>Your input helps us improve PlanUP. We hope to see you back on your learning journey!</p>
    </div>

    <a href="https://chromewebstore.google.com" class="reinstall-link">Changed your mind? Reinstall PlanUP</a>
  </div>

  <script>
    document.getElementById('submitBtn').addEventListener('click', function() {
      document.getElementById('formSection').style.display = 'none';
      document.getElementById('successSection').style.display = 'block';
    });
  </script>
</body>
</html>`);
});

// API routes
app.options('/api/playlist-info', (req, res) => res.status(200).json({ ok: true }));
app.get('/api/playlist-info', (req, res) => playlistInfo(req, res));
app.post('/api/playlist-info', (req, res) => playlistInfo(req, res));

app.listen(PORT, () => {
  console.log(`\n✅ Backend listening on http://localhost:${PORT}`);
});
