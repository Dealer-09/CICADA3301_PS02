// panel.js — Perch panel renderer logic
(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // DOM References
  // ─────────────────────────────────────────────
  const panelWrapper = document.getElementById('panel-wrapper');
  const statusBar = document.getElementById('status-bar');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const stopBtn = document.getElementById('stop-btn');
  const chatArea = document.getElementById('chat-area');
  const emptyState = document.getElementById('empty-state');
  const taskGrid = document.getElementById('task-grid');
  const btnClear = document.getElementById('btn-clear');
  const btnSettings = document.getElementById('btn-settings');
  const btnClose = document.getElementById('btn-close');

  // Settings modal
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsApiKey = document.getElementById('settings-api-key');
  const settingsHoverDelay = document.getElementById('settings-hover-delay');
  const settingsAutostart = document.getElementById('settings-autostart');
  const settingsSave = document.getElementById('settings-save');
  const settingsCancel = document.getElementById('settings-cancel');
  const settingsQuit = document.getElementById('settings-quit');

  let isRunning = false;

  // ─────────────────────────────────────────────
  // Panel Visibility (hover tracking)
  // ─────────────────────────────────────────────
  const panel = document.getElementById('panel');

  panel.addEventListener('mouseenter', () => {
    window.perch.mouseEnteredPanel();
  });

  panel.addEventListener('mouseleave', () => {
    window.perch.mouseLeftPanel();
  });

  // Listen for show/hide commands from main process
  window.perch.onPanelShow(() => {
    panelWrapper.classList.add('visible');
  });

  window.perch.onPanelHide(() => {
    panelWrapper.classList.remove('visible');
  });

  // Make input focusable when clicked
  chatInput.addEventListener('focus', () => {
    // Panel becomes focusable when input gains focus
  });

  // ─────────────────────────────────────────────
  // Chat Logic
  // ─────────────────────────────────────────────
  function setStatus(status) {
    statusBar.className = '';
    if (status) statusBar.classList.add(status);
  }

  function addMessage(role, content) {
    emptyState.classList.add('hidden');

    const msg = document.createElement('div');
    msg.classList.add('message', role);

    if (role === 'tool-status') {
      msg.innerHTML = content;
    } else if (role === 'error') {
      msg.textContent = '⚠ ' + content;
    } else {
      msg.textContent = content;
    }

    chatArea.appendChild(msg);
    chatArea.scrollTop = chatArea.scrollHeight;
    return msg;
  }

  function addThinkingIndicator() {
    emptyState.classList.add('hidden');
    const indicator = document.createElement('div');
    indicator.classList.add('thinking-indicator');
    indicator.id = 'thinking';
    indicator.innerHTML = `
      <div class="thinking-dots">
        <span></span><span></span><span></span>
      </div>
    `;
    chatArea.appendChild(indicator);
    chatArea.scrollTop = chatArea.scrollHeight;
    return indicator;
  }

  function removeThinkingIndicator() {
    const el = document.getElementById('thinking');
    if (el) el.remove();
  }

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isRunning) return;

    chatInput.value = '';
    addMessage('user', text);
    startRunning();

    try {
      await window.perch.runAgent(text);
    } catch (err) {
      addMessage('error', err.message || 'Failed to run agent');
      stopRunning();
    }
  }

  function startRunning() {
    isRunning = true;
    setStatus('thinking');
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    chatInput.disabled = true;
    addThinkingIndicator();
  }

  function stopRunning() {
    isRunning = false;
    setStatus('');
    sendBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    chatInput.disabled = false;
    chatInput.focus();
    removeThinkingIndicator();
  }

  // Input events
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  stopBtn.addEventListener('click', async () => {
    await window.perch.stopAgent();
    stopRunning();
  });

  // ─────────────────────────────────────────────
  // Agent Event Listeners
  // ─────────────────────────────────────────────
  window.perch.onChunk((data) => {
    removeThinkingIndicator();
    setStatus('');
    addMessage('assistant', data.text);
  });

  window.perch.onTool((data) => {
    setStatus('executing');
    const inputStr = data.input ? Object.values(data.input).join(', ') : '';
    const display = inputStr ? `${inputStr.substring(0, 40)}${inputStr.length > 40 ? '...' : ''}` : '';
    addMessage('tool-status',
      `<span class="tool-icon">⚡</span> Running: <span class="tool-name">${data.name}</span> ${display ? '› ' + display : ''}`
    );
  });

  window.perch.onDone(() => {
    stopRunning();
  });

  window.perch.onError((data) => {
    removeThinkingIndicator();
    addMessage('error', data.message);
    stopRunning();
    setStatus('error');
    setTimeout(() => setStatus(''), 3000);
  });

  // Handle task run instruction (from main process when a task button is clicked via IPC)
  // This is triggered when tasks:run sends instruction back to renderer
  // We'll handle it by directly using runAgent from here instead

  // ─────────────────────────────────────────────
  // Task Grid
  // ─────────────────────────────────────────────
  function renderTasks(tasks) {
    taskGrid.innerHTML = '';
    tasks.forEach(task => {
      const btn = document.createElement('button');
      btn.classList.add('task-btn');
      btn.innerHTML = `
        <span class="task-icon">${task.icon || '⚡'}</span>
        <span class="task-name">${task.name}</span>
        <button class="task-delete" data-id="${task.id}" title="Remove">✕</button>
      `;

      btn.addEventListener('click', (e) => {
        // Check if delete button was clicked
        if (e.target.classList.contains('task-delete')) {
          e.stopPropagation();
          deleteTask(e.target.dataset.id);
          return;
        }
        runTaskInstruction(task.instruction);
      });

      taskGrid.appendChild(btn);
    });
  }

  async function runTaskInstruction(instruction) {
    if (isRunning) return;
    addMessage('user', instruction);
    startRunning();
    try {
      await window.perch.runAgent(instruction);
    } catch (err) {
      addMessage('error', err.message);
      stopRunning();
    }
  }

  async function deleteTask(taskId) {
    await window.perch.deleteTask(taskId);
    const tasks = await window.perch.getTasks();
    renderTasks(tasks);
  }

  window.perch.onTasksUpdated((data) => {
    renderTasks(data.tasks);
  });

  // ─────────────────────────────────────────────
  // Header Buttons
  // ─────────────────────────────────────────────
  btnClear.addEventListener('click', async () => {
    await window.perch.clearChatHistory();
    chatArea.innerHTML = '';
    emptyState.classList.remove('hidden');
    chatArea.appendChild(emptyState);
    setStatus('');
  });

  btnClose.addEventListener('click', () => {
    window.perch.hidePanel();
  });

  // ─────────────────────────────────────────────
  // Settings Modal
  // ─────────────────────────────────────────────
  btnSettings.addEventListener('click', async () => {
    const settings = await window.perch.getSettings();
    const maskedKey = await window.perch.getApiKey();

    settingsApiKey.value = '';
    settingsApiKey.placeholder = maskedKey || 'gsk_...';
    settingsHoverDelay.value = settings.hoverDelay || 800;

    if (settings.autoStart) {
      settingsAutostart.classList.add('on');
    } else {
      settingsAutostart.classList.remove('on');
    }

    settingsOverlay.classList.add('visible');
  });

  settingsAutostart.addEventListener('click', () => {
    settingsAutostart.classList.toggle('on');
  });

  settingsCancel.addEventListener('click', () => {
    settingsOverlay.classList.remove('visible');
  });

  settingsQuit.addEventListener('click', () => {
    window.perch.quitApp();
  });

  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) {
      settingsOverlay.classList.remove('visible');
    }
  });

  settingsSave.addEventListener('click', async () => {
    // Save API key if changed
    const newKey = settingsApiKey.value.trim();
    if (newKey) {
      await window.perch.setApiKey(newKey);
    }

    // Save hover delay
    const delay = parseInt(settingsHoverDelay.value) || 800;
    await window.perch.setSettings('hoverDelay', delay);

    // Save autostart
    const autoStart = settingsAutostart.classList.contains('on');
    await window.perch.setSettings('autoStart', autoStart);

    settingsOverlay.classList.remove('visible');
  });

  // ─────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────
  async function init() {
    // Load tasks
    const tasks = await window.perch.getTasks();
    renderTasks(tasks);

    // Load chat history
    const history = await window.perch.getChatHistory();
    if (history && history.length > 0) {
      emptyState.classList.add('hidden');
      history.forEach(msg => {
        addMessage(msg.role, msg.content);
      });
    }
  }

  init();
})();
