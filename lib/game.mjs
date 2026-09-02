export const SPRINT_SECONDS = 180;
export const MAX_TEAMS = 5;

export const TEAM_COLOURS = [
  "#ed6647",
  "#1f8a8a",
  "#5f63b8",
  "#cb8b21",
  "#3d7bb6",
];

export const SPRINTS = [
  {
    number: 1,
    eyebrow: "Baseline",
    title: "Find your own way",
    shortTitle: "No instructions",
    description:
      "Build as many test-ready planes as you can. No production method or roles are prescribed.",
    rule: "Organise yourselves. The facilitator will only explain the Definition of Done.",
    question: "What happened when the team had no shared production system?",
  },
  {
    number: 2,
    eyebrow: "Prescribed process",
    title: "One fold, then pass",
    shortTitle: "Fold and pass",
    description:
      "Each person makes exactly one fold, then passes the plane to another team member.",
    rule: "No one may make two consecutive folds on the same plane.",
    question: "Where did work queue up, and who was waiting?",
  },
  {
    number: 3,
    eyebrow: "Inspect and adapt",
    title: "Design a better system",
    shortTitle: "Team experiment",
    description:
      "Use the evidence from Sprint 2 to identify one bottleneck and run an improvement experiment.",
    rule: "The team chooses its own roles and flow. Keep the same quality standard.",
    question: "Which change improved flow or quality, and what evidence supports that?",
  },
];

export function makeTeam(index) {
  return {
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    size: 4,
    colour: TEAM_COLOURS[index % TEAM_COLOURS.length],
  };
}

export function blankResults(teams) {
  const results = {};
  for (const sprint of SPRINTS) {
    results[sprint.number] = {};
    for (const team of teams) {
      results[sprint.number][team.id] = { built: 0, passed: 0 };
    }
  }
  return results;
}

export function createInitialGame(teamCount = 4) {
  const safeCount = Math.min(MAX_TEAMS, Math.max(1, Number(teamCount) || 4));
  const teams = Array.from({ length: safeCount }, (_, index) => makeTeam(index));

  return {
    version: 1,
    sessionStarted: false,
    view: "setup",
    activeSprint: 1,
    teams,
    results: blankResults(teams),
    improvements: Object.fromEntries(teams.map((team) => [team.id, ""])),
    timer: {
      remaining: SPRINT_SECONDS,
      running: false,
      endAt: null,
      complete: false,
    },
    sound: true,
  };
}

export function clampResult(built, passed) {
  const safeBuilt = Math.max(0, Math.floor(Number(built) || 0));
  const safePassed = Math.min(
    safeBuilt,
    Math.max(0, Math.floor(Number(passed) || 0)),
  );
  return { built: safeBuilt, passed: safePassed };
}

export function resultMetrics(result = { built: 0, passed: 0 }) {
  const { built, passed } = clampResult(result.built, result.passed);
  return {
    built,
    passed,
    rejected: built - passed,
    yieldRate: built ? (passed / built) * 100 : 0,
  };
}

export function teamTotals(game, teamId) {
  return SPRINTS.reduce(
    (total, sprint) => {
      const metrics = resultMetrics(game.results?.[sprint.number]?.[teamId]);
      total.built += metrics.built;
      total.passed += metrics.passed;
      total.rejected += metrics.rejected;
      return total;
    },
    { built: 0, passed: 0, rejected: 0 },
  );
}

export function sessionTotals(game) {
  const totals = game.teams.reduce(
    (all, team) => {
      const teamTotal = teamTotals(game, team.id);
      all.built += teamTotal.built;
      all.passed += teamTotal.passed;
      all.rejected += teamTotal.rejected;
      return all;
    },
    { built: 0, passed: 0, rejected: 0 },
  );

  return {
    ...totals,
    yieldRate: totals.built ? (totals.passed / totals.built) * 100 : 0,
  };
}

export function getWinner(game) {
  if (!game.teams.length) return null;

  const ranked = game.teams
    .map((team) => ({ ...team, ...teamTotals(game, team.id) }))
    .sort((a, b) => b.passed - a.passed || b.built - a.built);

  if (!ranked[0].passed) return null;
  const tied = ranked.filter((team) => team.passed === ranked[0].passed);
  return { leaders: tied, accepted: ranked[0].passed };
}

export function sprintDelta(game, teamId) {
  const first = resultMetrics(game.results?.[1]?.[teamId]).passed;
  const third = resultMetrics(game.results?.[3]?.[teamId]).passed;
  return third - first;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function makeCsv(game) {
  const header = [
    "Team",
    "Team size",
    "Sprint",
    "Workflow",
    "Sprint 3 experiment",
    "Built",
    "Passed",
    "Rejected",
    "Pass rate",
  ];

  const rows = [header];
  for (const team of game.teams) {
    for (const sprint of SPRINTS) {
      const metrics = resultMetrics(game.results?.[sprint.number]?.[team.id]);
      rows.push([
        team.name,
        team.size,
        sprint.number,
        sprint.shortTitle,
        sprint.number === 3 ? game.improvements?.[team.id] || "" : "",
        metrics.built,
        metrics.passed,
        metrics.rejected,
        `${metrics.yieldRate.toFixed(1)}%`,
      ]);
    }
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function formatTimer(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export function normaliseGame(saved) {
  const fallback = createInitialGame();
  if (!saved || typeof saved !== "object" || !Array.isArray(saved.teams)) {
    return fallback;
  }

  const teams = saved.teams.slice(0, MAX_TEAMS).map((team, index) => ({
    ...makeTeam(index),
    ...team,
    size: team.size === 5 ? 5 : 4,
    colour: TEAM_COLOURS[index],
  }));

  if (!teams.length) teams.push(makeTeam(0));
  const results = blankResults(teams);
  for (const sprint of SPRINTS) {
    for (const team of teams) {
      results[sprint.number][team.id] = clampResult(
        saved.results?.[sprint.number]?.[team.id]?.built,
        saved.results?.[sprint.number]?.[team.id]?.passed,
      );
    }
  }

  let timer = {
    ...fallback.timer,
    ...(saved.timer || {}),
  };
  if (timer.running && timer.endAt) {
    const remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    timer = {
      ...timer,
      remaining,
      running: remaining > 0,
      complete: remaining === 0,
    };
  }

  return {
    ...fallback,
    ...saved,
    teams,
    results,
    improvements: {
      ...Object.fromEntries(teams.map((team) => [team.id, ""])),
      ...(saved.improvements || {}),
    },
    activeSprint: Math.min(3, Math.max(1, Number(saved.activeSprint) || 1)),
    timer,
  };
}
