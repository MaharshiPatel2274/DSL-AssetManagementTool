const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectoryTree: (path) => ipcRenderer.invoke('read-directory-tree', path),
  saveJson: (data) => ipcRenderer.invoke('save-json', data),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  getCommonFolders: () => ipcRenderer.invoke('get-common-folders')
});
