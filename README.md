<div align="center">
  <img src="assets/icon128.png" alt="PlanUP Logo" width="100" />
  <h1>PlanUP</h1>
  <p><b>Plan Your Learning. Study Smart on YouTube.</b></p>
  <p>A privacy-first Chrome extension that transforms overwhelming YouTube playlists and marathon lectures into structured, achievable daily study goals directly inside YouTube.</p>

  <p>
    <a href="https://plan-up-jade.vercel.app"><img src="https://img.shields.io/badge/Website-plan--up-00f0ff?style=flat-square" alt="Website" /></a>
    <a href="https://plan-up-jade.vercel.app/support"><img src="https://img.shields.io/badge/Support-UPI%20%26%20Contribute-38bdf8?style=flat-square" alt="Support" /></a>
    <img src="https://img.shields.io/badge/Manifest-V3-10b981?style=flat-square" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License" />
  </p>
</div>

---

## ⚡ Overview

Self-studying on YouTube is powerful, but long playlists and 6-hour marathon courses are easy to abandon. **PlanUP** embeds directly into YouTube to give you an actionable roadmap:

- **No spreadsheets** or manual note-taking
- **No tab switching** — track progress right on the video page
- **No data collection** — all progress stays 100% on your device

---

## ✨ Features

- **In-Page Sidebar Tracker:** Live progress bar, current day target, and next video cues integrated directly into the YouTube playlist sidebar.
- **Dual Planning Modes:**
  - **Video-by-Video:** Complete a fixed number of videos each day. Best for short, structured courses.
  - **Custom Time Schedule:** Set a daily watch budget (e.g., 45 mins/day). Long lectures are automatically divided across days.
- **One-Shot & Livestream Support:** Plan multi-hour marathon videos and archived livestreams as structured multi-day modules.
- **Gamified Discipline:** Maintain daily study streaks and earn XP levels as you complete your syllabus.
- **100% Privacy-First:** Stores all study plans, progress, and streaks in your browser’s local storage (`chrome.storage.local`). Zero analytics, zero trackers.

---

## 🚀 Installation

### Option 1: Chrome Web Store
> *Currently submitted and under official review.* Once approved, install directly with one click from the Chrome Web Store.

### Option 2: Load Unpacked (Developer Mode)

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (top-left) and select the `my_project` folder:
   ```text
   C:\Users\HP\Desktop\yt plan\project\my_project
   ```
5. Open any YouTube playlist and click **Add New Plan** to get started!

---

## 🛠️ Tech Stack

- **Extension:** Chrome Extensions Manifest V3, Vanilla JavaScript, CSS3
- **Backend API:** Node.js, Express, Vercel Serverless Functions
- **Storage:** Chrome Local Storage API (`chrome.storage.local`)

---

## 💙 Support & Community

PlanUP is an independent, 100% free tool built for students and self-learners. If it helps you study with consistency, consider supporting its development:

- **Contribute / Support:** [Support PlanUP](https://plan-up-jade.vercel.app/support)
- **Live Landing Page:** [plan-up-jade.vercel.app](https://plan-up-jade.vercel.app)
- **Privacy Policy:** [Privacy Policy](https://plan-up-jade.vercel.app/privacy-policy)

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
