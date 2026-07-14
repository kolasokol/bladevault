const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bladevaultDesktop', {
  selectDirectory: () => ipcRenderer.invoke('bladevault:select-directory'),
  getUpdateStatus: () => ipcRenderer.invoke('bladevault:get-update-status'),
  checkForUpdates: () => ipcRenderer.invoke('bladevault:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('bladevault:download-update'),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('bladevault:update-status', listener)
    return () =>
      ipcRenderer.removeListener('bladevault:update-status', listener)
  },
})
