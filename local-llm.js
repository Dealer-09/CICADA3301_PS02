// local-llm.js — Fully embedded local LLM engine for Niro
console.log('[Niro] Local LLM module loaded (v1.0.1)');
// Uses node-llama-cpp to run GGUF models directly in Node.js (no Python, no Ollama)

// Default: Llama 3.2 3B Instruct Q4_K_M from HuggingFace (~1.8 GB download)
export const DEFAULT_MODEL_URI = 'hf:bartowski/Llama-3.2-3B-Instruct-GGUF:Q4_K_M';

let llama        = null;
let loadedModel  = null;
let modelContext = null;
let progressCb   = null;

// ─── Status tracking ────────────────────────────────────────────────────────
let _status = {
  state: 'idle',       // 'idle' | 'downloading' | 'loading' | 'ready' | 'error'
  progress: 0,         // 0-100
  message: '',
  error: null,
};

function updateStatus(patch) {
  Object.assign(_status, patch);
  try { progressCb?.(_status); } catch (_) {}
}

export function getModelStatus() { return { ..._status }; }
export function isModelReady()   { return _status.state === 'ready'; }

// ─── Init & Download ─────────────────────────────────────────────────────────
/**
 * Download (if needed) and load a GGUF model.
 * @param {object} opts
 * @param {string}   opts.modelsDir  - absolute path to store model files
 * @param {string}   [opts.modelUri] - HuggingFace URI (default: Llama 3.2 3B Q4)
 * @param {Function} [opts.onProgress] - called with status objects
 */
export async function initLocalLlm({ modelsDir, modelUri, onProgress } = {}) {
  if (_status.state === 'ready')       return true;
  if (_status.state === 'downloading') return false;
  if (_status.state === 'loading')     return false;

  if (onProgress) progressCb = onProgress;

  // Ensure modelsDir is provided
  if (!modelsDir) {
    const err = new Error('modelsDir is required to initialize local LLM');
    console.error('[Niro] Local LLM init failed:', err);
    updateStatus({ state: 'error', error: err, message: err.message });
    return false;
  }

  const uri = modelUri || DEFAULT_MODEL_URI;

  try {
    updateStatus({ state: 'loading', progress: 0, message: 'Starting LLM engine...' });

    // Dynamic import so the native module is only loaded on demand
    const { getLlama, LlamaChatSession, createModelDownloader } = await import('node-llama-cpp');

    llama = await getLlama();

    // ── Download / verify model ──────────────────────────────────────────────
    updateStatus({ state: 'downloading', progress: 0, message: 'Checking for model files...' });

    const downloader = await createModelDownloader({
      modelUri: uri,
      dirPath:  modelsDir,
      onProgress: ({ downloadedSize, totalSize }) => {
        const pct   = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
        const dlMB  = (downloadedSize / 1024 / 1024).toFixed(0);
        const totMB = (totalSize / 1024 / 1024).toFixed(0);
        updateStatus({
          state: 'downloading', progress: pct,
          message: `Downloading model... ${pct}% (${dlMB} MB / ${totMB} MB)`,
        });
      }
    });

    if (downloader.totalSize != null && downloader.totalSize > 0) {
      // Model is not fully present — download it
      const totalMB = (downloader.totalSize / 1024 / 1024).toFixed(0);
      updateStatus({
        state: 'downloading', progress: 0,
        message: `Downloading model (${totalMB} MB total)...`,
      });

      await downloader.download();
    }

    const modelPath = downloader.entrypointFilePath;

    if (!modelPath) {
      throw new Error('Model downloader failed to provide a file path');
    }

    // ── Load model ───────────────────────────────────────────────────────────
    updateStatus({ state: 'loading', progress: 100, message: 'Loading model into memory...' });
    console.log('[Niro] Local LLM: Loading model from', modelPath);

    loadedModel  = await llama.loadModel({ modelPath });
    modelContext = await loadedModel.createContext();

    if (!loadedModel || !modelContext) {
      throw new Error('Failed to create model or context');
    }

    updateStatus({ state: 'ready', progress: 100, message: 'Local model ready ✓' });
    console.log('[Niro] Local LLM ready and context created.');
    return true;

  } catch (err) {
    console.error('[Niro] Local LLM init failed:', err);
    updateStatus({ state: 'error', progress: 0, message: `Error: ${err.message}`, error: err.message });
    return false;
  }
}

// ─── Inference ───────────────────────────────────────────────────────────────
/**
 * Run a chat inference with the local model and stream tokens.
 * @param {Array}    messages  - OpenAI-format message array
 * @param {Function} onToken   - called with each text chunk
 * @returns {string} full response
 */
export async function runLocalInference(messages, onToken) {
  if (!loadedModel || !modelContext) {
    throw new Error('Local model is not loaded yet.');
  }

  const { LlamaChatSession } = await import('node-llama-cpp');

  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs  = messages.filter(m => m.role === 'user' || m.role === 'assistant');

  const sequence = modelContext.getSequence();

  try {
    const session = new LlamaChatSession({
      contextSequence: sequence,
      systemPrompt: systemMsg?.content,
    });

    // Replay prior turns (all except the last user message)
    for (let i = 0; i < chatMsgs.length - 1; i += 2) {
      const user      = chatMsgs[i];
      const assistant = chatMsgs[i + 1];
      if (user && assistant) {
        await session.prompt(user.content, { temperature: 0 }); // no streaming for history replay
      }
    }

    // Prompt with the latest user message, streaming tokens
    const lastUser  = chatMsgs[chatMsgs.length - 1];
    let fullResponse = '';

    await session.prompt(lastUser?.content || '', {
      temperature: 0.7,
      onTextChunk(chunk) {
        fullResponse += chunk;
        try { onToken(chunk); } catch (_) {}
      },
    });

    return fullResponse;
  } finally {
    sequence.dispose();
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────
export async function disposeLocalLlm() {
  try {
    if (modelContext) await modelContext.dispose();
    if (loadedModel)  await loadedModel.dispose();
    if (llama)        await llama.dispose();
  } catch (_) {}
  modelContext = null;
  loadedModel  = null;
  llama        = null;
  _status = { state: 'idle', progress: 0, message: '', error: null };
}
