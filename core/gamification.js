/**
 * gamification.js
 * Pure functions for per-playlist gamification logic.
 */

window.Gamification = (function() {
  // Helper to get local date string (YYYY-MM-DD)
  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Level computation: Cumulative XP to reach level L = 50 * L * (L - 1)
  function getLevelFromXp(xp) {
    let level = 1;
    while (true) {
      const nextLevelXp = 50 * (level + 1) * level;
      if (xp >= nextLevelXp) {
        level++;
      } else {
        break;
      }
    }
    return level;
  }

  function getProgress(xp) {
    const level = getLevelFromXp(xp);
    const currentLevelBaseXp = 50 * level * (level - 1);
    const nextLevelBaseXp = 50 * (level + 1) * level;
    
    const xpIntoCurrentLevel = xp - currentLevelBaseXp;
    const xpNeededForNextLevel = nextLevelBaseXp - currentLevelBaseXp;
    const progressPercent = Math.min(100, Math.floor((xpIntoCurrentLevel / xpNeededForNextLevel) * 100));
    
    return {
      level,
      xpIntoCurrentLevel,
      xpNeededForNextLevel,
      progressPercent
    };
  }

  // Daily rollover check
  function handleDailyRollover(state, todayStr) {
    const newState = { ...state };
    if (newState.minutesDate !== todayStr) {
      newState.minutesWatchedToday = 0;
      newState.minutesDate = todayStr;
    }
    return newState;
  }

  // Refresh streak on load
  function refreshStreak(state, todayStr = getLocalDateString()) {
    let newState = handleDailyRollover(state, todayStr);
    const events = [];
    
    if (newState.lastActiveDate) {
      const today = new Date(todayStr);
      const lastActive = new Date(newState.lastActiveDate);
      const diffTime = Math.abs(today - lastActive);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // If it's been more than 1 day since last activity, streak breaks.
      if (diffDays > 1) {
        newState.streak = 0;
        events.push('streakReset');
      }
    }
    return { state: newState, events };
  }

  function checkLevelUp(oldXp, newXp, events) {
    const oldLevel = getLevelFromXp(oldXp);
    const newLevel = getLevelFromXp(newXp);
    if (newLevel > oldLevel) {
      events.push({ type: 'levelUp', oldLevel, newLevel });
    }
  }

  // Add watched minutes
  function addWatchMinutes(state, minutes, todayStr = getLocalDateString()) {
    let newState = handleDailyRollover(state, todayStr);
    const events = [];
    
    const oldXp = newState.xp;
    newState.xp += minutes;
    newState.minutesWatchedToday += minutes;
    
    events.push({ type: 'xpGained', amount: minutes, reason: 'watchMinutes' });
    checkLevelUp(oldXp, newState.xp, events);
    
    // Check if daily goal reached
    const goalResult = checkAndClaimDailyGoal(newState, todayStr);
    newState = goalResult.state;
    events.push(...goalResult.events);
    
    newState.level = getLevelFromXp(newState.xp);
    return { state: newState, events };
  }

  // Complete a video
  function completeVideo(state, videoId, todayStr = getLocalDateString()) {
    let newState = handleDailyRollover(state, todayStr);
    const events = [];
    
    if (!newState.completedVideoIds.includes(videoId)) {
      newState.completedVideoIds = [...newState.completedVideoIds, videoId];
      
      const oldXp = newState.xp;
      newState.xp += 10;
      events.push({ type: 'xpGained', amount: 10, reason: 'videoCompleted' });
      checkLevelUp(oldXp, newState.xp, events);
      
      newState.level = getLevelFromXp(newState.xp);
    }
    
    return { state: newState, events };
  }

  // Claim daily goal and streak
  function checkAndClaimDailyGoal(state, todayStr = getLocalDateString()) {
    const newState = { ...state };
    const events = [];
    
    // Process streak logic: increases on FIRST TICK (minutesWatchedToday > 0)
    if (newState.minutesWatchedToday > 0 && newState.streakClaimedDate !== todayStr) {
      if (newState.lastActiveDate) {
        const today = new Date(todayStr);
        const lastActive = new Date(newState.lastActiveDate);
        const diffTime = Math.abs(today - lastActive);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          newState.streak += 1;
          events.push('streakIncreased');
        } else if (diffDays === 0) {
          // Already active today
        } else {
          newState.streak = 1;
        }
      } else {
        newState.streak = 1;
      }
      
      newState.bestStreak = Math.max(newState.bestStreak, newState.streak);
      newState.lastActiveDate = todayStr;
      newState.streakClaimedDate = todayStr;
    }
    
    // Process Daily Goal XP Bonus
    if (newState.minutesWatchedToday >= newState.dailyGoalMin && newState.goalClaimedDate !== todayStr) {
      newState.goalClaimedDate = todayStr;
      
      // Give rewards
      const oldXp = newState.xp;
      const streakBonus = Math.min(5 * newState.streak, 50);
      const totalBonus = 20 + streakBonus;
      
      newState.xp += totalBonus;
      events.push({ type: 'xpGained', amount: 20, reason: 'dailyGoal' });
      if (streakBonus > 0) {
        events.push({ type: 'xpGained', amount: streakBonus, reason: 'streakBonus' });
      }
      events.push('goalCompleted');
      
      checkLevelUp(oldXp, newState.xp, events);
      newState.level = getLevelFromXp(newState.xp);
    }
    
    return { state: newState, events };
  }

  // Remove watched minutes (and revert daily goal / streak if it drops below threshold)
  function removeWatchMinutes(state, minutes, todayStr = getLocalDateString()) {
    let newState = handleDailyRollover(state, todayStr);
    const events = [];
    
    newState.xp = Math.max(0, newState.xp - minutes);
    newState.minutesWatchedToday = Math.max(0, newState.minutesWatchedToday - minutes);
    
    // Check if we dropped below daily goal and need to revert BONUS
    const droppedBelowGoal = (newState.dailyGoalMin > 0 && newState.minutesWatchedToday < newState.dailyGoalMin) || 
                             (newState.dailyGoalMin === 0 && newState.minutesWatchedToday === 0);
                             
    if (newState.goalClaimedDate === todayStr && droppedBelowGoal) {
      newState.goalClaimedDate = null;
      
      const streakBonus = Math.min(5 * newState.streak, 50);
      const totalBonus = 20 + streakBonus;
      newState.xp = Math.max(0, newState.xp - totalBonus);
    }
    
    // Revert streak if ALL watch minutes for today are removed
    if (newState.streakClaimedDate === todayStr && newState.minutesWatchedToday <= 0) {
      newState.streakClaimedDate = null;
      if (newState.streak > 0) {
        newState.streak -= 1;
      }
      if (newState.streak === 0) {
        newState.lastActiveDate = null;
      }
    }
    
    newState.level = getLevelFromXp(newState.xp);
    return { state: newState, events };
  }

  // Uncomplete a video
  function uncompleteVideo(state, videoId, todayStr = getLocalDateString()) {
    let newState = handleDailyRollover(state, todayStr);
    const events = [];
    
    if (newState.completedVideoIds.includes(videoId)) {
      newState.completedVideoIds = newState.completedVideoIds.filter(id => id !== videoId);
      newState.xp = Math.max(0, newState.xp - 10);
      newState.level = getLevelFromXp(newState.xp);
    }
    
    return { state: newState, events };
  }

  return {
    getLocalDateString,
    getLevelFromXp,
    getProgress,
    refreshStreak,
    addWatchMinutes,
    removeWatchMinutes,
    completeVideo,
    uncompleteVideo,
    checkAndClaimDailyGoal
  };
})();
