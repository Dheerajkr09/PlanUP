/**
 * progress-utils.js
 * Utility functions for playlist progress widget
 * Handles playlist ID extraction, plan matching, progress calculations
 */

/**
 * Extract playlist ID from current page URL
 * Handles both playlist page and watch page with list parameter
 * @returns {string|null} Playlist ID or null if not found
 */
function extractPlaylistIdFromPage() {
  const url = window.location.href;
  
  // Match both playlist pages and watch pages with list parameter
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Format minutes to human-readable time string
 * @param {number} minutes - Total minutes
 * @returns {string} Formatted time (e.g., "2h 30m", "45m")
 */
function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${mins}m`;
  }
}

/**
 * Calculate days remaining from current day
 * @param {number} currentDay - Current day (1-indexed)
 * @param {number} totalDays - Total days in plan
 * @returns {number} Days remaining (including today)
 */
function calculateDaysRemaining(currentDay, totalDays) {
  return Math.max(0, totalDays - currentDay + 1);
}

/**
 * Calculate total remaining minutes from current day onward
 * @param {Array} planData - Plan data array
 * @param {number} currentDay - Current day (1-indexed)
 * @returns {number} Total remaining minutes
 */
function calculateRemainingMinutes(planData, currentDay) {
  if (!Array.isArray(planData) || currentDay > planData.length) return 0;
  
  let totalMinutes = 0;
  for (let i = currentDay - 1; i < planData.length; i++) {
    if (planData[i] && planData[i].totalTime) {
      totalMinutes += planData[i].totalTime;
    }
  }
  
  return Math.round(totalMinutes);
}

/**
 * Get today's target info from plan
 * @param {Array} planData - Plan data array
 * @param {number} currentDay - Current day (1-indexed)
 * @returns {object} { videosCount, totalMinutes, completed }
 */
function getTodayTarget(planData, currentDay) {
  if (!Array.isArray(planData) || currentDay > planData.length || currentDay < 1) {
    return { videosCount: 0, totalMinutes: 0, completed: false };
  }
  
  const dayData = planData[currentDay - 1];
  if (!dayData) {
    return { videosCount: 0, totalMinutes: 0, completed: false };
  }
  
  return {
    videosCount: Array.isArray(dayData.videos) ? dayData.videos.length : 0,
    totalMinutes: dayData.totalTime || 0,
    completed: dayData.completed || false
  };
}

/**
 * Derive progress from plan data (matches plans.js logic)
 * @param {Array} planData - Day-wise plan array
 * @returns {object} { percent, completedDays, totalDays, currentDay }
 */
function deriveProgressFromPlan(planData) {
  if (!Array.isArray(planData) || planData.length === 0) {
    return {
      percent: 0,
      completedDays: 0,
      totalDays: 0,
      currentDay: 1,
      completedVideos: 0,
      totalVideos: 0
    };
  }

  let completedVideos = 0;
  let completedDays = 0;
  let totalVideos = 0;
  const totalDays = planData.length;

  planData.forEach(dayData => {
    const dayVideos = Array.isArray(dayData.videos) ? dayData.videos : [];
    totalVideos += dayVideos.length;
    if (dayData.completed) {
      completedDays += 1;
      completedVideos += dayVideos.length;
    } else {
      let dayCompletedCount = 0;
      dayVideos.forEach(video => {
        if (video.completed) {
          dayCompletedCount += 1;
        }
      });
      completedVideos += dayCompletedCount;
    }
  });

  // Calculate current day based on completion
  let currentDay = 1;
  for (let i = 0; i < planData.length; i++) {
    if (!planData[i].completed) {
      currentDay = i + 1;
      break;
    }
  }
  // If all days completed, set currentDay to totalDays
  if (completedDays === totalDays && totalDays > 0) {
    currentDay = totalDays;
  }

  const percent = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

  return {
    percent,
    completedDays,
    totalDays,
    currentDay,
    completedVideos,
    totalVideos
  };
}

/**
 * Find plan matching current playlist
 * @param {string} playlistId - Current playlist ID
 * @param {Array} allPlans - All saved plans
 * @returns {object|null} Matching plan or null
 */
function findMatchingPlan(playlistId, allPlans) {
  if (!playlistId || !Array.isArray(allPlans) || allPlans.length === 0) {
    return null;
  }

  // Extract playlistId from plan's playlistUrl
  const planMatches = allPlans.filter(plan => {
    if (!plan.playlistUrl) return false;
    const planPlaylistId = extractPlaylistIdFromUrl(plan.playlistUrl);
    return planPlaylistId === playlistId;
  });

  // Return first matching plan
  return planMatches.length > 0 ? planMatches[0] : null;
}

/**
 * Extract playlist ID from a full URL
 * @param {string} url - Full playlist URL
 * @returns {string|null} Playlist ID or null
 */
function extractPlaylistIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Debounce function to prevent excessive function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Check if current page is a YouTube playlist page
 * @returns {boolean} True if on playlist page
 */
function isPlaylistPage() {
  return /\/playlist\?|&list=/.test(window.location.href);
}
