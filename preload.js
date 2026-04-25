const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    executeTask: (task) => ipcRenderer.invoke('execute-task', task),
    getTasks: () => ipcRenderer.invoke('get-tasks'),
    getScreenDimensions: () => ipcRenderer.invoke('get-screen-dimensions')
});
