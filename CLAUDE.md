# Acute

A desktop file explorer: **Electron** shell, **React + Mantine** renderer, and a
standalone **TypeScript/Express** backend that does all filesystem work. This
file is the orientation for working in this repo — read it before adding
features, then follow the conventions below.

## Run / build / test

```bash
npm install                 # root (renderer + electron)
npm run dev                 # builds backend, starts Vite + Electron (renderer HMR)
npm start                   # production build + launch
npm run build               # renderer only (Vite)

cd backend
npm install
npm test                    # vitest
npm run typecheck           # tsc -p tsconfig.test.json
npm run build               # tsc -> backend/dist
```

Backend runs from `backend/dist` (compiled), so **it is not hot-reloaded**.
After editing `backend/` or `electron/`, restart `npm run dev`. Renderer edits
HMR live.

## Layout

```
electron/        main.cjs (spawns backend, creates window), preload.cjs (window.native bridge)
backend/src/     3-tier server (see below); dist/ is the built output it runs from
src/             React renderer
  api.js         single HTTP client to the backend
  fileTypes.js   file-kind classification (image/video/audio/pdf/code/text)
  stores/        zustand stores, one per concern
  components/    UI; modals live at the app root
```

The renderer never touches the filesystem. It calls the backend over HTTP, or
the Electron bridge (`window.native`) for OS actions (open-with-default-app,
reveal-in-folder).

---

## Backend architecture

Strict **3-tier**, dependency-injected. Every feature is the same shape:

```
routes/ → controller (HTTP only) → service (business rules) → repository|fs (data)
```

`app.ts` is a `createApp({ db, rootDir, cacheDir })` factory: it constructs each
tier and injects dependencies. Tests call it with an in-memory DB + temp dirs.

**Layer responsibilities — keep them strict:**
- **Controller** maps HTTP ↔ service calls, nothing else. Wrap async handlers so
  rejections reach the error middleware: `const wrap = fn => (req,res,next) => fn(...).catch(next)`.
- **Service** owns all rules and validation; speaks only in **root-relative
  paths** and domain objects. No HTTP, no `fs`, no SQL. This is the unit-tested layer.
- **Repository / fs adapter** is the only place with SQL or `node:fs`.
  Repositories translate snake_case rows ↔ camelCase domain objects.

**To add an endpoint:** add the method to the service (with tests), expose it on
the controller, register the route in `routes/index.ts`, wire any new
dependency in `createApp`, and add it to `openapi.ts`.

**Conventions / invariants (do not break):**
- **Errors:** throw `AppError`/`ValidationError`/`NotFoundError` (carry
  `statusCode`); the one error middleware maps them to JSON + status. Services
  throw; controllers don't build error responses.
- **Path safety is one chokepoint:** `PathResolver` converts root-relative ↔
  absolute and rejects escapes. Every absolute path given to `fs` goes through
  it. `ROOT_DIR` confines all browsing (defaults to home; `electron/main.cjs`
  passes it to the backend and re-applies the same guard before `shell.openPath`).
- **Persistence:** SQLite via `better-sqlite3`. Migrations are idempotent +
  additive (`CREATE TABLE IF NOT EXISTS`; for new columns, check `PRAGMA
  table_info` then `ALTER TABLE ADD COLUMN`). Enable `PRAGMA foreign_keys = ON`.
  Hierarchies use an adjacency list (`parent_id`) and recursive CTEs for subtree
  queries; cycle checks live in the service.
- **Tests are hermetic:** in-memory SQLite + `os.tmpdir()` scratch dirs cleaned in
  `afterEach` (`tests/helpers.ts`). No fixtures on disk. Keep `npm test` green.
- **HTTP headers must be ASCII.** For filenames in `Content-Disposition`, use RFC
  5987 (`filename*=UTF-8''<encoded>`) plus an ASCII fallback.
- **CPU-heavy work is the backend's job, not the renderer's.** Image/video
  thumbnails are generated server-side (`sharp` / `ffmpeg` poster frame), cached
  to disk keyed by `absPath+mtime+size`, served as small WebP.
- **Native modules** (`better-sqlite3`, `sharp`) are built for Node's ABI →
  the backend must run under **system Node**, never Electron's runtime.
