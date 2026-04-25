import { GoogleGenAI } from '@google/genai';
import { executeTool } from './tools.js';
import { runLocalInference, getModelStatus } from './local-llm.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

// The Groq SDK is just an OpenAI-compatible client.
// We can point it at any OpenAI-compatible endpoint (Ollama, LiteLLM, etc.)
let llmClient = null;
let currentProvider = 'gemini';
let currentModel = 'gemini-2.5-flash';
let abortFlag = false;

const GEMINI_CLOUD_MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `You are Niro, a powerful AI assistant for Windows. Your goal is to help users by executing tasks on their computer using real APIs and direct automation — NEVER screenshot-based coordinate clicking.

**Core Execution Rules:**

1.  **Use Real APIs, Not Screenshots**: Execute actions through proper APIs, shell commands, and direct app interaction. NEVER rely on taking a screenshot to find coordinates and then clicking on them. Instead:
    *   Use \`run_task\` for any web browsing task — it connects to your real Chrome with all your logins and cookies intact
    *   Open apps via \`open_app\` (launches by name or path)
    *   Manage windows via \`focus_window\`, \`list_windows\`, \`close_app\`
    *   Run system tasks via \`run_command\` (PowerShell)
    *   Use \`type_text\` and \`press_key\` for keyboard-driven input in desktop apps

2.  **Deconstruct Tasks**: Break down every user request into a sequence of smaller, atomic tool calls. Execute the *entire* sequence to fulfill the user's intent.
    *   "Search for cats on YouTube" -> \`run_task('Go to YouTube and search for cats')\`
    *   "Set a 25 min timer and open my email" -> \`set_timer(25, 'Focus timer')\` -> \`run_task('Open Gmail')\`
    *   "Open VS Code" -> \`open_app('vscode')\`
    *   "Close Notepad" -> \`close_app('notepad')\`

3.  **AI Browser Automation with Browser Use**: When interacting with websites, use \`run_task\` — it uses an AI agent that connects to your real Chrome browser:
    *   \`run_task\` — Send a natural language instruction: "Go to Amazon and search for wireless headphones under $50"
    *   The browser agent sees your actual logged-in Chrome, so it can use Gmail, Google Docs, YouTube, etc.
    *   For simple URL opening, use \`open_website\` (opens in default browser without AI automation)
    *   Legacy Playwright tools (\`browser_open\`, \`browser_click\`, etc.) still work for headless tasks

4.  **Windows App Management**:
    *   \`open_app\` — Open apps by name: 'chrome', 'notepad', 'vscode', 'calculator', 'spotify', etc.
    *   \`list_windows\` — See all open windows with titles and process names
    *   \`focus_window\` — Bring a specific window to the foreground by title
    *   \`close_app\` — Close a running application by name
    *   \`search_files\` — Find files on disk by name

5.  **Infer and Resolve**: Intelligently infer missing details.
    *   "tomorrow" -> Resolve to the actual date.
    *   "my email" -> Assume 'gmail.com' unless specified otherwise.
    *   "open code" -> \`open_app('vscode')\`

6.  **Stream Progress**: Provide real-time feedback for each step.
    *   "Opening VS Code..."
    *   "Navigating to YouTube..."
    *   "Searching for your file..."

7.  **PowerShell for System Tasks**: Use \`run_command\` for anything system-level:
    *   Get IP: \`run_command('(Invoke-WebRequest -Uri "https://api.ipify.org").Content')\`
    *   System info: \`run_command('Get-ComputerInfo | Select-Object CsName, OsName')\`
    *   File operations: \`run_command('Get-ChildItem ~/Desktop')\`

You are running on Windows. Use Windows-specific commands and paths. PowerShell is available via \`run_command\`.
Your personality is helpful, concise, and capable. You get things done.`;

