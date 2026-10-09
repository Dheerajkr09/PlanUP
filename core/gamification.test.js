import {
  addWatchMinutes,
  completeVideo,
  refreshStreak,
  getProgress
} from './gamification.js';

function runTests() {
  console.log("--- GAMIFICATION TESTS ---");

  let state = {
    playlistId: 'test_123',
    title: 'Test Playlist',
    dailyGoalMin: 10,
    xp: 0,
    level: 1,
    streak: 0,
    bestStreak: 0,
    lastActiveDate: null,
    minutesDate: null,
    minutesWatchedToday: 0,
    goalClaimedDate: null,
    completedVideoIds: [],
    totalVideos: 84,
    totalMinutes: 1484
  };

  // Helper to log state
  const logState = (dayName) => {
    console.log(`[${dayName}] XP: ${state.xp}, Streak: ${state.streak}, Level: ${state.level}, Best Streak: ${state.bestStreak}`);
  };

  // Day 1
  let dateStr = '2023-10-01';
  let res = addWatchMinutes(state, 10, dateStr);
  state = res.state;
  res = completeVideo(state, 'vid_1', dateStr);
  state = res.state;
  logState('Day 1');
  // Expected: XP 45, Streak 1
  if (state.xp !== 45 || state.streak !== 1) console.error("Day 1 failed!");

  // Day 2
  dateStr = '2023-10-02';
  res = refreshStreak(state, dateStr);
  state = res.state;
  res = addWatchMinutes(state, 10, dateStr);
  state = res.state;
  logState('Day 2');
  // Expected: XP 85, Streak 2
  if (state.xp !== 85 || state.streak !== 2) console.error("Day 2 failed!");

  // Day 3
  dateStr = '2023-10-03';
  res = refreshStreak(state, dateStr);
  state = res.state;
  res = addWatchMinutes(state, 12, dateStr);
  state = res.state;
  res = completeVideo(state, 'vid_2', dateStr);
  state = res.state;
  logState('Day 3');
  // Expected: XP 142, Streak 3
  if (state.xp !== 142 || state.streak !== 3) console.error("Day 3 failed!");
  
  // Day 4 (Nothing happens, just refresh on Day 5)
  // Day 5
  dateStr = '2023-10-05';
  res = refreshStreak(state, dateStr);
  state = res.state;
  res = addWatchMinutes(state, 10, dateStr);
  state = res.state;
  logState('Day 5');
  // Expected: XP 177, Streak 1
  if (state.xp !== 177 || state.streak !== 1) console.error("Day 5 failed!");

  // Test progress
  const progress = getProgress(state.xp);
  console.log("Progress object:", progress);
  
  console.log("--- TESTS COMPLETED ---");
}

runTests();
