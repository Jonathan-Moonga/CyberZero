# CyberZero

The command center for Day Zero — a polished Windows desktop MVP for encrypted continuity, controlled recovery, and a clearly labeled cyberattack simulation.

## Run

Requires Node.js 22. This repository pins pnpm through Corepack.

```powershell
corepack pnpm install
corepack pnpm dev
```

For a browser-only visual preview:

```powershell
corepack pnpm dev:web
```

The secure backup/recovery implementation runs in Electron. Browser preview uses a visibly limited local demo adapter.

## Validate and package

```powershell
corepack pnpm check
corepack pnpm dist:win
```

Live services are optional. Copy `.env.example` to `.env` only when configuring local Ollama or external integrations. Set `GEMINI_API_KEY` to enable the Gemini evidence analysis on the Detection page; it sends only simulated incident facts and backup status to Google. The application reports unavailable services truthfully and never sends recovery phrases through notifications.

## Agent Zero

With [Ollama](https://ollama.com) running, Agent Zero answers from a local model that can use tools (`ollama pull qwen3:4b`; choose the model in Settings). It streams replies, remembers the conversation, reads the live incident and backup state, and can list, create, and verify backups or open pages. Without Ollama it falls back to the labeled Demo Script.

The breach simulation, Zero-Day Operation, recovery access, and override codes stay on fixed, deterministic paths. The model has no tool that can reach them.

Voice input runs in the desktop app using a local Whisper model. It is downloaded once from Hugging Face on first use (about 80 MB) and then works offline; audio never leaves the device. Use the microphone button to talk directly, or enable wake listening and say "Hey Agent Zero". Replies are spoken with an installed Windows voice.

See [the implementation plan](docs/IMPLEMENTATION_PLAN.md) and [the presentation script](docs/DEMO_SCRIPT.md).
