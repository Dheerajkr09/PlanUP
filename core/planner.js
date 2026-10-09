/**
 * planner.js
 * Core algorithm for splitting playlist into day-wise schedule
 * Handles video distribution and partial video carryover
 */

/**
 * Generates a day-wise watch plan from videos and daily watch time
 * 
 * Algorithm:
 * - Videos are assigned sequentially to days
 * - If a video exceeds remaining daily time, it's split:
 *   → Partial time assigned to current day
 *   → Remainder carried over to next day
 * - Each day has a list of video segments to watch
 * 
 * @param {Array} videos - [{id, title, durationMinutes}]
 * @param {number} dailyWatchTimeMinutes - Minutes available per day
 * @returns {Array} - [{day, videos: [{title, startTime, endTime, duration}], totalTime, completed}]
 */
function generateDayWisePlan(videos, dailyWatchTimeMinutes, playbackSpeed = 1) {
  if (!videos || videos.length === 0) return [];
  if (!dailyWatchTimeMinutes || dailyWatchTimeMinutes <= 0) return [];
  
  const plan = [];
  let currentDay = 1;
  let remainingDailyTime = dailyWatchTimeMinutes; // in actual minutes
  let currentDayVideos = [];
  let currentDayTotalTime = 0; // in actual minutes
  
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    let videoRemainingTimeOriginal = video.durationMinutes;
    let videoStartTimeOriginal = 0;
    
    // Process this video (might span multiple days)
    while (videoRemainingTimeOriginal > 0.01) {
      const videoRemainingTimeActual = videoRemainingTimeOriginal / playbackSpeed;
      const timeToWatchActual = Math.min(videoRemainingTimeActual, remainingDailyTime);
      const timeToWatchOriginal = timeToWatchActual * playbackSpeed;
      const videoEndTimeOriginal = videoStartTimeOriginal + timeToWatchOriginal;
      
      // Add video segment to current day
      currentDayVideos.push({
        id: video.id || video.videoId,
        title: video.title,
        startTime: videoStartTimeOriginal > 0.01 ? videoStartTimeOriginal : null, // null means watch from beginning
        endTime: videoEndTimeOriginal < video.durationMinutes - 0.01 ? videoEndTimeOriginal : null, // null means watch to end
        duration: timeToWatchOriginal, // original duration of segment to show in UI
        isPartial: videoStartTimeOriginal > 0.01 || videoEndTimeOriginal < video.durationMinutes - 0.01,
        completed: false
      });
      
      currentDayTotalTime += timeToWatchActual;
      remainingDailyTime -= timeToWatchActual;
      videoRemainingTimeOriginal -= timeToWatchOriginal;
      videoStartTimeOriginal = videoEndTimeOriginal;
      
      // If day is full or video is done, finalize day
      if (remainingDailyTime <= 0.01 || (videoRemainingTimeOriginal <= 0.01 && i === videos.length - 1)) {
        plan.push({
          day: currentDay,
          videos: currentDayVideos,
          totalTime: currentDayTotalTime,
          completed: false
        });
        
        // Reset for next day
        currentDay++;
        remainingDailyTime = dailyWatchTimeMinutes;
        currentDayVideos = [];
        currentDayTotalTime = 0;
      }
    }
  }
  
  // Add any remaining partial day
  if (currentDayVideos.length > 0) {
    plan.push({
      day: currentDay,
      videos: currentDayVideos,
      totalTime: currentDayTotalTime,
      completed: false
    });
  }
  
  return plan;
}

/**
 * Generates a day-wise watch plan where each video gets its own day entry
 * 
 * @param {Array} videos - [{id, title, durationMinutes}]
 * @returns {Array} - [{day, videos: [{title, startTime, endTime, duration}], totalTime, completed}]
 */
function generateVideoByVideoplan(videos) {
  if (!videos || videos.length === 0) return [];
  
  const plan = [];
  
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const durationOriginal = video.durationMinutes;
    
    plan.push({
      day: i + 1,
      videos: [{
        id: video.id || video.videoId,
        title: video.title,
        startTime: null,
        endTime: null,
        duration: durationOriginal,
        isPartial: false,
        completed: false
      }],
      totalTime: durationOriginal,
      completed: false
    });
  }
  
  return plan;
}
