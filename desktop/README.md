# Chaewon Jeopardy — desktop shell

Electron wrapper around the FastAPI backend (bundled as a PyInstaller sidecar,
`rhubarb-backend.exe`) and the built Vite frontend. Plain CommonJS
(`main.cjs` / `preload.cjs`), no bundler.

The preload exposes `window.jeopardy` implementing **exactly** the
`DesktopBridge` contract in `frontend/src/lib/desktop.ts` (update state,
what's-new, `.rhubarb` import events).

## Dev run

Dev mode does **not** spawn the sidecar — it expects the normal dev servers to
already be running:

```powershell
# terminal 1, repo root — starts uvicorn :8000 + vite :5173
npm run dev

# terminal 2 — launch the Electron shell against the vite dev server
npm run desktop:dev
# (equivalent: cd desktop; npm run dev)
```

`main.cjs` treats a non-packaged app as dev automatically; you can also force
it with the env var `RHUBARB_DEV=1` (the RHUBARB_* env names kept their
rename-era spelling on purpose — invisible internals that ship in lockstep).
In dev the window loads `http://localhost:5173` and board-file imports POST
to `http://127.0.0.1:8000`.

## Package (Windows installer)

From the repo root:

```powershell
# full build: frontend dist -> backend exe (PyInstaller via uv) -> NSIS installer
npm run desktop:package

# faster: unpacked app in desktop/dist/win-unpacked (no installer)
npm run desktop:package:dir
```

Output lands in `desktop/dist/` (`Chaewon-Jeopardy-Setup.exe` — version-free
on purpose: one name serves the updater feed AND the permanent
releases/latest download link).

The installer is an assisted wizard (not one-click), per-user, registers the
`.jeopardy` (and rename-era `.rhubarb`) file associations, and bundles:

- `resources/rhubarb-backend.exe` — the FastAPI sidecar
- `resources/frontend-dist` — the built SPA (served by the sidecar via
  the `FRONTEND_DIST` env var)

At runtime the shell picks a free port, spawns the sidecar with
`PORT` / `RHUBARB_DATA_DIR` (`%APPDATA%\Chaewon Jeopardy`) /
`FRONTEND_DIST` / `RHUBARB_HOST` (`127.0.0.1` by default; the Settings
dialog's TV & wifi toggle persists the boolean `lan` in
`%APPDATA%\Chaewon Jeopardy\settings.json`, which makes the shell pass
`0.0.0.0` and pin port 8477), waits for `GET /api/health`, then shows the
window. The whole sidecar process tree is killed on quit.

## Publish an update (branch flow)

Releases are automated by `.github/workflows/release.yml`:

- **`dev`** — day-to-day work. Every push runs CI (backend tests, typecheck,
  build).
- **`main`** — the staging/release branch. Merging into `main` with a **new
  `version` in `desktop/package.json`** builds the Windows installer on a
  GitHub runner and publishes release `v{version}` with auto-generated notes.
  Every installed copy then self-updates.

So shipping is:

```powershell
git checkout dev            # ...work, commit, push, CI green...
# release prep, one commit:
#   1. bump "version" in desktop/package.json (e.g. 2.1.0 -> 2.2.0)
#   2. add a "## v2.2.0" section at the TOP of RELEASE_NOTES.md (cumulative changelog)
git checkout main
git merge dev
git push                    # -> Actions builds + publishes v2.2.0
```

Pushing to `main` without a version bump is a safe no-op (the workflow skips
when the release tag already exists).

**Change notes** live in `RELEASE_NOTES.md` at the repo root — they become the
GitHub release body AND the in-app "What's new" dialog. It is a cumulative changelog (newest
section on top); the workflow ships ONLY the section matching the version
being released, so stale notes can never ship: no matching section → GitHub's
auto-generated notes are used instead. Plain lines and `- ` bullets render
best in-app. You can still edit the release body on GitHub afterwards.

> **Visibility:** installed apps can only download updates if the repo (or a
> dedicated public releases repo) is public. A private repo's releases are
> invisible to your friends' machines.

Installed apps auto-check on launch and every 4 hours, download in the
background, show a "ready" state with the notes, and install either when the
user clicks restart-to-update or on next quit. After updating, the app shows
the release notes once ("what's new") until dismissed.

Manual/local build without publishing: `npm run desktop:package` at the repo
root (installer in `desktop/dist/`).
