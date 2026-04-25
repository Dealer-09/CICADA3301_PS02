// agent.js — Groq-powered ReAct agent loop for Perch
import Groq from 'groq-sdk';
import { executeTool } from './tools.js';

let groqClient = null;
let abortFlag = false;

const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are Perch, a powerful AI assistant for Windows. Your goal is to help users by executing tasks on their computer using real APIs and direct automation — NEVER screenshot-based coordinate clicking.

**Core Execution Rules:**

1.  **Use Real APIs, Not Screenshots**: Execute actions through proper APIs, shell commands, and direct app interaction. NEVER rely on taking a screenshot to find coordinates and then clicking on them. Instead:
    *   Open websites via \`open_website\` (uses the default browser directly)
    *   Open apps via \`open_app\` (launches by name or path)
    *   Run system tasks via \`run_command\` (PowerShell)
    *   Use \`type_text\` and \`press_key\` for keyboard-driven input

2.  **Deconstruct Tasks**: Break down every user request into a sequence of smaller, atomic tool calls. Execute the *entire* sequence to fulfill the user's intent. Never stop after one step if more are implied.
    *   "Search for cats on YouTube" -> \`open_website('https://www.youtube.com/results?search_query=cats')\`
    *   "Set a 25 min timer and open my email" -> \`set_timer(25, 'minutes')\` -> \`open_website('https://gmail.com')\`
    *   "What's the weather?" -> \`open_website('https://wttr.in')\`

3.  **Infer and Resolve**: Intelligently infer missing details.
    *   "tomorrow" -> Resolve to the actual date (e.g., "\${new Date(Date.now() + 86400000).toLocaleDateString()}").
    *   "my email" -> Assume 'gmail.com' unless specified otherwise.
    *   State your assumptions clearly: "Opening Gmail for you..."

4.  **Stream Progress**: Provide real-time feedback to the user for each step you take. Use \`show_notification\` for important updates.
    *   "Opening Chrome..."
    *   "Running PowerShell command to check IP..."
    *   "Timer set! You'll be notified when it's done."

5.  **Prefer Direct URLs Over Navigation**: When opening websites, construct the full URL with the desired action rather than navigating step-by-step.
    *   Google Calendar new event: \`open_website('https://calendar.google.com/calendar/r/eventedit')\`
    *   Google search: \`open_website('https://www.google.com/search?q=...')\`
    *   YouTube search: \`open_website('https://www.youtube.com/results?search_query=...')\`

6.  **PowerShell for System Tasks**: Use \`run_command\` for anything system-level:
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
  }
];

/**
 * Initialize or reinitialize the Groq client with an API key
 */
export function initClient(apiKey) {
  if (!apiKey) {
    console.error('[Perch] No Groq API key provided');
    return false;
  }
  groqClient = new Groq({ apiKey });
  console.log('[Perch] Groq client initialized');
  return true;
}

/**
 * Run the agent loop.
 * sendEvent(channel, data) is used to stream updates to the renderer.
 * chatHistory is an array of { role, content } messages.
 */
export async function runAgent(message, chatHistory, sendEvent) {
  if (!groqClient) {
    sendEvent('agent:error', { message: 'Groq API key not configured. Open settings to add your key.' });
    return null;
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

      const completion = await groqClient.chat.completions.create({
        model: MODEL,
        messages: messages,
        tools: TOOLS,
        tool_choice: 'auto',
        max_tokens: 4096,
        temperature: 0.7,
      });

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
    console.error('[Perch] Agent error:', err);
    const errorMsg = err.message || 'Unknown error occurred';
    sendEvent('agent:error', { message: errorMsg });
    return null;
  }
}

/**
 * Stop the currently running agent
 */
export function stopAgent() {
  abortFlag = true;
}
