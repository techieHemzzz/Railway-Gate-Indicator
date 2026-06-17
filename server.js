/**
 * server.js
 * ------------------------------------------------------------------
 * REST API for the Railway Gate Status app.
 *
 * Endpoints:
 *   GET  /api/status            -> current gate status (the main one the app polls)
 *   GET  /api/schedule          -> today's full list of closure blocks
 *   GET  /api/trains            -> raw list of all train records (for admin/editing)
 *   POST /api/trains            -> add a new train record
 *   PUT  /api/trains/:id        -> update a train record
 *   DELETE /api/trains/:id      -> delete a train record
 *   GET  /health                -> simple health check for uptime monitors
 *
 * Run locally:
 *   npm install
 *   node server.js
 * Then visit http://localhost:3000/api/status
 * ------------------------------------------------------------------
 */
const express = require("express");
const cors = require("cors");
const db = require("./db");
const { getGateStatus } = require("./gateLogic");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Allow the mobile app (different origin) to call this API
app.use(express.json());

// Simple request logging -- helpful when debugging on a free-tier host
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ---- Health check (useful for Render.com / uptime pings) --------------
app.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ---- Main status endpoint ----------------------------------------------
app.get("/api/status", (req, res) => {
  try {
    const trains = db.getAllTrains();
    const result = getGateStatus(trains, new Date());

    // Shape the response to be easy for the frontend to consume directly
    res.json({
      status: result.status, // "OPEN" | "CLOSED" | "CLOSING_SOON"
      now: result.now,
      minutesUntilNextEvent: result.minutesUntilNextEvent,
      currentClosure: result.currentBlock
        ? {
            closesAt: result.currentBlock.closeAt,
            opensAt: result.currentBlock.openAt,
            trains: result.currentBlock.trains.map((t) => ({
              name: t.name,
              number: t.number,
              direction: t.direction,
            })),
          }
        : null,
      nextClosure: result.nextClosure
        ? {
            closesAt: result.nextClosure.closeAt,
            opensAt: result.nextClosure.openAt,
            trains: result.nextClosure.trains.map((t) => ({
              name: t.name,
              number: t.number,
              direction: t.direction,
            })),
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to compute gate status" });
  }
});

// ---- Today's full schedule (for a "schedule" screen in the app) -------
app.get("/api/schedule", (req, res) => {
  try {
    const trains = db.getAllTrains();
    const result = getGateStatus(trains, new Date());
    res.json({
      date: new Date().toISOString().slice(0, 10),
      blocks: result.todayBlocks.map((b) => ({
        closesAt: b.closeAt,
        opensAt: b.openAt,
        trains: b.trains.map((t) => ({
          name: t.name,
          number: t.number,
          direction: t.direction,
        })),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to build schedule" });
  }
});

// ---- Train CRUD (admin) -------------------------------------------------
app.get("/api/trains", (req, res) => {
  res.json(db.getAllTrains());
});

app.post("/api/trains", (req, res) => {
  const { name, number, direction, gate_pass_time, days, close_before_min, open_after_min } = req.body;

  if (!name || !gate_pass_time || !Array.isArray(days) || days.length === 0) {
    return res.status(400).json({
      error: "Required fields: name, gate_pass_time (HH:MM), days (non-empty array of e.g. ['MON','TUE'])",
    });
  }

  const newTrain = db.addTrain({
    name,
    number: number || "N/A",
    direction: direction || "unspecified",
    gate_pass_time,
    days,
    close_before_min: close_before_min ?? 4,
    open_after_min: open_after_min ?? 2,
  });
  res.status(201).json(newTrain);
});

app.put("/api/trains/:id", (req, res) => {
  const updated = db.updateTrain(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Train not found" });
  res.json(updated);
});

app.delete("/api/trains/:id", (req, res) => {
  const success = db.deleteTrain(req.params.id);
  if (!success) return res.status(404).json({ error: "Train not found" });
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Railway Gate Status API running on port ${PORT}`);
});
