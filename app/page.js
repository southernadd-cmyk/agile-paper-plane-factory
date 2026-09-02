"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  MAX_TEAMS,
  SPRINT_SECONDS,
  SPRINTS,
  TEAM_COLOURS,
  clampResult,
  createInitialGame,
  formatTimer,
  getWinner,
  makeCsv,
  makeTeam,
  normaliseGame,
  resultMetrics,
  sessionTotals,
  sprintDelta,
  teamTotals,
} from "../lib/game.mjs";

const STORAGE_KEY = "agile-paper-plane-factory-v1";

function PlaneMark({ compact = false }) {
  return (
    <div className={`plane-mark ${compact ? "plane-mark--compact" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img">
        <path d="M5 29.2 58.5 7 40.7 56.7 29.3 38.4 5 29.2Z" fill="currentColor" />
        <path d="m29.3 38.4 29.2-31.4-36 26.8 6.8 4.6Z" fill="#fff" opacity=".72" />
        <path d="m29.3 38.4 9.1 4.1 2.3 14.2-11.4-18.3Z" fill="#13283a" opacity=".28" />
      </svg>
    </div>
  );
}

function Icon({ name }) {
  const paths = {
    play: <path d="m9 7 8 5-8 5V7Z" />,
    pause: <><path d="M8 7h3v10H8z" /><path d="M13 7h3v10h-3z" /></>,
    reset: <><path d="M5.5 9A7 7 0 1 1 5 14" /><path d="M5.5 5v4h4" /></>,
    volume: <><path d="M5 10v4h3l4 3V7l-4 3H5Z" /><path d="M15 9.5a4 4 0 0 1 0 5" /></>,
    mute: <><path d="M5 10v4h3l4 3V7l-4 3H5Z" /><path d="m15 10 4 4m0-4-4 4" /></>,
    expand: <><path d="M9 5H5v4M15 5h4v4M9 19H5v-4m10 4h4v-4" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    download: <><path d="M12 4v11" /><path d="m8 11 4 4 4-4M5 19h14" /></>,
    chart: <><path d="M5 19V9m7 10V5m7 14v-7" /></>,
    warning: <><path d="M12 4 3.5 19h17L12 4Z" /><path d="M12 9v4m0 3h.01" /></>,
  };
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function ResetConfirm({ children, onConfirm }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="reset-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Start a new factory session?</AlertDialogTitle>
          <AlertDialogDescription>
            This clears all team names, sprint scores and improvement notes saved in this browser.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep current results</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Clear and start again</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AppHeader({ game, setGame }) {
  const toggleSound = () => setGame((current) => ({ ...current, sound: !current.sound }));
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <header className="app-header">
      <button
        className="brand"
        type="button"
        onClick={() => setGame((current) => ({ ...current, view: current.sessionStarted ? "dashboard" : "setup" }))}
        aria-label="Open Plane Factory home"
      >
        <PlaneMark compact />
        <span>
          <strong>The Plane Factory</strong>
          <small>Agile team simulation</small>
        </span>
      </button>
      <div className="header-actions">
        <button className="icon-button" type="button" onClick={toggleSound} aria-label={game.sound ? "Mute timer sounds" : "Enable timer sounds"}>
          <Icon name={game.sound ? "volume" : "mute"} />
        </button>
        <button className="icon-button" type="button" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
          <Icon name="expand" />
        </button>
      </div>
    </header>
  );
}

function ProgressRail({ game, navigate }) {
  const stages = [
    { key: "setup", label: "Set up" },
    ...SPRINTS.map((sprint) => ({ key: `sprint-${sprint.number}`, label: `Sprint ${sprint.number}` })),
    { key: "dashboard", label: "Results" },
  ];
  const activeKey = game.view === "sprint" || game.view === "score" ? `sprint-${game.activeSprint}` : game.view;

  return (
    <nav className="progress-rail" aria-label="Game progress">
      {stages.map((stage, index) => {
        const currentIndex = stages.findIndex((item) => item.key === activeKey);
        const isActive = stage.key === activeKey;
        const isPast = index < currentIndex;
        const disabled = !game.sessionStarted && stage.key !== "setup";
        return (
          <button
            key={stage.key}
            type="button"
            className={`${isActive ? "is-active" : ""} ${isPast ? "is-past" : ""}`}
            disabled={disabled}
            onClick={() => navigate(stage.key)}
          >
            <span>{isPast ? <Icon name="check" /> : index + 1}</span>
            {stage.label}
          </button>
        );
      })}
    </nav>
  );
}

function DefinitionOfDone({ className = "", showSummary = false }) {
  return (
    <section className={`dod-card ${className}`} aria-labelledby="dod-title">
      <div className="dod-heading">
        <p className="eyebrow">One quality bar · every sprint</p>
        <h2 id="dod-title">Definition of Done</h2>
        {showSummary && (
          <p className="dod-summary">
            A plane counts as passed only when every check is true.
          </p>
        )}
      </div>
      <ul className="check-list">
        <li><span><Icon name="check" /></span>Uses one sheet of paper</li>
        <li><span><Icon name="check" /></span>Shows the team name</li>
        <li><span><Icon name="check" /></span>Has no sharp pointed nose</li>
        <li><span><Icon name="check" /></span>Flies at least 3 metres</li>
        <li><span><Icon name="check" /></span>Accepted by the facilitator</li>
      </ul>
    </section>
  );
}

function FoldGuide() {
  const steps = [
    {
      title: "Make the centre line",
      detail: "Fold the sheet in half lengthways, crease it firmly, then open it again.",
    },
    {
      title: "Shape the nose",
      detail: "Bring both top corners in so their edges meet neatly on the centre line.",
    },
    {
      title: "Blunt the point",
      detail: "Fold the top tip down by about 2 cm to create a flat, safer leading edge.",
    },
    {
      title: "Lock the shape",
      detail: "Fold the new top corners inward, then lift the small centre flap over them.",
    },
    {
      title: "Form the wings",
      detail: "Fold the plane in half and bring each wing down evenly on both sides.",
    },
  ];

  return (
    <section className="fold-guide" aria-labelledby="fold-guide-title">
      <div className="fold-guide-heading">
        <div>
          <p className="eyebrow light">Product guide · same design every sprint</p>
          <h1 id="fold-guide-title">How to fold <em>the plane.</em></h1>
          <p>
            Use one repeatable five-step design. The process can change between sprints; the product standard cannot.
          </p>
        </div>
        <PlaneMark />
      </div>

      <div className="fold-facts" aria-label="Plane design facts">
        <span><strong>1</strong> sheet</span>
        <span><strong>5</strong> fold stages</span>
        <span><strong>0</strong> sharp points</span>
      </div>

      <ol className="fold-steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="fold-step-number">{String(index + 1).padStart(2, "0")}</span>
            <span>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SetupView({ game, setGame, onStart }) {
  const updateTeam = (id, field, value) => {
    setGame((current) => ({
      ...current,
      teams: current.teams.map((team) => (team.id === id ? { ...team, [field]: value } : team)),
    }));
  };

  const setTeamCount = (count) => {
    setGame((current) => {
      const nextTeams = Array.from({ length: count }, (_, index) => current.teams[index] || makeTeam(index));
      const nextResults = structuredClone(current.results);
      const improvements = { ...current.improvements };
      for (const sprint of SPRINTS) {
        nextResults[sprint.number] ||= {};
        for (const team of nextTeams) {
          nextResults[sprint.number][team.id] ||= { built: 0, passed: 0 };
          improvements[team.id] ||= "";
        }
      }
      return { ...current, teams: nextTeams, results: nextResults, improvements };
    });
  };

  return (
    <div className="view-stack">
      <div className="setup-guide-column">
        <FoldGuide />
        <DefinitionOfDone className="dod-card--setup" showSummary />
      </div>

      <section className="panel setup-panel" aria-labelledby="teams-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Factory floor</p>
            <h2 id="teams-title">Set up your teams</h2>
          </div>
          <label className="team-count">
            <span>Teams</span>
            <NativeSelect value={game.teams.length} onChange={(event) => setTeamCount(Number(event.target.value))}>
              {Array.from({ length: MAX_TEAMS }, (_, index) => index + 1).map((count) => (
                <NativeSelectOption key={count} value={count}>{count}</NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        </div>

        <div className="team-editor-list">
          {game.teams.map((team, index) => (
            <div className="team-editor" key={team.id} style={{ "--team": team.colour }}>
              <span className="team-number">{index + 1}</span>
              <label>
                <span>Team name</span>
                <input
                  value={team.name}
                  maxLength={28}
                  onChange={(event) => updateTeam(team.id, "name", event.target.value)}
                  onBlur={(event) => !event.target.value.trim() && updateTeam(team.id, "name", `Team ${index + 1}`)}
                />
              </label>
              <label>
                <span>Students</span>
                <NativeSelect value={team.size} onChange={(event) => updateTeam(team.id, "size", Number(event.target.value))}>
                  <NativeSelectOption value={4}>4</NativeSelectOption>
                  <NativeSelectOption value={5}>5</NativeSelectOption>
                </NativeSelect>
              </label>
            </div>
          ))}
        </div>

        <button className="primary-button start-button" type="button" onClick={onStart}>
          Start the factory <Icon name="arrow" />
        </button>
      </section>
    </div>
  );
}

function SprintBrief({ sprint, game, setGame }) {
  const experimentOptions = [
    "Limit work in progress",
    "Balance the folding steps",
    "Check quality as you go",
    "Use a dedicated tester",
  ];

  return (
    <section className={`sprint-brief sprint-brief--${sprint.number}`}>
      <div className="brief-number" aria-hidden="true">0{sprint.number}</div>
      <p className="eyebrow light">Sprint {sprint.number} · {sprint.eyebrow}</p>
      <h1>{sprint.title}</h1>
      <p className="brief-description">{sprint.description}</p>
      <div className="rule-callout">
        <span>Rule</span>
        <strong>{sprint.rule}</strong>
      </div>

      {sprint.number === 3 && (
        <div className="experiments">
          <p>Choose one improvement before starting:</p>
          <div className="experiment-list">
            {game.teams.map((team) => (
              <label key={team.id}>
                <span style={{ "--team": team.colour }}>{team.name}</span>
                <input
                  list={`experiment-options-${team.id}`}
                  value={game.improvements[team.id] || ""}
                  placeholder="Team’s experiment…"
                  onChange={(event) => setGame((current) => ({
                    ...current,
                    improvements: { ...current.improvements, [team.id]: event.target.value },
                  }))}
                />
                <datalist id={`experiment-options-${team.id}`}>
                  {experimentOptions.map((option) => <option key={option} value={option} />)}
                </datalist>
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Timer({ game, onStart, onPause, onReset, onFinish, onScore }) {
  const { remaining, running, complete } = game.timer;
  const progress = ((SPRINT_SECONDS - remaining) / SPRINT_SECONDS) * 360;
  const status = complete ? "Time" : running ? "Factory running" : remaining < SPRINT_SECONDS ? "Paused" : "Ready";

  return (
    <section className={`timer-panel ${running ? "is-running" : ""} ${complete ? "is-complete" : ""}`} aria-label="Sprint timer">
      <div className="timer-status"><span />{status}</div>
      <div className="timer-ring" style={{ "--progress": `${progress}deg` }}>
        <div className="timer-face">
          <strong aria-live="polite">{formatTimer(remaining)}</strong>
          <span>minutes</span>
        </div>
      </div>
      <div className="timer-controls">
        {!running && !complete && (
          <button className="timer-primary" type="button" onClick={onStart}>
            <Icon name="play" />{remaining < SPRINT_SECONDS ? "Resume" : "Start sprint"}
          </button>
        )}
        {running && (
          <button className="timer-primary" type="button" onClick={onPause}>
            <Icon name="pause" />Pause
          </button>
        )}
        {!complete && (
          <button className="timer-secondary" type="button" onClick={onReset} disabled={remaining === SPRINT_SECONDS && !running}>
            <Icon name="reset" />Reset
          </button>
        )}
        {running && (
          <button className="timer-secondary" type="button" onClick={onFinish}>End now</button>
        )}
      </div>
      {complete && (
        <div className="timer-finished">
          <strong>Hands off the planes!</strong>
          <span>Count everything built, then flight-test each plane.</span>
          <button className="primary-button" type="button" onClick={onScore}>Record results <Icon name="arrow" /></button>
        </div>
      )}
    </section>
  );
}

function SprintView({ game, setGame, controls }) {
  const sprint = SPRINTS[game.activeSprint - 1];
  return (
    <div className="sprint-layout">
      <SprintBrief sprint={sprint} game={game} setGame={setGame} />
      <Timer game={game} {...controls} />
      <aside className="floor-strip">
        <span>On the factory floor</span>
        <div>
          {game.teams.map((team) => (
            <span className="floor-team" key={team.id} style={{ "--team": team.colour }}>
              <i />{team.name}<small>{team.size}</small>
            </span>
          ))}
        </div>
      </aside>
    </div>
  );
}

function NumberControl({ value, min = 0, max, label, onChange }) {
  const safeValue = Number(value) || 0;
  return (
    <div className="number-control">
      <label>
        <span>{label}</span>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={safeValue}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <div>
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, safeValue - 1))}>−</button>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(max == null ? safeValue + 1 : Math.min(max, safeValue + 1))}>+</button>
      </div>
    </div>
  );
}

function ScoreView({ game, setGame, onContinue }) {
  const sprint = SPRINTS[game.activeSprint - 1];
  const updateResult = (teamId, field, value) => {
    setGame((current) => {
      const previous = current.results[current.activeSprint][teamId] || { built: 0, passed: 0 };
      let next;
      if (field === "built") {
        const built = Math.max(0, Math.floor(Number(value) || 0));
        next = { built, passed: Math.min(previous.passed, built) };
      } else {
        next = clampResult(previous.built, value);
      }
      return {
        ...current,
        results: {
          ...current.results,
          [current.activeSprint]: {
            ...current.results[current.activeSprint],
            [teamId]: next,
          },
        },
      };
    });
  };

  const sprintTotals = game.teams.reduce(
    (sum, team) => {
      const metric = resultMetrics(game.results[game.activeSprint][team.id]);
      sum.built += metric.built;
      sum.passed += metric.passed;
      return sum;
    },
    { built: 0, passed: 0 },
  );

  return (
    <div className="score-view">
      <section className="score-heading">
        <div>
          <p className="eyebrow">Sprint {sprint.number} · review</p>
          <h1>Count it. Test it. Log it.</h1>
          <p>Built is everything completed before time. Passed is only what meets every item in the Definition of Done.</p>
        </div>
        <div className="score-totals">
          <span><strong>{sprintTotals.built}</strong> built</span>
          <span><strong>{sprintTotals.passed}</strong> passed</span>
        </div>
      </section>

      <div className="score-grid">
        {game.teams.map((team, index) => {
          const result = resultMetrics(game.results[game.activeSprint][team.id]);
          return (
            <article className="score-card" key={team.id} style={{ "--team": team.colour }}>
              <header>
                <span>{index + 1}</span>
                <div><p>Team</p><h2>{team.name}</h2></div>
                <strong className="yield-pill">{result.yieldRate.toFixed(0)}% pass</strong>
              </header>
              <div className="score-controls">
                <NumberControl label="Planes built" value={result.built} onChange={(value) => updateResult(team.id, "built", value)} />
                <NumberControl label="Passed test" value={result.passed} max={result.built} onChange={(value) => updateResult(team.id, "passed", value)} />
              </div>
              <footer>
                <span><i className="accepted-dot" />{result.passed} accepted</span>
                <span><i className="rejected-dot" />{result.rejected} rejected</span>
              </footer>
            </article>
          );
        })}
      </div>

      <div className="score-footer">
        <DefinitionOfDone />
        <button className="primary-button" type="button" onClick={onContinue}>
          {game.activeSprint < 3 ? `Save & open Sprint ${game.activeSprint + 1}` : "Save & see results"}
          <Icon name="arrow" />
        </button>
      </div>
    </div>
  );
}

function ThroughputChart({ game }) {
  const width = 940;
  const height = 340;
  const margin = { top: 28, right: 20, bottom: 70, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const values = game.teams.flatMap((team) => SPRINTS.map((sprint) => resultMetrics(game.results[sprint.number][team.id]).built));
  const rawMax = Math.max(5, ...values);
  const step = rawMax <= 10 ? 2 : rawMax <= 25 ? 5 : 10;
  const max = Math.ceil(rawMax / step) * step;
  const groupWidth = plotWidth / game.teams.length;
  const barWidth = Math.min(34, (groupWidth - 30) / 3);
  const y = (value) => margin.top + plotHeight - (value / max) * plotHeight;

  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Planes built and passed by team and sprint">
        {Array.from({ length: max / step + 1 }, (_, index) => index * step).map((tick) => (
          <g key={tick}>
            <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className="grid-line" />
            <text x={margin.left - 10} y={y(tick) + 4} textAnchor="end" className="axis-text">{tick}</text>
          </g>
        ))}
        {game.teams.map((team, teamIndex) => {
          const groupStart = margin.left + teamIndex * groupWidth + (groupWidth - barWidth * 3 - 12 * 2) / 2;
          return (
            <g key={team.id}>
              {SPRINTS.map((sprint, sprintIndex) => {
                const result = resultMetrics(game.results[sprint.number][team.id]);
                const x = groupStart + sprintIndex * (barWidth + 12);
                const builtY = y(result.built);
                const passedY = y(result.passed);
                return (
                  <g key={sprint.number}>
                    <rect x={x} y={builtY} width={barWidth} height={Math.max(0, margin.top + plotHeight - builtY)} rx="5" fill={TEAM_COLOURS[sprintIndex]} opacity=".2" />
                    <rect x={x} y={passedY} width={barWidth} height={Math.max(0, margin.top + plotHeight - passedY)} rx="5" fill={TEAM_COLOURS[sprintIndex]} />
                    {result.built > 0 && <text x={x + barWidth / 2} y={builtY - 7} textAnchor="middle" className="bar-label">{result.passed}/{result.built}</text>}
                  </g>
                );
              })}
              <circle cx={margin.left + teamIndex * groupWidth + groupWidth / 2 - 5} cy={height - 27} r="4" fill={team.colour} />
              <text x={margin.left + teamIndex * groupWidth + groupWidth / 2 + 5} y={height - 23} textAnchor="middle" className="team-axis-text">
                {team.name.length > 15 ? `${team.name.slice(0, 14)}…` : team.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        {SPRINTS.map((sprint, index) => <span key={sprint.number}><i style={{ background: TEAM_COLOURS[index] }} />Sprint {sprint.number}</span>)}
        <span className="legend-note">label = passed / built</span>
      </div>
    </div>
  );
}

function QualityChart({ game }) {
  const width = 940;
  const height = 330;
  const margin = { top: 25, right: 35, bottom: 55, left: 52 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = (index) => margin.left + (index * plotWidth) / 2;
  const y = (value) => margin.top + plotHeight - (value / 100) * plotHeight;

  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Pass rate by team across three sprints">
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className="grid-line" />
            <text x={margin.left - 11} y={y(tick) + 4} textAnchor="end" className="axis-text">{tick}%</text>
          </g>
        ))}
        {SPRINTS.map((sprint, index) => (
          <text key={sprint.number} x={x(index)} y={height - 20} textAnchor="middle" className="team-axis-text">Sprint {sprint.number}</text>
        ))}
        {game.teams.map((team) => {
          const points = SPRINTS.map((sprint, index) => {
            const metric = resultMetrics(game.results[sprint.number][team.id]);
            return { x: x(index), y: y(metric.yieldRate), value: metric.yieldRate };
          });
          return (
            <g key={team.id}>
              <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={team.colour} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => (
                <g key={index}>
                  <circle cx={point.x} cy={point.y} r="7" fill="#fff" stroke={team.colour} strokeWidth="4" />
                  <text x={point.x} y={point.y - 14} textAnchor="middle" className="bar-label">{point.value.toFixed(0)}%</text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="chart-legend team-legend">
        {game.teams.map((team) => <span key={team.id}><i style={{ background: team.colour }} />{team.name}</span>)}
      </div>
    </div>
  );
}

function Dashboard({ game, onExport, onReset }) {
  const totals = sessionTotals(game);
  const winner = getWinner(game);
  const bestSprint = SPRINTS.map((sprint) => ({
    sprint: sprint.number,
    passed: game.teams.reduce((sum, team) => sum + resultMetrics(game.results[sprint.number][team.id]).passed, 0),
  })).sort((a, b) => b.passed - a.passed)[0];

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow light">Factory report</p>
          <h1>The evidence is in.</h1>
          <p>Compare throughput with quality before deciding which process worked best.</p>
        </div>
        <div className="dashboard-actions">
          <button className="secondary-button light-button" type="button" onClick={onExport}><Icon name="download" />Export CSV</button>
          <ResetConfirm onConfirm={onReset}>
            <button className="secondary-button light-button" type="button"><Icon name="reset" />New session</button>
          </ResetConfirm>
        </div>
      </section>

      <section className="metric-grid" aria-label="Session totals">
        <article><span>Total built</span><strong>{totals.built}</strong><small>across all sprints</small></article>
        <article className="accent"><span>Accepted</span><strong>{totals.passed}</strong><small>delivered value</small></article>
        <article><span>Overall pass rate</span><strong>{totals.yieldRate.toFixed(0)}%</strong><small>{totals.rejected} rejected</small></article>
        <article><span>Best sprint</span><strong>{bestSprint.passed ? `S${bestSprint.sprint}` : "—"}</strong><small>{bestSprint.passed} accepted planes</small></article>
      </section>

      {winner && (
        <section className="winner-banner">
          <PlaneMark compact />
          <div>
            <p>Highest total value</p>
            <h2>{winner.leaders.map((team) => team.name).join(" & ")}</h2>
          </div>
          <strong>{winner.accepted}<span>planes passed</span></strong>
        </section>
      )}

      <section className="chart-panel">
        <div className="chart-heading">
          <div><p className="eyebrow">Throughput + quality</p><h2>What each team delivered</h2></div>
          <p>Pale bars show everything built. Solid bars show the planes that passed.</p>
        </div>
        <ThroughputChart game={game} />
      </section>

      <section className="chart-panel">
        <div className="chart-heading">
          <div><p className="eyebrow">Quality trend</p><h2>Pass rate by sprint</h2></div>
          <p>A faster process is only better when it still meets the Definition of Done.</p>
        </div>
        <QualityChart game={game} />
      </section>

      <section className="team-results" aria-labelledby="team-results-title">
        <div className="section-heading">
          <p className="eyebrow">Team by team</p>
          <h2 id="team-results-title">Three-sprint comparison</h2>
        </div>
        <div className="team-result-grid">
          {game.teams.map((team) => {
            const totalsForTeam = teamTotals(game, team.id);
            const delta = sprintDelta(game, team.id);
            return (
              <article key={team.id} className="team-result-card" style={{ "--team": team.colour }}>
                <header><i /><div><p>{team.size} students</p><h3>{team.name}</h3></div><strong>{totalsForTeam.passed}<span>passed</span></strong></header>
                <div className="mini-sprints">
                  {SPRINTS.map((sprint) => {
                    const metric = resultMetrics(game.results[sprint.number][team.id]);
                    return <span key={sprint.number}><small>S{sprint.number}</small><strong>{metric.passed}</strong><em>of {metric.built}</em></span>;
                  })}
                </div>
                <footer className={delta > 0 ? "positive" : delta < 0 ? "negative" : ""}>
                  <span>Sprint 1 → 3</span><strong>{delta > 0 ? "+" : ""}{delta} accepted</strong>
                </footer>
                {game.improvements[team.id] && <p className="experiment-note"><span>Experiment</span>{game.improvements[team.id]}</p>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="debrief-panel">
        <div>
          <p className="eyebrow light">Retrospective</p>
          <h2>Don’t stop at “who won?”</h2>
          <p>Use the charts as evidence. Ask teams to separate output, value and predictability.</p>
        </div>
        <ol>
          {SPRINTS.map((sprint) => <li key={sprint.number}><span>0{sprint.number}</span><p>{sprint.question}</p></li>)}
          <li><span>04</span><p>If there were a fourth sprint, what is the smallest experiment you would try next?</p></li>
        </ol>
      </section>
    </div>
  );
}

function ResumeBanner({ onDiscard }) {
  return (
    <div className="resume-banner" role="status">
      <span><Icon name="warning" />This session was restored from this browser.</span>
      <ResetConfirm onConfirm={onDiscard}>
        <button type="button">Discard it</button>
      </ResetConfirm>
    </div>
  );
}

export default function Home() {
  const [game, setGame] = useState(null);
  const [restored, setRestored] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = normaliseGame(JSON.parse(stored));
        setGame(parsed);
        setRestored(parsed.sessionStarted);
        return;
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setGame(createInitialGame());
  }, []);

  useEffect(() => {
    if (game) localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  }, [game]);

  const beep = useCallback((frequency = 660, duration = 0.16) => {
    if (!game?.sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioRef.current ||= new AudioContext();
      const context = audioRef.current;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      // The visual timer still works if audio is unavailable.
    }
  }, [game?.sound]);

  useEffect(() => {
    if (!game?.timer.running) return undefined;
    const interval = window.setInterval(() => {
      setGame((current) => {
        if (!current.timer.running || !current.timer.endAt) return current;
        const remaining = Math.max(0, Math.ceil((current.timer.endAt - Date.now()) / 1000));
        if (remaining === 0) {
          return {
            ...current,
            timer: { remaining: 0, running: false, endAt: null, complete: true },
          };
        }
        return { ...current, timer: { ...current.timer, remaining } };
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [game?.timer.running]);

  const wasComplete = useRef(false);
  useEffect(() => {
    if (game?.timer.complete && !wasComplete.current) {
      beep(520, 0.18);
      window.setTimeout(() => beep(660, 0.18), 220);
      window.setTimeout(() => beep(820, 0.35), 440);
    }
    wasComplete.current = Boolean(game?.timer.complete);
  }, [game?.timer.complete, beep]);

  const navigate = (key) => {
    if (key.startsWith("sprint-")) {
      const number = Number(key.split("-")[1]);
      setGame((current) => ({
        ...current,
        view: "sprint",
        activeSprint: number,
        timer: { remaining: SPRINT_SECONDS, running: false, endAt: null, complete: false },
      }));
    } else {
      setGame((current) => ({ ...current, view: key }));
    }
  };

  const startSession = () => {
    setRestored(false);
    setGame((current) => ({
      ...current,
      sessionStarted: true,
      view: "sprint",
      activeSprint: 1,
      teams: current.teams.map((team, index) => ({ ...team, name: team.name.trim() || `Team ${index + 1}` })),
      timer: { remaining: SPRINT_SECONDS, running: false, endAt: null, complete: false },
    }));
  };

  const timerControls = useMemo(() => ({
    onStart: () => {
      beep(720, 0.12);
      setGame((current) => ({
        ...current,
        timer: {
          ...current.timer,
          running: true,
          complete: false,
          endAt: Date.now() + current.timer.remaining * 1000,
        },
      }));
    },
    onPause: () => setGame((current) => {
      const remaining = current.timer.endAt ? Math.max(0, Math.ceil((current.timer.endAt - Date.now()) / 1000)) : current.timer.remaining;
      return { ...current, timer: { ...current.timer, remaining, running: false, endAt: null } };
    }),
    onReset: () => setGame((current) => ({ ...current, timer: { remaining: SPRINT_SECONDS, running: false, endAt: null, complete: false } })),
    onFinish: () => setGame((current) => ({ ...current, timer: { remaining: 0, running: false, endAt: null, complete: true } })),
    onScore: () => setGame((current) => ({ ...current, view: "score" })),
  }), [beep]);

  const continueFromScore = () => {
    setGame((current) => {
      if (current.activeSprint === 3) return { ...current, view: "dashboard" };
      return {
        ...current,
        view: "sprint",
        activeSprint: current.activeSprint + 1,
        timer: { remaining: SPRINT_SECONDS, running: false, endAt: null, complete: false },
      };
    });
  };

  const resetSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    setRestored(false);
    setGame(createInitialGame());
  };

  const exportCsv = () => {
    const blob = new Blob([makeCsv(game)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `plane-factory-results-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!game) return <div className="loading"><PlaneMark /><span>Opening the factory…</span></div>;

  return (
    <div className="app-shell">
      <AppHeader game={game} setGame={setGame} />
      <ProgressRail game={game} navigate={navigate} />
      {restored && <ResumeBanner onDiscard={resetSession} />}
      <main>
        {game.view === "setup" && <SetupView game={game} setGame={setGame} onStart={startSession} />}
        {game.view === "sprint" && <SprintView game={game} setGame={setGame} controls={timerControls} />}
        {game.view === "score" && <ScoreView game={game} setGame={setGame} onContinue={continueFromScore} />}
        {game.view === "dashboard" && <Dashboard game={game} onExport={exportCsv} onReset={resetSession} />}
      </main>
      <footer className="app-footer">
        <span>The Plane Factory</span>
        <p>Built for reflection, not just speed.</p>
      </footer>
    </div>
  );
}
