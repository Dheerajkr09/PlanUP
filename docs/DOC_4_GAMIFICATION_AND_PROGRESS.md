# 🎮 DOC 4: Gamification & Progress Engine (PlanUp)

## 📊 1. Progress Calculation (`deriveProgressFromPlanData`)
Progress is dynamically derived strictly from the `planData` array. It is NOT stored statically. Every time a checkbox is clicked, the entire progress state is recalculated.
- **Formula**: `(completedVideos / totalVideos) * 100`
- **Why Videos and not Days?** Because a day might have 5 small videos. Measuring by videos gives a smoother, more accurate progression line than jumping by whole days.
- **Initial State**: For a newly generated plan, `completedVideos` is 0, so progress is exactly `0%`.

## 📈 2. XP & Leveling Engine (`core/gamification.js`)
Gamification makes learning addictive.
- **XP Formula**: Earn XP relative to minutes watched.
  - Base: 1 XP per minute watched.
  - Video Complete Bonus: Flat bonus for finishing a video.
- **Level Curve**: RPG-style exponential scaling.
  - Formula: Cumulative XP to reach level `L` = `50 * L * (L - 1)`
  - Level 1: 0 XP
  - Level 2: 100 XP
  - Level 3: 300 XP
  - Level 4: 600 XP

## 🔥 3. The Streak System
- **Trigger**: Meeting the daily watch goal (e.g., completing the day's quota).
- **Tracking**: The system stores `lastActiveDate`. 
- **Validation**: 
  - If `today - lastActiveDate == 1 day`, Streak increments! (+1)
  - If `today - lastActiveDate == 0`, Streak stays the same (already claimed today).
  - If `today - lastActiveDate > 1 day`, Streak **RESETS TO 0** (Streak broken 😭).
- **Multipliers**: Higher streaks provide XP multipliers (e.g., 5-day streak = 1.2x XP per minute).

## 🛡️ 4. Badge System
- Badges are assigned visually based on Level or Streak milestones.
- Managed in HTML/CSS with local assets (`assets/badges/fire.png`, `star.png`, `badge.png`).
- The DOM updates the `<span>` values (`#streakValue`, `#xpValue`, `#levelValue`) synchronously when `syncAndRenderGamification()` is called in `popup.js`.

## 🛠️ 5. Avoiding Duplicate Rewards
- `gamification.js` stores `rewardedSegmentIds`.
- A segment ID is generated using the Video Title and Start/End times.
- Before awarding XP for a checkbox click, it checks if `rewardedSegmentIds` already contains this ID. This prevents users from toggling a checkbox on and off infinitely to farm XP.
