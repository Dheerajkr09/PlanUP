import { generateDayWisePlan } from './core/planner.js';

const videoData = {
  title: "My One Shot Video",
  durationMinutes: 120,
  videoId: "dQw4w9WgXcQ",
  thumbnail: "thumb"
};

const plan = generateDayWisePlan([videoData], 30);
console.log(JSON.stringify(plan, null, 2));
