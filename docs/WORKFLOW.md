# Working on AHA(bit) tracker — Session Workflow

The goal: **any human or LLM agent can stop mid-project and resume with full
context**, even across different models and tools. The repo itself is the
memory — files, not chat history.

## The golden rule

> If a session changes the app's **behavior, structure, commands, data model,
> or decisions**, the docs must be updated in **the same session**.
> "A commit without documentation is a trap for the next session."

## Doc roles (when to update which file)

| Doc | Purpose | Update when… |
| --- | --- | --- |
| `docs/CONTEXT.md` | Resume entry point — snapshot of state, quick answers | Anything here stops being true (commands, file map, state, conventions) |
| `docs/ARCHITECTURE.md` | Deep dive: modules, data flows, build, testing | Structure/data flow changes |
| `docs/DECISIONS.md` | Append-only decision log (ADR-style, numbered) | A meaningful decision is made or reversed |
| `docs/ROADMAP.md` | Vision + feature status table | Something ships, starts, or is reprioritized |
| `docs/sessions/<date>-<topic>.md` | Per-session handoff notes | At the end of every session (the ritual below) |

## Starting a session (2 minutes)

1. `git status` and `git log --oneline -10` — know where the repo stands.
2. Read `docs/CONTEXT.md` **fully** (it's short on purpose).
3. Read the **newest** file in `docs/sessions/` for grainier recent context.
4. Drill into `ARCHITECTURE.md` / `DECISIONS.md` / `ROADMAP.md` only as needed.
5. **Restate the plan** in your own words before editing code. If the task is
   vague, list open questions for the user first.

## During a session

- Small, focused commits with conventional prefixes:
  `feat:` `fix:` `docs:` `chore:` `refactor:` `test:` `build:`.
- Log **new decisions** in `docs/DECISIONS.md` *at the moment they're made*
  (a decision logged days later loses its rationale).
- If you change how the app works (new view, data shape, command), update
  `CONTEXT.md` immediately, not at the end.
- Run `npm test` before finishing any work; `npm run build` when the HTML/CSS/JS
  output is affected. Fix regressions before committing.

## Ending a session (the handoff ritual — always do this)

1. **Green + clean:**
   - `git status` → clean (or commit remaining work now),
   - `npm test` passes (build too if relevant).
2. **Create the session file:**
   ```bash
   npm run session -- "short topic"        # e.g. "analytics trend lines"
   ```
   or copy `docs/sessions/_TEMPLATE.md` manually. Fill it in **honestly** —
   especially the *NEXT STEPS* and *State of the app* sections. If something is
   half-done or broken, say so explicitly; silence is how context dies.
3. **Update `docs/CONTEXT.md`:** the `Last handoff` table at the bottom + any
   changed quick facts / state / conventions.
4. **Update `docs/ROADMAP.md`** statuses if anything shipped or started.
5. **Commit with a handoff marker:**
   ```bash
   git add -A && git commit -m "docs: handoff 2026-09-15: short topic"
   ```
6. Push if a remote is configured (this repo: push manually when asked).

## Resumability checklist (what "ready to come back" looks like)

- [ ] Working tree clean
- [ ] `npm test` green
- [ ] New session file exists under `docs/sessions/` and is honest
- [ ] `CONTEXT.md` Last-handoff table + quick facts reflect reality
- [ ] `ROADMAP.md` statuses current
- [ ] Last commit message contains `docs: handoff`

## Tips for LLM agents specifically

- You have **no memory** — never assume the human remembers your reasoning
  either. Write decisions like someone will read them cold in 3 months.
- Prefer explicit file paths relative to repo root (e.g. `src/js/store.js`).
- If a task contradicts the docs, update the docs — don't just silently deviate.
- Keep session files under ~150 lines; put the *why* in DECISIONS.md, the
  *what-now* in the session file.
- When in doubt about intent, ask the user instead of guessing.