// ─── Tool definitions (Gemini function calling format) ────────────────────────
const TOOLS_DECLARATIONS = [
  {
    name: "open_app",
    description: "Open a Windows application by name or full path. Examples: Chrome, Notepad, Calculator, Spotify.",
    parameters: {
      type: "object",
      properties: {
        app: { type: "string", description: "App name or full .exe path" }
      },
      required: ["app"]
    }
  },
  {
    name: "open_website",
    description: "Open a URL in the default browser.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL including https://" }
      },
      required: ["url"]
    }
  },
  {
    name: "type_text",
    description: "Type text at the current cursor position using the keyboard.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to type" }
      },
      required: ["text"]
    }
  },
  {
    name: "press_key",
    description: "Press a keyboard key or shortcut. Examples: enter, ctrl+c, alt+tab, win+d.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key or combo to press" }
      },
      required: ["key"]
    }
  },
  {
    name: "mouse_click",
    description: "Click at specific screen coordinates (x, y). Get coordinates from take_screenshot first.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate in pixels" },
        y: { type: "number", description: "Y coordinate in pixels" }
      },
      required: ["x", "y"]
    }
  },
  {
    name: "run_command",
    description: "Run a PowerShell command or shell command. Use for file operations, settings, or anything not covered by other tools.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "PowerShell command to run" },
        silent: { type: "boolean", description: "If true, don't show output to user" }
      },
      required: ["command"]
    }
  },
  {
    name: "set_timer",
    description: "Set a countdown timer. Shows a Windows notification when time is up.",
    parameters: {
      type: "object",
      properties: {
        minutes: { type: "number", description: "Duration in minutes" },
        label: { type: "string", description: "Timer label shown in notification" }
      },
      required: ["minutes", "label"]
    }
  },
  {
    name: "take_screenshot",
    description: "Take a screenshot of the current screen. Use this to see what is on screen before clicking.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "show_notification",
    description: "Show a Windows desktop notification to the user.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Notification title" },
        message: { type: "string", description: "Notification body text" }
      },
      required: ["title", "message"]
    }
  },
  {
    name: "save_task",
    description: "Save a new preset task to the quick-access panel so the user can run it again with one click.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short task name shown on button" },
        instruction: { type: "string", description: "The full instruction to run when clicked" }
      },
      required: ["name", "instruction"]
    }
  },
  // ── AI-powered Browser Use tool ──
  {
    name: "run_task",
    description: "Run a natural-language browser automation task using AI (Gemini Vision). Connects to your real Chrome browser with all cookies and logins intact. Use for any web task: searching, filling forms, reading content, navigating sites. Example: 'Go to Gmail and find the latest email from John'.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Natural language instruction for the browser agent. Be specific and descriptive." }
      },
      required: ["task"]
    }
  },
  // ── Legacy Playwright browser automation tools (headless fallback) ──
  {
    name: "browser_open",
    description: "Open a URL in a Playwright-controlled headless Chromium browser. Use run_task for most web tasks; use this only when you need headless automation without user's Chrome session.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to navigate to (https:// prefix added automatically if missing)" }
      },
      required: ["url"]
    }
  },
  {
    name: "browser_click",
    description: "Click an element on the current Playwright browser page by CSS selector or visible text.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the element to click" },
        text: { type: "string", description: "Visible text of the element to click. Uses partial matching." }
      },
      required: []
    }
  },
  {
    name: "browser_type",
    description: "Type text into an input field on the current Playwright browser page.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the input field" },
        placeholder: { type: "string", description: "Placeholder text of the input field" },
        text: { type: "string", description: "Text to type into the field" }
      },
      required: ["text"]
    }
  },
  {
    name: "browser_read",
    description: "Read the visible text content of the current Playwright browser page.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector to read text from. Omit to read entire page." }
      },
      required: []
    }
  },
  {
    name: "browser_close",
    description: "Close the Playwright browser session.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  // ── Windows automation tools ──
  {
    name: "list_windows",
    description: "List all currently visible windows with their titles, process names, and PIDs.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "focus_window",
    description: "Bring a specific window to the foreground by matching its title. Uses partial matching.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Partial window title to match (e.g. 'Visual Studio Code', 'Notepad')" }
      },
      required: ["title"]
    }
  },
  {
    name: "close_app",
    description: "Close a running application by process name. Uses partial matching.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Process name to close (e.g. 'notepad', 'chrome', 'Code')" }
      },
      required: ["name"]
    }
  },
  {
    name: "search_files",
    description: "Search for files on disk by filename pattern. Searches user profile by default, max depth 4.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Filename pattern to search for (e.g. 'report.pdf', '.docx')" },
        directory: { type: "string", description: "Directory to search in. Defaults to user profile." }
      },
      required: ["query"]
    }
  }
];

// Gemini tool config object
const GEMINI_TOOLS = [{ functionDeclarations: TOOLS_DECLARATIONS }];

// ─── Client initialization ────────────────────────────────────────────────────
export function initClient({ provider = 'gemini', apiKey, model } = {}) {
  try {
    currentProvider = provider;

    // Gemini cloud
    if (!apiKey) {
      console.warn('[Niro] No Gemini API key provided');
      return false;
    }
    currentModel = model || GEMINI_CLOUD_MODEL;
    llmClient = new GoogleGenAI({ apiKey });
    console.log(`[Niro] Gemini cloud client initialized (model: ${currentModel})`);
    return true;

  } catch (e) {
    console.error('[Niro] Failed to initialize LLM client:', e.message);
    return false;
  }
}

/**
 * Stop the currently running agent.
 */
export function stopAgent() {
  abortFlag = true;
}

// ─── Gemini message format helpers ───────────────────────────────────────────

