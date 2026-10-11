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
 * Find plan matching current playlist or One-Shot video
 * @param {string} targetId - Current playlist ID or video ID
 * @param {Array} allPlans - All saved plans
 * @returns {object|null} Matching plan or null
 */
function findMatchingPlan(targetId, allPlans) {
  if (!targetId || !Array.isArray(allPlans) || allPlans.length === 0) {
    return null;
  }

  return allPlans.find(plan => {
    if (!plan) return false;

    // 1. Match playlist ID
    const planPlaylistId = extractPlaylistIdFromUrl(plan.playlistUrl || '');
    if (planPlaylistId && planPlaylistId === targetId) return true;

    // 2. Match video ID for One-Shot
    const planVideoId = extractVideoIdFromUrl(plan.playlistUrl || '') || (plan.id && plan.id.replace('oneshot_', ''));
    if (planVideoId && planVideoId === targetId) return true;

    // 3. Fallback URL contains match
    if (plan.playlistUrl && plan.playlistUrl.includes(targetId)) return true;
    if (plan.id && plan.id === targetId) return true;

    return false;
  }) || null;
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
 * Extract video ID from URL
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null
 */
function extractVideoIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|v=|\/live\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/**
 * Extract current target ID from page (playlistId if in playlist, else videoId)
 * @returns {string|null}
 */
function extractTargetIdFromPage() {
  const url = window.location.href;
  const listMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (listMatch) return listMatch[1];
  return extractVideoIdFromUrl(url);
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
  return /\/playlist\?|[?&]list=/.test(window.location.href);
}

/**
 * Check if current page is a single video watch page
 * @returns {boolean}
 */
function isWatchPage() {
  return window.location.pathname.startsWith('/watch') || window.location.href.includes('/watch?v=');
}

/**
 * Get current YouTube video title from DOM
 * @returns {string}
 */
function getYouTubeVideoTitle() {
  const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, ytd-watch-metadata #title h1, #title h1 yt-formatted-string');
  if (titleEl && titleEl.textContent && titleEl.textContent.trim()) {
    return titleEl.textContent.trim();
  }
  let t = document.title || '';
  if (t.endsWith(' - YouTube')) t = t.substring(0, t.length - 10);
  return t.trim();
}

/**
 * Parse string duration (e.g. "2:34:15" or "45:10") into seconds
 * @param {string} text
 * @returns {number}
 */
function parseDurationTextToSeconds(text) {
  if (!text) return 0;
  const parts = text.split(':').map(p => parseInt(p.trim(), 10) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Get current YouTube video duration in seconds from DOM
 * @returns {number}
 */
function getYouTubeVideoDuration() {
  const videoEl = document.querySelector('video.html5-main-video, video');
  if (videoEl && !isNaN(videoEl.duration) && videoEl.duration > 0) {
    return videoEl.duration;
  }
  const timeDurationEl = document.querySelector('.ytp-time-duration');
  if (timeDurationEl && timeDurationEl.textContent) {
    return parseDurationTextToSeconds(timeDurationEl.textContent.trim());
  }
  return 0;
}

/**
 * Check if title contains study keywords:
 * One Shot, Oneshot, Full Course, Complete Course, Lecture, Tutorial, Revision
 * @param {string} title
 * @returns {boolean}
 */
function hasStudyKeywords(title) {
  if (!title) return false;
  const regex = /\b(one[\s-_]?shot|full[\s-_]?course|complete[\s-_]?course|lecture|tutorial|revision)\b/i;
  return regex.test(title);
}

/**
 * Check if current single video satisfies One-Shot conditions:
 * Title contains study keywords AND duration is greater than 2 hours (7200 seconds)
 * @returns {boolean}
 */
function isEligibleOneShotVideo() {
  const title = getYouTubeVideoTitle();
  const durationSec = getYouTubeVideoDuration();

  const hasKeywords = hasStudyKeywords(title);
  const isOver2Hours = durationSec > 7200; // > 2 hours

  return hasKeywords && isOver2Hours;
}
