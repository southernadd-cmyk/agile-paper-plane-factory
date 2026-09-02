import test from "node:test";
import assert from "node:assert/strict";
import {
  clampResult,
  createInitialGame,
  formatTimer,
  getWinner,
  makeCsv,
  resultMetrics,
  sessionTotals,
  sprintDelta,
} from "../lib/game.mjs";

test("creates a four-team game with three result sets", () => {
  const game = createInitialGame();
  assert.equal(game.teams.length, 4);
  assert.deepEqual(Object.keys(game.results), ["1", "2", "3"]);
  assert.equal(Object.keys(game.results[1]).length, 4);
});

test("caps passed planes at planes built", () => {
  assert.deepEqual(clampResult(8, 11), { built: 8, passed: 8 });
  assert.deepEqual(clampResult(-3, 2), { built: 0, passed: 0 });
});

test("calculates rejection and yield", () => {
  const result = resultMetrics({ built: 10, passed: 8 });
  assert.equal(result.rejected, 2);
  assert.equal(result.yieldRate, 80);
});

test("ranks the winner by total accepted output", () => {
  const game = createInitialGame(2);
  game.results[1]["team-1"] = { built: 5, passed: 4 };
  game.results[2]["team-1"] = { built: 7, passed: 6 };
  game.results[3]["team-1"] = { built: 8, passed: 8 };
  game.results[1]["team-2"] = { built: 10, passed: 3 };
  game.results[2]["team-2"] = { built: 11, passed: 4 };
  game.results[3]["team-2"] = { built: 12, passed: 5 };
  assert.equal(getWinner(game).leaders[0].id, "team-1");
  assert.equal(getWinner(game).accepted, 18);
});

test("summarises a complete five-team, three-sprint session", () => {
  const game = createInitialGame(5);
  for (const sprint of [1, 2, 3]) {
    for (let team = 1; team <= 5; team += 1) {
      game.results[sprint][`team-${team}`] = { built: sprint * 5 + team, passed: sprint * 4 + team };
    }
  }
  const totals = sessionTotals(game);
  assert.equal(totals.built, 195);
  assert.equal(totals.passed, 165);
  assert.equal(totals.rejected, 30);
  assert.equal(sprintDelta(game, "team-1"), 8);
});

test("exports one CSV row per team and sprint", () => {
  const game = createInitialGame(5);
  game.teams[0].name = 'Team "Glider", East';
  game.improvements["team-1"] = "Limit work in progress";
  const csv = makeCsv(game);
  assert.equal(csv.split("\n").length, 16);
  assert.match(csv, /"Team ""Glider"", East"/);
  assert.match(csv, /Limit work in progress/);
});

test("formats three-minute countdown values", () => {
  assert.equal(formatTimer(180), "3:00");
  assert.equal(formatTimer(5), "0:05");
  assert.equal(formatTimer(-1), "0:00");
});
