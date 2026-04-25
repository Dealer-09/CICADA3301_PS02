// preload.js — Secure contextBridge for Perch
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('perch', {
  // Agent
  runAgent: (message) => ipcRenderer.invoke('agent:run', message),
  stopAgent: () => ipcRenderer.invoke('agent:stop'),

  // Tasks
  getTasks: () => ipcRenderer.invoke('tasks:get'),
  runTask: (taskId) => ipcRenderer.invoke('tasks:run', taskId),
  deleteTask: (taskId) => ipcRenderer.invoke('tasks:delete', taskId),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
  getApiKey: () => ipcRenderer.invoke('settings:getApiKey'),
  setApiKey: (key) => ipcRenderer.invoke('settings:setApiKey', key),

  // Chat history
  getChatHistory: () => ipcRenderer.invoke('chat:getHistory'),
  clearChatHistory: () => ipcRenderer.invoke('chat:clear'),

  // Panel visibility
  showPanel: () => ipcRenderer.send('panel:show'),
  hidePanel: () => ipcRenderer.send('panel:hide'),
  mouseEnteredPanel: () => ipcRenderer.send('panel:mouseEnter'),
  mouseLeftPanel: () => ipcRenderer.send('panel:mouseLeave'),

  // App lifecycle
  quitApp: () => ipcRenderer.send('app:quit'),

  // Sensor
  sensorHover: () => ipcRenderer.send('sensor:hover'),

  // Events from main → renderer
  onChunk: (callback) => ipcRenderer.on('agent:chunk', (_e, data) => callback(data)),
  onTool: (callback) => ipcRenderer.on('agent:tool', (_e, data) => callback(data)),
  onDone: (callback) => ipcRenderer.on('agent:done', (_e, data) => callback(data)),
  onError: (callback) => ipcRenderer.on('agent:error', (_e, data) => callback(data)),
  onTasksUpdated: (callback) => ipcRenderer.on('tasks:updated', (_e, data) => callback(data)),
  onPanelShow: (callback) => ipcRenderer.on('panel:doShow', (_e) => callback()),
  onPanelHide: (callback) => ipcRenderer.on('panel:doHide', (_e) => callback()),

  // Cleanup
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
