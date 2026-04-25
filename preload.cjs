// preload.js — Secure contextBridge for Niro
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('niro', {
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
  setApiKey: (args) => ipcRenderer.invoke('settings:setApiKey', args),

  // Browser Use (AI-powered real Chrome automation)
  browserRunTask: (task) => ipcRenderer.invoke('browser:run', task),
  browserNavigate: (url) => ipcRenderer.invoke('browser:navigate', url),
  currentPage: () => ipcRenderer.invoke('browser:page'),
  browserReady: () => ipcRenderer.invoke('browser:ready'),

  // Chat history & Audio
  getChatHistory: () => ipcRenderer.invoke('chat:getHistory'),
  clearChatHistory: () => ipcRenderer.invoke('chat:clear'),
  transcribeAudio: (buffer) => ipcRenderer.invoke('audio:transcribe', buffer),

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
