// panel.js — Niro panel renderer logic
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
  const micBtn = document.getElementById('mic-btn');
  const chatArea = document.getElementById('chat-area');
  const emptyState = document.getElementById('empty-state');
  const taskGrid = document.getElementById('task-grid');
  const btnClear = document.getElementById('btn-clear');
  const btnSettings = document.getElementById('btn-settings');
  const btnClose = document.getElementById('btn-close');

  // Settings modal
  const settingsOverlay    = document.getElementById('settings-overlay');
  const settingsApiKey     = document.getElementById('settings-api-key');
  const settingsLocalBase  = document.getElementById('settings-local-base-url');
  const settingsLocalModel = document.getElementById('settings-local-model');
  const settingsHoverDelay = document.getElementById('settings-hover-delay');
  const settingsAutostart  = document.getElementById('settings-autostart');
  const settingsSave       = document.getElementById('settings-save');
  const settingsCancel     = document.getElementById('settings-cancel');
  const settingsQuit       = document.getElementById('settings-quit');
  const sectionGroq        = document.getElementById('section-groq');
  const sectionLocal       = document.getElementById('section-local');
  const providerTabs       = document.getElementById('provider-tabs');
  const localStatusContainer = document.getElementById('local-status-container');
  const localStatusMsg     = document.getElementById('local-status-msg');
  const localStatusPct     = document.getElementById('local-status-pct');
  const localStatusBar     = document.getElementById('local-status-bar');

  let activeProvider = 'groq'; // tracks what's currently selected in settings modal
  let currentStreamingMsg = null;

  // Provider tab toggle
  providerTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.provider-tab');
    if (!tab) return;
    activeProvider = tab.dataset.provider;
    providerTabs.querySelectorAll('.provider-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    sectionGroq.classList.toggle('hidden', activeProvider !== 'groq');
    sectionLocal.classList.toggle('hidden', activeProvider !== 'local');
    // Hide local status when switching away from local-embedded (or if it's already ready)
    if (activeProvider !== 'local-embedded') {
      localStatusContainer.classList.add('hidden');
    } else {
      // Re-check status if switching to local-embedded
      updateLlmStatus();
    }
  });

  let isRunning = false;

  // ─────────────────────────────────────────────
  // Panel Visibility (hover tracking)
  // ─────────────────────────────────────────────
  const panel = document.getElementById('panel');

  panel.addEventListener('mouseenter', () => {
    window.niro.mouseEnteredPanel();
  });

  panel.addEventListener('mouseleave', () => {
    window.niro.mouseLeftPanel();
  });

  // Listen for show/hide commands from main process
  window.niro.onPanelShow(() => {
    panelWrapper.classList.add('visible');
  });

  window.niro.onPanelHide(() => {
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
    currentStreamingMsg = null;
    addMessage('user', text);
    startRunning();

    try {
      await window.niro.runAgent(text);
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
    await window.niro.stopAgent();
    stopRunning();
  });

  // ─────────────────────────────────────────────
  // Voice Input (MediaRecorder)
  // ─────────────────────────────────────────────
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;

  micBtn.addEventListener('click', async () => {
    if (isRecording) {
      mediaRecorder.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        // Stop all tracks to release the mic
        stream.getTracks().forEach(track => track.stop());

        micBtn.classList.remove('recording');
        isRecording = false;
        
        // Show status
        chatInput.disabled = true;
        chatInput.placeholder = 'Transcribing...';
        setStatus('thinking');

        try {
          const transcription = await window.niro.transcribeAudio(arrayBuffer);
          chatInput.value = transcription.text || transcription;
        } catch (err) {
          addMessage('error', 'Transcription failed: ' + err.message);
        } finally {
          chatInput.disabled = false;
          chatInput.placeholder = 'Message your Twin...';
          chatInput.focus();
          setStatus('');
        }
      };

      mediaRecorder.start();
      isRecording = true;
      micBtn.classList.add('recording');
      
      // Give text feedback
      chatInput.placeholder = '● Recording... (Click mic to stop)';
      chatInput.value = '';
    } catch (err) {
      addMessage('error', 'Microphone access denied: ' + err.message);
    }
  });

  // ─────────────────────────────────────────────
  // Agent Event Listeners
  // ─────────────────────────────────────────────
  window.niro.onChunk((data) => {
    removeThinkingIndicator();
    setStatus('');
    
    if (currentStreamingMsg) {
      currentStreamingMsg.textContent += data.text;
      chatArea.scrollTop = chatArea.scrollHeight;
    } else {
      currentStreamingMsg = addMessage('assistant', data.text);
    }
  });

  window.niro.onTool((data) => {
    setStatus('executing');
    currentStreamingMsg = null;
    const inputStr = data.input ? Object.values(data.input).join(', ') : '';
    const display = inputStr ? `${inputStr.substring(0, 40)}${inputStr.length > 40 ? '...' : ''}` : '';
    addMessage('tool-status',
      `<span class="tool-icon">⚡</span> Running: <span class="tool-name">${data.name}</span> ${display ? '› ' + display : ''}`
    );
  });

  window.niro.onDone(() => {
    currentStreamingMsg = null;
    stopRunning();
  });

  window.niro.onError((data) => {
    removeThinkingIndicator();
    currentStreamingMsg = null;
    addMessage('error', data.message);
    stopRunning();
    setStatus('error');
    setTimeout(() => setStatus(''), 3000);
  });

  window.niro.onLlmStatus((status) => {
    handleLlmStatus(status);
  });

  function handleLlmStatus(status) {
    if (status.state === 'ready') {
      localStatusContainer.classList.add('hidden');
      return;
    }
    
    // Only show progress if we are actually using local-embedded
    if (activeProvider === 'local-embedded') {
      localStatusContainer.classList.remove('hidden');
      localStatusMsg.textContent = status.message || 'Processing...';
      localStatusPct.textContent = `${status.progress}%`;
      localStatusBar.style.width = `${status.progress}%`;
    }
  }

  async function updateLlmStatus() {
    const status = await window.niro.getLlmStatus();
    handleLlmStatus(status);
  }

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
    currentStreamingMsg = null;
    addMessage('user', instruction);
    startRunning();
    try {
      await window.niro.runAgent(instruction);
    } catch (err) {
      addMessage('error', err.message);
      stopRunning();
    }
  }

  async function deleteTask(taskId) {
    await window.niro.deleteTask(taskId);
    const tasks = await window.niro.getTasks();
    renderTasks(tasks);
  }

  window.niro.onTasksUpdated((data) => {
    renderTasks(data.tasks);
  });

  // ─────────────────────────────────────────────
  // Header Buttons
  // ─────────────────────────────────────────────
  btnClear.addEventListener('click', async () => {
    await window.niro.clearChatHistory();
    chatArea.innerHTML = '';
    emptyState.classList.remove('hidden');
    chatArea.appendChild(emptyState);
    setStatus('');
  });

  btnClose.addEventListener('click', () => {
    window.niro.hidePanel();
  });

  // ─────────────────────────────────────────────
  // Settings Modal
  // ─────────────────────────────────────────────
  btnSettings.addEventListener('click', async () => {
    const [settings, maskedKey, providerCfg] = await Promise.all([
      window.niro.getSettings(),
      window.niro.getApiKey(),
      window.niro.getProviderConfig(),
    ]);

    // Set provider tab
    activeProvider = providerCfg.provider || 'groq';
    providerTabs.querySelectorAll('.provider-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.provider === activeProvider);
    });
    sectionGroq.classList.toggle('hidden', activeProvider !== 'groq');
    sectionLocal.classList.toggle('hidden', activeProvider !== 'local');
    
    if (activeProvider === 'local-embedded') {
      updateLlmStatus();
    }

    // Pre-fill fields
    settingsApiKey.value = '';
    settingsApiKey.placeholder = maskedKey || 'gsk_...';
    settingsLocalBase.value  = providerCfg.localBaseUrl || 'http://localhost:11434/v1';
    settingsLocalModel.value = providerCfg.localModel   || 'llama3';
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
    window.niro.quitApp();
  });

  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) {
      settingsOverlay.classList.remove('visible');
    }
  });

  settingsSave.addEventListener('click', async () => {
    // Save provider config
    await window.niro.setProviderConfig({
      provider:     activeProvider,
      localBaseUrl: settingsLocalBase.value.trim()  || 'http://localhost:11434/v1',
      localModel:   settingsLocalModel.value.trim() || 'llama3',
    });

    // Save Groq API key if changed (only relevant when provider = groq)
    const newKey = settingsApiKey.value.trim();
    if (newKey) await window.niro.setApiKey({ key: newKey });

    // Save hover delay
    const delay = parseInt(settingsHoverDelay.value) || 800;
    await window.niro.setSettings('hoverDelay', delay);

    // Save autostart
    const autoStart = settingsAutostart.classList.contains('on');
    await window.niro.setSettings('autoStart', autoStart);

    settingsOverlay.classList.remove('visible');
  });

  // ─────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────
  async function init() {
    // Load tasks
    const tasks = await window.niro.getTasks();
    renderTasks(tasks);

    // Load chat history
    const history = await window.niro.getChatHistory();
    if (history && history.length > 0) {
      emptyState.classList.add('hidden');
      history.forEach(msg => {
        addMessage(msg.role, msg.content);
      });
    }
  }

  init();
})();
