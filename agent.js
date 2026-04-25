import Groq from 'groq-sdk';
import { executeTool } from './tools.js';
import { runLocalInference, getModelStatus } from './local-llm.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

// The Groq SDK is just an OpenAI-compatible client.
// We can point it at any OpenAI-compatible endpoint (Ollama, LiteLLM, etc.)
let llmClient = null;
let currentProvider = 'groq';
let currentModel = 'llama-3.3-70b-versatile';
let abortFlag = false;

const GROQ_CLOUD_MODEL  = 'llama-3.3-70b-versatile';
const GROQ_CLOUD_BASE   = 'https://api.groq.com';
const OLLAMA_BASE       = 'http://localhost:11434/v1';
const OLLAMA_DEF_MODEL  = 'llama3';

const SYSTEM_PROMPT = `You are Niro, a powerful AI assistant for Windows. Your goal is to help users by executing tasks on their computer using real APIs and direct automation — NEVER screenshot-based coordinate clicking.

**Core Execution Rules:**

1.  **Use Real APIs, Not Screenshots**: Execute actions through proper APIs, shell commands, and direct app interaction. NEVER rely on taking a screenshot to find coordinates and then clicking on them. Instead:
    *   Open and control websites via Playwright browser tools (\`browser_open\`, \`browser_click\`, \`browser_type\`, \`browser_read\`)
    *   Open apps via \`open_app\` (launches by name or path)
    *   Manage windows via \`focus_window\`, \`list_windows\`, \`close_app\`
    *   Run system tasks via \`run_command\` (PowerShell)
    *   Use \`type_text\` and \`press_key\` for keyboard-driven input in desktop apps

2.  **Deconstruct Tasks**: Break down every user request into a sequence of smaller, atomic tool calls. Execute the *entire* sequence to fulfill the user's intent.
    *   "Search for cats on YouTube" -> \`browser_open('https://www.youtube.com')\` -> \`browser_type({ placeholder: 'Search', text: 'cats' })\` -> \`browser_click({ text: 'Search' })\`
    *   "Set a 25 min timer and open my email" -> \`set_timer(25, 'Focus timer')\` -> \`browser_open('https://gmail.com')\`
    *   "Open VS Code" -> \`open_app('vscode')\`
    *   "Close Notepad" -> \`close_app('notepad')\`

3.  **Browser Automation with Playwright**: When interacting with websites, prefer the \`browser_*\` tools over \`open_website\`. These give you programmatic control:
    *   \`browser_open\` — Navigate to a URL in a real Chromium browser
    *   \`browser_click\` — Click elements by CSS selector or visible text (no coordinate guessing)
    *   \`browser_type\` — Fill input fields by CSS selector or placeholder text
    *   \`browser_read\` — Read the page's visible text content
    *   \`browser_close\` — Close the browser when done
    *   Use \`open_website\` only for simple "open this link in the user's default browser" requests.

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

// Tool definitions in OpenAI function calling format (used by Groq)
const TOOLS = [
  {
    type: "function",
    function: {
      name: "open_app",
      description: "Open a Windows application by name or full path. Examples: Chrome, Notepad, Calculator, Spotify.",
      parameters: {
        type: "object",
        properties: {
          app: { type: "string", description: "App name or full .exe path" }
        },
        required: ["app"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "open_website",
      description: "Open a URL in the default browser.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL including https://" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "type_text",
      description: "Type text at the current cursor position using the keyboard.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to type" }
        },
        required: ["text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "press_key",
      description: "Press a keyboard key or shortcut. Examples: enter, ctrl+c, alt+tab, win+d.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Key or combo to press" }
        },
        required: ["key"]
      }
    }
  },
  {
    type: "function",
    function: {
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
    }
  },
  {
    type: "function",
    function: {
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
    }
  },
  {
    type: "function",
    function: {
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
    }
  },
  {
    type: "function",
    function: {
      name: "take_screenshot",
      description: "Take a screenshot of the current screen. Use this to see what is on screen before clicking.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
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
    }
  },
  {
    type: "function",
    function: {
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
    }
  },
  // ── Playwright browser automation tools ──
  {
    type: "function",
    function: {
      name: "browser_open",
      description: "Open a URL in a Playwright-controlled Chromium browser. Use this for web automation tasks where you need to interact with pages (click, type, read). A persistent browser session stays open across calls.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to navigate to (https:// prefix added automatically if missing)" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_click",
      description: "Click an element on the current browser page by CSS selector or visible text. No coordinate guessing needed.",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector of the element to click (e.g. 'button.submit', '#login-btn')" },
          text: { type: "string", description: "Visible text of the element to click (e.g. 'Sign in', 'Submit'). Uses partial matching." }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_type",
      description: "Type text into an input field on the current browser page. Target by CSS selector or placeholder text.",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector of the input field (e.g. 'input[name=email]', '#search')" },
          placeholder: { type: "string", description: "Placeholder text of the input field (e.g. 'Search', 'Enter your email')" },
          text: { type: "string", description: "Text to type into the field" }
        },
        required: ["text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_read",
      description: "Read the visible text content of the current browser page. Optionally target a specific element by CSS selector.",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector to read text from (e.g. '#results', '.article'). Omit to read entire page." }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_close",
      description: "Close the Playwright browser session.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  // ── Windows automation tools ──
  {
    type: "function",
    function: {
      name: "list_windows",
      description: "List all currently visible windows with their titles, process names, and PIDs.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "focus_window",
      description: "Bring a specific window to the foreground by matching its title. Uses partial matching.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Partial window title to match (e.g. 'Visual Studio Code', 'Notepad')" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "close_app",
      description: "Close a running application by process name. Uses partial matching.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Process name to close (e.g. 'notepad', 'chrome', 'Code')" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search for files on disk by filename pattern. Searches user profile by default, max depth 4.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Filename pattern to search for (e.g. 'report.pdf', '.docx')" },
          directory: { type: "string", description: "Directory to search in. Defaults to user profile. Use PowerShell paths like '$env:USERPROFILE\\Desktop'" }
        },
        required: ["query"]
      }
    }
  }
];

export function initClient({ provider = 'groq', apiKey, baseUrl, model } = {}) {
  try {
    currentProvider = provider;
    if (provider === 'local-embedded') {
      console.log('[Niro] Agent set to local-embedded mode');
      llmClient = { embedded: true }; // Marker
      return true;
    }
    if (provider === 'local') {
      const base = (baseUrl || OLLAMA_BASE).replace(/\/$/, '');
      currentModel = model || OLLAMA_DEF_MODEL;
      // The Groq SDK works perfectly as an OpenAI-compat client — just swap baseURL
      llmClient = new Groq({
        apiKey: 'local',          // required field but not checked by local servers
        baseURL: base + (base.endsWith('/v1') ? '' : '/v1'),
      });
      console.log(`[Niro] Local LLM client initialized → ${base} (model: ${currentModel})`);
    } else {
      // Groq cloud
      if (!apiKey) {
        console.warn('[Niro] No Groq API key provided');
        return false;
      }
      currentModel = model || GROQ_CLOUD_MODEL;
      llmClient = new Groq({ apiKey, baseURL: GROQ_CLOUD_BASE });
      console.log(`[Niro] Groq cloud client initialized (model: ${currentModel})`);
    }
    return true;
  } catch (e) {
    console.error('[Niro] Failed to initialize LLM client:', e.message);
    return false;
  }
}

/**
 * Stop the currently running agent
 */
export function stopAgent() {
  abortFlag = true;
}

/**
 * Run the agent loop.
 * sendEvent(channel, data) is used to stream updates to the renderer.
 * chatHistory is an array of { role, content } messages.
 */
export async function runAgent(message, chatHistory, sendEvent) {
  if (!llmClient) {
    sendEvent('agent:error', { message: 'No LLM configured. Open Settings to add a Groq API key or set up a local model.' });
    return null;
  }

  // Handle local embedded inference
  if (currentProvider === 'local-embedded') {
    const status = getModelStatus();
    
    // Safety check: even if state is 'ready', ensure internals are truly initialized
    if (status.state !== 'ready') {
      let msg = 'Local model is not ready yet.';
      if (status.state === 'downloading') msg = `Local model is still downloading (${status.progress}%). Please wait.`;
      if (status.state === 'loading')     msg = 'Local model is currently loading into memory. Please wait a moment.';
      if (status.state === 'error')       msg = `Local LLM Error: ${status.message}`;
      if (status.state === 'idle')        msg = 'Local model is idle. Please check your settings and try saving again.';
      
      sendEvent('agent:error', { message: msg });
      return null;
    }

    try {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT + '\n\nNOTE: You are running in local-only mode. Tool use is disabled for stability.' },
        ...chatHistory.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];
      const response = await runLocalInference(messages, (token) => {
        sendEvent('agent:chunk', { text: token });
      });
      sendEvent('agent:done', { text: response });
      return response;
    } catch (err) {
      // If it's the "not loaded" error, give a more user-friendly instruction
      const errorMsg = err.message.includes('not loaded') 
        ? 'Local model failed to load. Try restarting Niro or re-saving your settings.'
        : err.message;
        
      sendEvent('agent:error', { message: `Local LLM Error: ${errorMsg}` });
      return null;
    }
  }

  abortFlag = false;

  // Build messages array
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...chatHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message }
  ];

  // Limit context to last ~20 messages to avoid token limits
  if (messages.length > 22) {
    const system = messages[0];
    const recent = messages.slice(-20);
    messages.length = 0;
    messages.push(system, ...recent);
  }

  let maxIterations = 10; // Safety limit for tool loops
  let fullResponse = '';

  try {
    while (maxIterations > 0 && !abortFlag) {
      maxIterations--;

      let completion;
      try {
        completion = await llmClient.chat.completions.create({
          model: currentModel,
          messages: messages,
          tools: TOOLS,
          tool_choice: 'auto',
          max_tokens: 4096,
          temperature: 0.7,
        });
      } catch (error) {
        console.error('[Niro] LLM API failed:', error.message);
        throw error;
      }

      const choice = completion.choices[0];
      const responseMessage = choice.message;

      // Add assistant message to conversation
      messages.push(responseMessage);

      // Check for tool calls
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const toolCall of responseMessage.tool_calls) {
          if (abortFlag) break;

          const toolName = toolCall.function.name;
          let toolArgs = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            toolArgs = {};
          }

          // Send tool execution event to renderer
          sendEvent('agent:tool', { name: toolName, input: toolArgs });

          // Execute the tool
          const result = await executeTool(toolName, toolArgs);

          // Build tool result content
          let toolContent = result.result;
          if (result.isImage) {
            // For screenshots, send a truncated notice to the model
            // (Groq doesn't support image inputs in tool results)
            toolContent = 'Screenshot captured successfully. The image has been taken but cannot be displayed in this context. Describe what action you want to take next, or ask the user to look at their screen.';
          }

          // Add tool result to messages
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolContent
          });
        }

        // Continue the loop — Claude will process tool results
        continue;
      }

      // No tool calls — this is a text response
      if (responseMessage.content) {
        fullResponse = responseMessage.content;
        sendEvent('agent:chunk', { role: 'assistant', text: fullResponse });
      }

      // Done
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

