const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

const isDev = process.env.NODE_ENV === 'development'
const BACKEND_PORT = 3001
// The browsing root. Main and the backend must agree on this so a root-relative
// path from the renderer resolves to the same absolute path here.
const ROOT_DIR = process.env.ROOT_DIR || os.homedir()

let backendProcess

// Resolve a root-relative path to an absolute one, refusing to escape the root.
function resolveInRoot(relPath) {
  const abs = path.resolve(ROOT_DIR, String(relPath ?? '').replace(/^[/\\]+/, ''))
  if (abs !== ROOT_DIR && !abs.startsWith(ROOT_DIR + path.sep)) return null
  return abs
}

// Native file handlers: open with the OS default app / reveal in file manager.
ipcMain.handle('native:openPath', async (_e, relPath) => {
  const abs = resolveInRoot(relPath)
  if (!abs) return 'Path outside root'
  return shell.openPath(abs) // resolves to '' on success, or an error string
})
ipcMain.handle('native:showInFolder', (_e, relPath) => {
  const abs = resolveInRoot(relPath)
  if (abs) shell.showItemInFolder(abs)
})
// Resolve a root-relative path to its absolute on-disk path (for "Copy path").
ipcMain.handle('native:resolvePath', (_e, relPath) => resolveInRoot(relPath))

// Launch the file-explorer backend as a child process. Its SQLite DB lives
// under Electron's userData dir so favourites persist across restarts; the
// browsing root defaults to the user's home directory.
function startBackend() {
  const entry = path.join(__dirname, '..', 'backend', 'dist', 'server.js')
  // Use system Node: the backend's native module (better-sqlite3) is built for
  // Node's ABI, not Electron's, so we must not run it under Electron's runtime.
  backendProcess = spawn('node', [entry], {
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      ROOT_DIR,
      DATA_DIR: path.join(app.getPath('userData'), 'file-explorer'),
    },
    // 'pipe' (not 'inherit') so the child never holds our parent's stdio fds:
    // an orphaned child would otherwise keep the terminal pipe open forever.
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  backendProcess.stdout?.on('data', (d) => process.stdout.write(`[backend] ${d}`))
  backendProcess.stderr?.on('data', (d) => process.stderr.write(`[backend] ${d}`))
  backendProcess.on('error', (err) => console.error('Failed to spawn backend:', err))
  backendProcess.on('exit', (code) => {
    if (code) console.error(`Backend exited with code ${code}`)
  })
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) backendProcess.kill()
  backendProcess = undefined
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 680,
    minWidth: 720,
    minHeight: 480,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  // SKIP_BACKEND lets you run the backend yourself (e.g. `npm --prefix backend run dev`).
  if (!process.env.SKIP_BACKEND) startBackend()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Tear the backend down on every exit path, including signals (so it never
// outlives the app or holds an inherited pipe open).
app.on('before-quit', stopBackend)
process.on('exit', stopBackend)
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    stopBackend()
    app.quit()
    process.exit(0)
  })
}
