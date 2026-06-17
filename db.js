/**
 * db.js
 * ------------------------------------------------------------------
 * Minimal file-based "database" using a JSON file on disk.
 *
 * Why not a real database (Postgres/MySQL/SQLite)?
 * For a single-user (or small-village) app with a few hundred train
 * records, a JSON file is plenty, costs nothing, needs no native
 * binary dependencies (which caused install issues on some setups),
 * and is trivial to back up (just copy the file) or hand-edit.
 *
 * If you outgrow this later (multiple gates, many users, complex
 * queries), swap this file for a real SQLite/Postgres layer -- the
 * rest of the app (gateLogic.js, server.js routes) doesn't need to
 * change since they just call these functions.
 * ------------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "data", "trains.json");

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ trains: [], nextId: 1 }, null, 2));
  }
}

function readData() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getAllTrains() {
  return readData().trains;
}

function getTrainById(id) {
  return readData().trains.find((t) => t.id === Number(id));
}

function addTrain(train) {
  const data = readData();
  const newTrain = { ...train, id: data.nextId };
  data.trains.push(newTrain);
  data.nextId += 1;
  writeData(data);
  return newTrain;
}

function updateTrain(id, updates) {
  const data = readData();
  const idx = data.trains.findIndex((t) => t.id === Number(id));
  if (idx === -1) return null;
  data.trains[idx] = { ...data.trains[idx], ...updates, id: Number(id) };
  writeData(data);
  return data.trains[idx];
}

function deleteTrain(id) {
  const data = readData();
  const idx = data.trains.findIndex((t) => t.id === Number(id));
  if (idx === -1) return false;
  data.trains.splice(idx, 1);
  writeData(data);
  return true;
}

module.exports = {
  getAllTrains,
  getTrainById,
  addTrain,
  updateTrain,
  deleteTrain,
};
