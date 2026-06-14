const { contextBridge, ipcRenderer } = require('electron')

// Backend base URL for the renderer's HTTP calls.
contextBridge.exposeInMainWorld('env', {
  apiBaseUrl: 'http://localhost:3001',
})

// Native file actions handled by the main process via the OS shell.
contextBridge.exposeInMainWorld('native', {
  // Open a file with the OS default app (e.g. a .js in your default editor).
  openPath: (relPath) => ipcRenderer.invoke('native:openPath', relPath),
  // Reveal the item in the system file manager.
  showInFolder: (relPath) => ipcRenderer.invoke('native:showInFolder', relPath),
  // Resolve a root-relative path to its absolute on-disk path.
  resolvePath: (relPath) => ipcRenderer.invoke('native:resolvePath', relPath),
})
