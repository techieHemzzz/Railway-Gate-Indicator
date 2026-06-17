/**
 * gateLogic.js
 * ------------------------------------------------------------------
 * Pure logic for computing railway gate open/closed status from a
 * list of train schedule entries. No DB or HTTP code here, so it's
 * easy to test in isolation (see test.js).
 *
 * CORE IDEA
 * Every train that passes the gate gets a computed "closure window":
 *   [gateClosesAt, gateOpensAt]
 * built from the train's scheduled passing time at the gate, plus a
 * configurable buffer before/after (real level crossings typically
 * close 3-5 min before the train arrives and reopen 1-2 min after it
 * fully clears, but this varies by gate -- you should tune the two
 * buffer constants below using real observations).
 *
 * The gate's *current* status is just: is "now" inside any train's
 * closure window? If multiple windows overlap (busy corridor, trains
 * close together), they merge into one continuous closure.
 * ------------------------------------------------------------------
 */

// ---- TUNABLE CONSTANTS -------------------------------------------------
// How many minutes BEFORE the train's scheduled passing time the gate
// typically comes down. Adjust based on real observation at your gate.
const DEFAULT_CLOSE_BEFORE_MIN = 4;

// How many minutes AFTER the train's scheduled passing time the gate
// typically goes back up (time for the train to fully clear + gateman
// to react).
const DEFAULT_OPEN_AFTER_MIN = 2;

// How far in advance we estimate the passing time at the gate from
// the nearest station's timing, in minutes per km, if you don't have
// a direct time for the gate itself. (Not used if gate time is given
// directly in the train record.)
// ------------------------------------------------------------------------

const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * Parse "HH:MM" (24-hr) into minutes-since-midnight.
 */
function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Given a train record and a reference Date, compute today's
 * [closeAt, openAt] window as Date objects. Returns null if this
 * train does not run on the reference date's weekday.
 *
 * Train record shape:
 * {
 *   id, name, number, direction, // 'up' or 'down' just for display
 *   gate_pass_time: "06:58",     // HH:MM 24-hr, estimated/observed time AT THE GATE
 *   days: ["MON","TUE","WED","THU","FRI","SAT","SUN"], // which days it runs
 *   close_before_min, open_after_min // optional per-train override of defaults
 * }
 */
function computeWindowForDate(train, referenceDate) {
  const weekday = DAY_CODES[referenceDate.getDay()];
  if (!train.days.includes(weekday)) return null;

  const passMinutes = timeToMinutes(train.gate_pass_time);
  const closeBefore = train.close_before_min ?? DEFAULT_CLOSE_BEFORE_MIN;
  const openAfter = train.open_after_min ?? DEFAULT_OPEN_AFTER_MIN;

  const baseDate = new Date(referenceDate);
  baseDate.setHours(0, 0, 0, 0);

  const passTime = new Date(baseDate.getTime() + passMinutes * 60000);
  const closeAt = new Date(passTime.getTime() - closeBefore * 60000);
  const openAt = new Date(passTime.getTime() + openAfter * 60000);

  return { train, passTime, closeAt, openAt };
}

/**
 * Build all closure windows for a given date across the full train list.
 * Returns an array of { train, passTime, closeAt, openAt }, sorted by closeAt.
 */
function getWindowsForDate(trains, referenceDate) {
  const windows = [];
  for (const train of trains) {
    const w = computeWindowForDate(train, referenceDate);
    if (w) windows.push(w);
  }
  windows.sort((a, b) => a.closeAt - b.closeAt);
  return windows;
}

/**
 * Merge overlapping/adjacent windows into continuous closure blocks.
 * Two windows merge if one starts before or at the moment the other ends.
 */
function mergeWindows(windows) {
  if (windows.length === 0) return [];
  const merged = [
    {
      closeAt: windows[0].closeAt,
      openAt: windows[0].openAt,
      trains: [windows[0].train],
    },
  ];

  for (let i = 1; i < windows.length; i++) {
    const w = windows[i];
    const last = merged[merged.length - 1];
    if (w.closeAt <= last.openAt) {
      // Overlaps or touches the previous block -- extend it
      if (w.openAt > last.openAt) last.openAt = w.openAt;
      last.trains.push(w.train);
    } else {
      merged.push({ closeAt: w.closeAt, openAt: w.openAt, trains: [w.train] });
    }
  }
  return merged;
}

/**
 * Main entry point: given the full train list and "now", return the
 * current status plus useful context for the UI.
 *
 * Returns:
 * {
 *   status: "OPEN" | "CLOSED" | "CLOSING_SOON",
 *   now: Date,
 *   currentBlock: {closeAt, openAt, trains} | null,   // if CLOSED
 *   nextClosure: {closeAt, openAt, trains} | null,     // next upcoming block
 *   minutesUntilNextEvent: number | null,
 *   todayBlocks: [...]  // all of today's merged closure blocks, for the schedule view
 * }
 */
function getGateStatus(trains, now = new Date(), closingSoonThresholdMin = 10) {
  // Need windows for "yesterday night -> tomorrow morning" edge cases,
  // but for simplicity (and because Indian Railways doesn't run trains
  // through a single gate at literal midnight edge in most rural cases)
  // we just compute today + tomorrow's first few blocks.
  const todayWindows = getWindowsForDate(trains, now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowWindows = getWindowsForDate(trains, tomorrow);

  const todayBlocks = mergeWindows(todayWindows);
  const tomorrowBlocks = mergeWindows(tomorrowWindows);

  // Is "now" inside any of today's blocks?
  const currentBlock = todayBlocks.find(
    (b) => now >= b.closeAt && now < b.openAt
  );

  if (currentBlock) {
    return {
      status: "CLOSED",
      now,
      currentBlock,
      nextClosure: null,
      minutesUntilNextEvent: Math.round((currentBlock.openAt - now) / 60000),
      todayBlocks,
    };
  }

  // Find the next upcoming block (today or tomorrow)
  const upcomingToday = todayBlocks.find((b) => b.closeAt > now);
  const nextClosure = upcomingToday || tomorrowBlocks[0] || null;

  if (nextClosure) {
    const minutesUntil = Math.round((nextClosure.closeAt - now) / 60000);
    const status = minutesUntil <= closingSoonThresholdMin ? "CLOSING_SOON" : "OPEN";
    return {
      status,
      now,
      currentBlock: null,
      nextClosure,
      minutesUntilNextEvent: minutesUntil,
      todayBlocks,
    };
  }

  // No trains scheduled at all (empty data, or none left today/tomorrow)
  return {
    status: "OPEN",
    now,
    currentBlock: null,
    nextClosure: null,
    minutesUntilNextEvent: null,
    todayBlocks,
  };
}

module.exports = {
  timeToMinutes,
  computeWindowForDate,
  getWindowsForDate,
  mergeWindows,
  getGateStatus,
  DAY_CODES,
  DEFAULT_CLOSE_BEFORE_MIN,
  DEFAULT_OPEN_AFTER_MIN,
};
