# Niro AI Agent 🤖

Niro is a high-performance, desktop-native AI companion designed to live quietly on your machine and assist with your daily workflow. It combines a sleek, modern landing page with a powerful Electron-based agent that supports vision, tools, and voice commands.

## ✨ Key Features

- **Voice Commands**: Integrated high-speed Speech-to-Text using **Groq Whisper** (`whisper-large-v3`).
- **Vision & Tools**: Capable of "seeing" your screen and interacting with your system using automated tools.
- **Invisible Sensor UI**: A unique interaction model where hovering at the top of your screen triggers the AI panel.
- **Hybrid LLM Support**: Optimized to run via **Groq** for lightning-fast cloud inference or **Ollama** for local-first privacy.
- **Modern Aesthetics**: Built with a premium, dark-mode design system featuring glassmorphism and smooth micro-animations.

## 🛠️ Tech Stack

### Desktop Agent (The Core)
- **Framework**: Electron (Node.js)
- **AI Orchestration**: Groq SDK / Ollama
- **Speech-to-Text**: Groq Whisper
- **System Automation**: Playwright (for web tasks), RobotJS (for system input)
- **State Management**: `electron-store`

### Web Landing Page
- **Framework**: React + Vite
- **Styling**: Vanilla CSS (Premium Custom Design System)
- **Deployment**: Optimized for Vercel

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18 or higher
- **Windows C++ Build Tools**: Required for native modules like `robotjs` and `node-llama-cpp`.
- **API Keys**: A Groq API key is recommended for the best experience.

### Installation

1. **Clone the repo**:
   ```bash
   git clone https://github.com/Dealer-09/CICADA3301_PS02.git
   cd CICADA3301_PS02
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure API Keys**:
   Open the app and navigate to settings to input your Groq or Ollama configurations.

4. **Run Development Mode**:
   ```bash
   npm run dev
   ```

## 📦 Building for Production

To generate a standalone `.exe` installer for Windows:

1. Enable **Windows Developer Mode** or run your terminal as **Administrator**.
2. Execute the build command:
   ```bash
   npm run build
   ```
3. The installer will be located in the `dist/` folder.

## 📄 License
This project is part of the CICADA3301 series. All rights reserved.
