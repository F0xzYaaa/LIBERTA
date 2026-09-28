# Frontend Security Notes

## npm audit — accepted risk (2026-07-11)

`npm audit` currently reports 6 advisories (3 moderate, 1 high, 2 critical) in the
`frontend/` dependency tree. Confirmed via `npm audit --omit=dev` that 0 of these
advisories ship in the production build — they are all in the dev-tooling/Vite build
chain, not in runtime application code.

CES has explicitly accepted this as-is rather than forcing a Vite major-version
upgrade for Stage 6. This is a recorded decision, not an open item — do not reopen
without CES re-evaluating.
