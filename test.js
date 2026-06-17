const { getGateStatus, mergeWindows, getWindowsForDate } = require("./gateLogic");

const ALL_DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// Sample trains roughly modeled on the Singaperumal Koil <-> Maraimalai
// Nagar EMU stretch we researched (placeholder times -- replace with
// real observed/timetable data in trains.json before relying on this).
const sampleTrains = [
  { id: 1, name: "Chengalpattu-Beach EMU", number: "40512", direction: "up", gate_pass_time: "06:55", days: ALL_DAYS },
  { id: 2, name: "Beach-Chengalpattu EMU", number: "40513", direction: "down", gate_pass_time: "07:05", days: ALL_DAYS },
  { id: 3, name: "Chengalpattu-Beach EMU", number: "40534", direction: "up", gate_pass_time: "11:50", days: ALL_DAYS },
  { id: 4, name: "Express overlap test A", number: "99991", direction: "up", gate_pass_time: "18:00", days: ALL_DAYS },
  { id: 5, name: "Express overlap test B", number: "99992", direction: "down", gate_pass_time: "18:03", days: ALL_DAYS },
  { id: 6, name: "Sunday-only special", number: "99993", direction: "up", gate_pass_time: "09:00", days: ["SUN"] },
];

function fmt(d) {
  return d.toTimeString().slice(0, 8);
}

console.log("=== TEST 1: Status well before any train (should be OPEN) ===");
let now = new Date();
now.setHours(5, 0, 0, 0);
let result = getGateStatus(sampleTrains, now);
console.log("now:", fmt(now), "-> status:", result.status, "| mins to next event:", result.minutesUntilNextEvent);
console.assert(result.status === "OPEN", "FAILED: expected OPEN");

console.log("\n=== TEST 2: Status during first train's closure window (should be CLOSED) ===");
now = new Date();
now.setHours(6, 53, 0, 0); // 2 min before 06:55 pass time, within 4-min close-before buffer
result = getGateStatus(sampleTrains, now);
console.log("now:", fmt(now), "-> status:", result.status, "| reopens in:", result.minutesUntilNextEvent, "min");
console.assert(result.status === "CLOSED", "FAILED: expected CLOSED");

console.log("\n=== TEST 3: CLOSING_SOON window (within 10 min of next closure) ===");
now = new Date();
now.setHours(6, 47, 0, 0); // 8 min before close-at (06:51)
result = getGateStatus(sampleTrains, now);
console.log("now:", fmt(now), "-> status:", result.status, "| closes in:", result.minutesUntilNextEvent, "min");
console.assert(result.status === "CLOSING_SOON", "FAILED: expected CLOSING_SOON");

console.log("\n=== TEST 4: Overlapping windows merge into one block (18:00 & 18:03 trains) ===");
now = new Date();
now.setHours(0, 0, 0, 0);
const windows = getWindowsForDate(sampleTrains, now);
const merged = mergeWindows(windows);
console.log("Total merged blocks today:", merged.length, "(expect 4: two separate morning EMUs + one merged evening block + ignoring Sunday-only if not Sunday)");
merged.forEach((b, i) => {
  console.log(
    `  Block ${i + 1}: ${fmt(b.closeAt)} -> ${fmt(b.openAt)} | trains: ${b.trains.map((t) => t.number).join(", ")}`
  );
});
const eveningBlock = merged.find((b) => b.trains.some((t) => t.number === "99991"));
console.assert(eveningBlock.trains.length === 2, "FAILED: expected the two 18:00/18:03 trains to merge into one block");

console.log("\n=== TEST 5: Day-of-week filtering (Sunday-only train) ===");
const sunday = new Date();
// Find next Sunday
sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7));
sunday.setHours(0, 0, 0, 0);
const sundayWindows = getWindowsForDate(sampleTrains, sunday);
const hasSpecial = sundayWindows.some((w) => w.train.number === "99993");
console.log("Sunday windows include special train 99993?", hasSpecial);
console.assert(hasSpecial, "FAILED: Sunday-only train should appear on Sunday");

const monday = new Date();
monday.setDate(monday.getDate() + ((1 - monday.getDay() + 7) % 7 || 7));
monday.setHours(0, 0, 0, 0);
const mondayWindows = getWindowsForDate(sampleTrains, monday);
const hasSpecialOnMonday = mondayWindows.some((w) => w.train.number === "99993");
console.log("Monday windows include special train 99993? (should be false)", hasSpecialOnMonday);
console.assert(!hasSpecialOnMonday, "FAILED: Sunday-only train should NOT appear on Monday");

console.log("\n✅ All tests completed (check for any 'FAILED' assertion messages above; none = all good).");
