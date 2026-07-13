const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bladevaultDesktop', {
  selectDirectory: () => ipcRenderer.invoke('bladevault:select-directory'),
})