- API contract is hand-written in `openapi.ts`, served at `/api/docs`.

---

## Electron

- `main.cjs` spawns `node backend/dist/server.js` (system Node) and passes
  `PORT`, `ROOT_DIR`, `DATA_DIR` via env so both processes agree.
- Spawn with `stdio: ['ignore','pipe','pipe']` (never `'inherit'`), and kill the
  child on `before-quit` and on `SIGINT/SIGTERM/SIGHUP` + `process.exit` so it
  never orphans.
- `preload.cjs` exposes a minimal `window.native` and the backend URL via
  `contextBridge`. Renderer feature-detects `window.native` (degrades in a plain
  browser). Keep `contextIsolation: true`, `nodeIntegration: false`.

---

## Frontend architecture

### State: zustand, one store per concern
- Stores are small and single-purpose: `settingsStore`, `viewStore`,
  `playerStore`, `tagsStore`, `previewStore`, `contextMenuStore`. Persist only
  preferences (via `persist` + `partialize`), not transient UI state.
- **The backend is the source of truth.** Stores that mirror server data
  (`tagsStore`) re-fetch after mutations rather than diverging optimistically.
- New cross-cutting state → a new (or existing) store, not prop-drilling.

### Components
- **Modals live at the app root** (`main.jsx`) and open via store flags
  (`open()/close()`), never threaded through props.
- **Build generic, data-driven UI.** Example: one shared `ContextMenu` renders
  whatever item list a store holds (`{label, icon?, dot?, color?, checked?,
  onClick}` or `{divider}`); the caller decides the items. Anchor a Mantine
  `Menu` to a 0×0 element at the cursor for positioning + click-outside.
- **Prefer arrays where multiple is plausible** (`FileDetails` takes `files[]`)
  so features like multi-select don't require rewrites.
- File handling routes off `fileTypes.js#fileKind`; add new extensions/kinds there.

### Theming — use Mantine variables
- Theme is driven by a zustand setting and applied by Mantine; a `ThemeSync`
  component pushes the preference into Mantine's color scheme.
- Style every surface with Mantine CSS variables (`--mantine-color-default-hover`
  for hover/selection, `--mantine-color-default-border`, `c="dimmed"`, etc.) so
  light/dark flips automatically. Only hardcode colors that are intentionally
  theme-independent (e.g. a media player's black stage, user-chosen tag colors).
- A full skin (alternate theme) = a class on `<html>` + a scoped stylesheet that
  **redefines Mantine CSS variables**, rather than overriding inline styles.

### Performance — required for big directories
A folder can hold thousands of entries; the listing must stay smooth. Rules:
1. **Virtualize** the entry list (`VirtualEntries`, `@tanstack/react-virtual`).
   Use a plain scrollable `<div>` as the scroll parent (not Mantine `ScrollArea`,
   whose Radix wrapper breaks windowing offsets). Keep transient UI out of the
   scroll viewport so offsets start at 0.
2. **Memoize rows** (`React.memo`) **with referentially stable props**: all
   handlers via `useCallback`, derived values via `useMemo`, shared constants for
   empty arrays. This is what makes memo actually skip re-renders during scroll.
3. **Render hover-only chrome conditionally** (row action buttons mount on hover),
   keeping the slot's width reserved to avoid layout shift.
4. **Keep media elements mounted and load small assets** (backend WebP thumbnails
   via `<img loading="lazy" decoding="async">`). Don't swap elements on scroll.
5. **Lazy-load heavy deps.** Monaco (code preview) is `React.lazy` + `Suspense`,
   bundled locally for offline Electron (`monacoSetup.js`: `loader.config({ monaco })`
   + Vite `?worker` imports), so its large chunk only loads on demand.

### Media / interaction conventions
- Custom players replace native controls (fill the stage, controls fade on hover,
  wheel-adjustable volume with a padded hit zone, volume persisted in
  `playerStore`). Make whole rows clickable and pad small hit targets.

---

## Workflow
- Commit per feature; **gitmoji**-prefixed subject; body lists what changed.
- Git identity is the machine's global config — don't set a per-repo
  `user.email`.
- Before committing: renderer → `npm run build`; backend → `npm test` +
  `npm run typecheck`.
