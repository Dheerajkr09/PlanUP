# 🏗️ DOC 1: Architecture & Data Flow (PlanUp)

## 📌 1. Project Overview
PlanUp (formerly PlanYT) is a Chrome Extension built using **Manifest V3**. It converts YouTube playlists and long single videos (including past Live Streams and Shorts) into structured, trackable daily learning plans.

### Key Capabilities:
- **Dual Support:** Supports both standard Playlists (`playlist?list=...`) AND single videos/Live VODs (`youtu.be/`, `/live/`, `/shorts/`).
- **Auto-Routing:** Users can paste *any* valid YouTube link into the main "Playlist URL" box. The app auto-detects if it's a single video and routes it to the One-Shot generator.
- **Dual Plan Modes:** "Custom Schedule" (splits long videos across days based on watch time) and "Video-by-Video" (one video per day).

## 📁 2. Directory Structure & Roles
- **`/manifest.json`**: Entry point (Manifest V3). Defines permissions (`storage`), host permissions (`youtube.com`), popup (`popup.html`), service worker (`background.js`), and content scripts. No `key` included so it acts as an independent local extension.
- **`/popup`**: The UI Layer.
  - `popup.html`: The only HTML file. Contains all UI sections (Hidden/Shown dynamically).
  - `popup.js`: The central orchestrator. Handles DOM events, state management, single-video auto-routing, and dynamic rendering.
  - `styles.css`: The Cyberpunk theme CSS.
- **`/core`**: The Brain (Business Logic).
  - `api.js`: Fetches playlist data via a Vercel backend proxy.
  - `planner.js`: Core algorithm for splitting videos into days based on watch time.
  - `plans.js`: CRUD operations for multiple plans and progress tracking.
  - `gamification.js`: Calculates XP, levels, and streaks based on watch time.
  - `storage.js`: Wrapper around `chrome.storage.local`.
- **`/background`**: Background Service Worker.
  - `background.js`: Routes messages, proxies fetches to bypass CORS (currently used for One-Shot duration scraping).
- **`/assets`**: Icons. Now uses `icon_human.jpg` perfectly resized to 16, 32, 48, 128 sizes.
- **`/_locales`**: Contains `messages.json` across 50 languages. The description has been universally updated to avoid mentioning "playback speed" and to reflect the new "Your playlists. Your plan. Your progress. Make every video count." text.

## 🔄 3. State Management (`appState`)
Inside `popup.js`, the entire app state is held in a single object:
```javascript
let appState = {
  playlistData: null,       // Fetched YouTube Data {id, title, videoCount, totalDuration, videos[]}
  plan: [],                 // The generated day-wise plan [{day: 1, videos: [], totalTime, completed}]
  currentPlanId: null,      // ID of the active plan being viewed
  dailyWatchTime: 0,        // User's chosen daily minute quota
  isAddingNewPlan: false,   // Wizard flow toggle
  plansCache: [],           // Array of all saved plans
  wizardStep: 'enter-url',  // Current step in the wizard
  mode: 'custom'            // 'custom' (Time-based) OR 'video-by-video'
};
```

## 🛤️ 4. Data Flow: End-to-End
1. **User pastes URL**: `popup.js` (`handleFetchPlaylist`) checks the URL.
2. **Auto-Detect**: If it's a playlist, it extracts the ID and calls `api.js`. If it's a single video (contains `/live/`, `?v=`, etc.), it automatically routes to `handleOneShotGenerate()`.
3. **Data Fetching**:
   - Playlists: Uses the Vercel backend.
   - One-Shot: Sends a message to `background.js` to fetch the raw YouTube HTML to extract duration (via Regex). *Note: This is brittle and will be replaced by FastAPI.*
4. **Plan Generation**: `planner.js` takes videos and `dailyWatchTime` to calculate chunks.
5. **Storage**: `plans.js` saves this plan to `chrome.storage.local`.
6. **UI Rendering**: `popup.js` builds Day Cards & Checkboxes dynamically.

## 🚀 5. FUTURE ROADMAP: The FastAPI Migration
We have agreed to move to a **FastAPI (Python) Backend** to make the extension lighter, cleaner, and more robust. 

**What will change:**
- **Remove Frontend Scraping:** The fragile regex parsing in `popup.js` (for `lengthSeconds` and `<meta itemprop="duration">`) will be deleted.
- **Remove Vercel Proxy:** The current Node.js proxy for playlists will be deprecated.
- **Centralized API:** `popup.js` will simply make a clean `fetch()` call to the FastAPI server: `fetch('https://api.planup.com/generate?url=...')`
- **Backend Tech Stack:** FastAPI, Uvicorn, Pydantic, and `yt-dlp` / YouTube Data API v3 to fetch 100% accurate video and playlist durations without client-side CORS issues.

**What will stay EXACTLY the same (100% Guaranteed):**
- The Cyberpunk UI (`popup.html` / `styles.css`).
- The `planner.js` logic (chunking math).
- Gamification (`gamification.js` - Streaks, XP).
- Data Storage (`storage.js` - Chrome Local Storage).

By keeping the state and UI identical, the FastAPI migration will just be a "pipe replacement" that massively reduces frontend code while maintaining exact UX behavior.
