# ⚙️ DOC 3: Core Logic & Planner Algorithm (PlanUp)

## 📅 1. The Planner Algorithm (`core/planner.js`)
The core functionality is splitting a sequential list of videos into Daily chunks.

### Mode A: Custom Schedule (Time-based)
- **Input**: Array of videos (with duration), `dailyWatchTimeMinutes`.
- **Logic**:
  1. Iterate through videos.
  2. Keep track of `remainingDailyTime`.
  3. If a video's duration > `remainingDailyTime`, it gets **SPLIT**:
     - A segment (e.g., 0 to 30 min) is added to the current day.
     - The day is marked complete.
     - The next day starts. The remainder of the video (30 min to End) is carried over.
  4. Video URLs are appended with `&t=XX` so users can resume exactly where they left off.

### Mode B: Video by Video
- **Input**: Array of videos.
- **Logic**: Much simpler. Exactly ONE video is assigned to ONE day, regardless of duration.

## 🗄️ 2. Chrome Storage Structure (`core/plans.js`)
Data is stored persistently in `chrome.storage.local` under the key `playlistPlans`.
```javascript
{
  plans: [
    {
      id: "plan-12345678-abcde",
      title: "React Course",
      playlistUrl: "https://youtube.com/...",
      totalVideos: 50,
      dailyMinutes: 30,
      mode: "custom",
      totalDays: 25,
      progress: { percent: 12, completedDays: 3, currentDay: 4 },
      planData: [
        {
          day: 1,
          completed: true,
          totalTime: 30,
          videos: [ { id: "vid1", title: "Intro", duration: 15, completed: true }, ... ]
        },
        // ... Day 2, Day 3, etc.
      ]
    }
  ],
  activePlanId: "plan-12345678-abcde"
}
```

## 🔄 3. CRUD Operations
- `createPlan()`: Initializes a new plan object, calculates initial progress (0%), pushes it to `plans` array, sets it as `activePlanId`, and saves.
- `deletePlan(planId)`: Removes the plan from the array. If the deleted plan was the `activePlanId`, it falls back to the first available plan or sets to `null`.
- `validateAndFixPlansState()`: Runs on load to ensure `activePlanId` actually exists in the array (prevents ghost states).

## 🕒 4. Time Conversion (`core/timeConverter.js`)
YouTube API v3 returns duration in **ISO 8601** format (e.g., `PT1H30M15S`).
- `parseISO8601Duration()` extracts Hours, Minutes, and Seconds via Regex.
- Converts everything to raw minutes as a float (e.g., `90.25`).
- `formatMinutes()` converts it back for UI display (e.g., `1h 30m`).
