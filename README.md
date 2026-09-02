# The Plane Factory

A facilitator-led web app for running an Agile paper airplane factory simulation with up to five teams of four or five students.

## The three sprints

1. **No instructions:** teams organise their own production process.
2. **One fold, then pass:** each person makes one fold and passes the plane on; nobody makes two consecutive folds on the same plane.
3. **Inspect and adapt:** teams identify a bottleneck from Sprint 2, choose one improvement experiment and design their own workflow.

Every production sprint lasts three minutes and uses the same Definition of Done. Keeping the quality bar stable makes the output data comparable across the three workflows.

The structure is adapted from PPM Academy's [Agile Paper Airplane Game](https://www.ppm.academy/post/the-agile-paper-airplane-game), with a shorter production timer and a deliberately team-led third sprint.

## Features

- Up to five named teams with four or five students each
- Projector-friendly three-minute timer with pause, reset, early finish and sound cues
- Built and passed counts for every team in every sprint
- Automatic rejected count and pass-rate calculation
- Sprint 3 improvement experiment log
- Throughput and pass-rate charts
- Team-by-team summary, winner and retrospective prompts
- Browser autosave and CSV export
- Responsive layout with no charting or UI-library dependencies

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test

```bash
npm test
npm run build
```

The app stores the active session in the browser's `localStorage`. It does not collect or transmit student data.