/**
 * Convert our flat chat history [{role, content}] to Gemini's contents format.
 * Gemini uses { role: 'user'|'model', parts: [{text}] }
 * Tool calls/results are represented as functionCall/functionResponse parts.
 */
function historyToGeminiContents(chatHistory) {
  return chatHistory
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
}

// ─── Local Ollama fallback (OpenAI-compat via fetch) ─────────────────────────
async function callLocalLLM(messages) {
  const { baseUrl, model } = llmClient;
  const body = JSON.stringify({
    model,
    messages,
    tools: TOOLS_DECLARATIONS.map(t => ({ type: 'function', function: t })),
    tool_choice: 'auto',
    max_tokens: 4096,
    temperature: 0.7,
  });

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local' },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Local LLM API error (${resp.status}): ${errText}`);
  }

  return resp.json();
}

// ─── Main agent loop ──────────────────────────────────────────────────────────
export async function runAgent(message, chatHistory, sendEvent) {
  if (!llmClient) {
    sendEvent('agent:error', { message: 'No Gemini API key configured. Open Settings to add your key.' });
    return null;
  }

  // Gemini cloud
  abortFlag = false;

  // Build Gemini conversation history (excludes current message — sent separately)
  const history = historyToGeminiContents(chatHistory);

  // The Gemini SDK uses a chat session with rolling history
  const chat = llmClient.chats.create({
    model: currentModel,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: GEMINI_TOOLS,
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
    history,
  });

  let maxIterations = 10;
  let fullResponse = '';

  try {
    // The current user message — start the loop (format as proper Gemini content)
    let nextMessage = { role: 'user', parts: [{ text: message }] };
    // Track tool results to feed back
    let toolResultParts = null;

    while (maxIterations > 0 && !abortFlag) {
      maxIterations--;

      let response;
      try {
        if (toolResultParts && toolResultParts.length > 0) {
          // Feed tool results back as a user turn with functionResponse parts
          response = await chat.sendMessage({ message: toolResultParts });
          toolResultParts = null;
        } else if (nextMessage) {
          response = await chat.sendMessage({ message: nextMessage });
          nextMessage = null;
        } else {
          // No message to send; break to avoid ContentUnion error
          break;
        }
      } catch (error) {
        console.error('[Niro] Gemini API failed:', error.message);
        throw error;
      }

      const candidate = response.candidates?.[0];
      if (!candidate) break;

      const parts = candidate.content?.parts || [];
      const hasFunctionCalls = parts.some(p => p.functionCall);

      if (hasFunctionCalls) {
        // Process each function call
        const responseParts = [];

        for (const part of parts) {
          if (!part.functionCall) continue;
          if (abortFlag) break;

          const toolName = part.functionCall.name;
          const toolArgs = part.functionCall.args || {};

          sendEvent('agent:tool', { name: toolName, input: toolArgs });

          let toolResult;
          try {
            const result = await executeTool(toolName, toolArgs);
            let content = result.result;
            if (result.isImage) {
              content = 'Screenshot captured. The image has been taken but cannot be displayed in this context. Describe what action you want to take next.';
            }
            toolResult = { output: content };
          } catch (err) {
            toolResult = { error: err.message };
          }

          responseParts.push({
            functionResponse: {
              name: toolName,
              response: toolResult,
            }
          });
        }

        toolResultParts = responseParts;
        continue; // Loop back to feed tool results
      }

      // Text response
      const textPart = parts.find(p => p.text);
      if (textPart?.text) {
        fullResponse = textPart.text;
        sendEvent('agent:chunk', { role: 'assistant', text: fullResponse });
      }

      break;
    }

    if (abortFlag) {
      sendEvent('agent:error', { message: 'Agent stopped by user.' });
      return null;
    }

    sendEvent('agent:done', {});
    return fullResponse;

  } catch (err) {
    console.error('[Niro] Agent error:', err);
    const errorMsg = err.message || 'Unknown error occurred';
    sendEvent('agent:error', { message: errorMsg });
    return null;
  }
}

/**
 * Transcribe an audio buffer using Groq's Whisper API
 */
export async function transcribeAudioBuffer(buffer, apiKey) {
  if (!apiKey) throw new Error('Groq API key is required for voice commands.');
  
  const tempClient = new Groq({ apiKey, baseURL: GROQ_CLOUD_BASE });
  const tempFilePath = path.join(os.tmpdir(), `niro_audio_${Date.now()}.webm`);
  
  // Convert ArrayBuffer/Buffer to a Node Buffer and save
  fs.writeFileSync(tempFilePath, Buffer.from(buffer));
  
  try {
    const transcription = await tempClient.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-large-v3",
      response_format: "text"
    });
    return transcription;
  } catch (error) {
    console.error('[Niro] Transcription error:', error.message);
    throw error;
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (e) {
      console.error('[Niro] Failed to cleanup temp audio file:', e.message);
    }
  }
}

