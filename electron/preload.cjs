const { contextBridge, ipcRenderer } = require('electron')

// Backend base URL for the renderer's HTTP calls.
contextBridge.exposeInMainWorld('env', {
  apiBaseUrl: 'http://localhost:3001',
})

// The browsing root's absolute path, fetched once (synchronously) so the
// renderer can build local file:// URIs for drag-out without an async round-trip.
const rootDir = ipcRenderer.sendSync('native:rootDir')

// Native file actions handled by the main process via the OS shell.
contextBridge.exposeInMainWorld('native', {
  rootDir,
  // Open a file with the OS default app (e.g. a .js in your default editor).
  openPath: (relPath) => ipcRenderer.invoke('native:openPath', relPath),
  // Reveal the item in the system file manager.
  showInFolder: (relPath) => ipcRenderer.invoke('native:showInFolder', relPath),
  // Resolve a root-relative path to its absolute on-disk path.
  resolvePath: (relPath) => ipcRenderer.invoke('native:resolvePath', relPath),
  // The OS file-type icon as a PNG data URL (null if unavailable).
  fileIcon: (relPath) => ipcRenderer.invoke('native:fileIcon', relPath),
  // Copy file(s) to the OS clipboard (image bitmap when possible, else paths).
  copyToClipboard: (relPaths) => ipcRenderer.invoke('native:copyToClipboard', relPaths),
})
