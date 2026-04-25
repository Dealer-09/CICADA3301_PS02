// tools/browser.js — Native JS AI Browser Agent
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { launchChrome, waitForCDP, isChromeCDPReady } from './chrome.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _initialized = false;
let _ready = false;
let _genAI = null;
let _cdpBrowser = null;

const CDP_PORT = process.env.NIRO_CDP_PORT || 9222;
const GEMINI_MODEL = process.env.NIRO_GEMINI_MODEL || 'gemini-2.5-flash';

// ─── Browser Agent Prompt ───────────────────────────────────────────────────

const BROWSER_AGENT_PROMPT = `
You are an AI Browser Agent. Your goal is to complete a task on a website.
You can "see" the page via a screenshot and a simplified DOM tree.

Available Actions:
1. click(selector): Click an element by CSS selector or text.
2. type(selector, text): Type text into an input field.
3. scroll(direction): 'up' or 'down'.
4. navigate(url): Go to a new URL.
5. wait(ms): Wait for a duration.
6. finish(answer): Task is complete. Provide a summary or answer.
7. fail(reason): Task cannot be completed.

Guidelines:
- Use specific CSS selectors if possible.
- If multiple elements match, try to be more specific.
- Always explain what you are doing in the "thought" field.
- Respond ONLY in JSON format: { "thought": "...", "action": "...", "params": { ... } }
`;

// ─── Helper: Connect to CDP ─────────────────────────────────────────────────

async function getCDPPage() {
  if (!_cdpBrowser) {
    _cdpBrowser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  }
  const contexts = _cdpBrowser.contexts();
  const context = contexts[0] || (await _cdpBrowser.newContext());
  const pages = context.pages();
  return pages[pages.length - 1] || (await context.newPage());
}

// ─── Core Agent Loop ────────────────────────────────────────────────────────

export async function runTask(task, onProgress = null) {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing');
    _genAI = new GoogleGenAI(apiKey);
  }

  const model = _genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const page = await getCDPPage();
  
  let history = [];
  let iterations = 0;
  const maxIterations = 15;

  if (onProgress) onProgress(`Starting task: ${task}`);

  while (iterations < maxIterations) {
    iterations++;

    // 1. Observe
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 50 });
    const url = page.url();
    const title = await page.title();
    
    // Get a simplified representation of interactive elements
    const elements = await page.evaluate(() => {
      const interactives = Array.from(document.querySelectorAll('button, a, input, [role="button"], select, textarea'));
      return interactives.map(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        return {
          tag: el.tagName.toLowerCase(),
          text: el.innerText?.trim().substring(0, 50),
          placeholder: el.placeholder,
          id: el.id,
          className: el.className,
          selector: el.id ? `#${el.id}` : el.tagName.toLowerCase() // Simplified
        };
      }).filter(Boolean).slice(0, 50); // Limit to top 50
    });

    const state = {
      url,
      title,
      task,
      elements,
      iteration: iterations
    };

    // 2. Think
    const promptParts = [
      { text: BROWSER_AGENT_PROMPT },
      { text: `Current State: ${JSON.stringify(state)}` },
      { inlineData: { mimeType: 'image/jpeg', data: screenshot.toString('base64') } },
      { text: `Task: ${task}` }
    ];

    const result = await model.generateContent(promptParts);
    const responseText = result.response.text();
    
    let plan;
    try {
      // Extract JSON from response (handling potential markdown formatting)
      const jsonStr = responseText.match(/\{[\s\S]*\}/)?.[0] || responseText;
      plan = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[browser.js] Failed to parse agent response:', responseText);
      throw new Error('Agent returned invalid JSON');
    }

    if (onProgress) onProgress(plan.thought);

    // 3. Act
    const { action, params } = plan;

    if (action === 'finish') return params.answer;
    if (action === 'fail') throw new Error(params.reason);

    try {
      if (action === 'click') {
        if (params.selector) {
          await page.click(params.selector, { timeout: 5000 });
        } else if (params.text) {
          await page.click(`text="${params.text}"`, { timeout: 5000 });
        }
      } else if (action === 'type') {
        await page.fill(params.selector, params.text, { timeout: 5000 });
      } else if (action === 'navigate') {
        await page.goto(params.url, { waitUntil: 'domcontentloaded' });
      } else if (action === 'scroll') {
        await page.mouse.wheel(0, params.direction === 'down' ? 500 : -500);
      } else if (action === 'wait') {
        await page.waitForTimeout(params.ms || 1000);
      }
      
      // Brief pause for stability
      await page.waitForTimeout(1000);
    } catch (err) {
      console.warn(`[browser.js] Action failed (${action}):`, err.message);
      // Let the agent know in the next iteration via the prompt if needed, 
      // but for now we just continue to let it observe the lack of change.
    }
  }

  throw new Error('Task timed out: reached maximum iterations');
}

// ─── Direct Page Tools ──────────────────────────────────────────────────────

export async function navigate(url) {
  const page = await getCDPPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return `Navigated to ${url}`;
}

export async function getCurrentPage() {
  const page = await getCDPPage();
  return {
    url: page.url(),
    title: await page.title()
  };
}

export async function getPageText() {
  const page = await getCDPPage();
  return await page.innerText('body');
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

export function isReady() {
  return _ready;
}

export async function initialize() {
  if (_initialized) return;
  _initialized = true;

  try {
    console.log('[browser.js] Checking Chrome CDP...');
    const ready = await isChromeCDPReady();

    if (!ready) {
      console.log('[browser.js] Launching Chrome...');
      launchChrome();
      await waitForCDP(15000);
    }

    _ready = true;
    console.log('[browser.js] AI Browser Agent ready (Pure JS)');
  } catch (err) {
    console.error('[browser.js] Initialization failed:', err.message);
    _ready = false;
  }
}
