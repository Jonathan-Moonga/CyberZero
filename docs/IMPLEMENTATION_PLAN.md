# CyberZero implementation plan

## Current state

CyberZero is a greenfield Electron, React, TypeScript, and Vite application. The implemented MVP has the four specified sections, a secure Electron boundary, real local AES-256-GCM backups, scoped recovery grants, a guided incident simulation, an SVG office floor plan, Agent Zero, and the safe Zero-Day Operation.

## Package structure

- `electron/`: hardened main process, preload bridge, local encryption, metadata, streaming Ollama IPC, local Whisper transcription
- `src/components/`: navigation, Agent Zero, recovery access, floor plan, isolation overlay
- `src/pages/`: Dashboard, File Backup, Detection, Settings
- `src/lib/`: runtime adapter and deterministic demo content
- `data/demo-company/`: fictional source data organized by department
- `spacetimedb/`: table and reducer contract for deployment to a configured instance
- `docs/`: implementation and presentation guidance

## Runtime and security

- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- strict renderer CSP and a narrow, immutable preload API
- local backup content encrypted independently per department using AES-256-GCM
- local random vault key protects department data keys at rest
- one-time recovery phrase derives a wrapping key through Node `scrypt`
- only the wrapped department key, salt, IV, tag, and metadata are persisted
- all IPC identifiers and input fields are constrained before filesystem use
- no network-interface or router commands exist in the codebase

## Service modes

| Service | Configured behavior | Offline behavior |
| --- | --- | --- |
| Ollama | Local-only streaming tool agent with live platform context | Labeled deterministic Demo Script Mode |
| Whisper | Local speech-to-text, model downloaded once | Typed input; browser preview has no voice input |
| Google Gemini | Analyzes simulated incident evidence and reports evidence gaps; called only from the Electron main process | Shown as not connected; the rest of the app is unaffected |
| Photon | Notification adapter target | Truthfully shown as queued/not configured |
| SpacetimeDB | Contract is ready for deployment | Local durable metadata mirror |

Environment variable names are documented in `.env.example`. Secrets must remain in the Electron main process and must never enter the renderer bundle.

## Definition of done

- navigation exposes exactly four primary pages and retains collapse state
- encrypted backups are immutable and verifiable
- recovery phrase is shown once and can decrypt only the granted department
- incorrect phrase fails without disclosing data
- breach simulation uses only the supplied fictional evidence
- floor plan shows Room 2B in red during the breach and changes after isolation
- only `4256UTD` runs the cinematic simulated isolation
- transfer reaches zero and recovery mode is visible
- live Ollama and deterministic responses are labeled honestly
- opt-in wake listening recognizes “Hey Agent Zero,” “Agent Zero,” and “Hi Zero,” transcribes on-device, pauses during TTS, and preserves the exact guided dialogue
- the model has no tool that reaches the breach simulation, Zero-Day Operation, recovery access, or override codes; unambiguous backup and navigation commands run deterministically so the model cannot claim an action that did not happen
- lint, typecheck, tests, production build, and packaged Electron launch pass

## Remaining production integration work

The external SpacetimeDB module must be deployed and its generated client bound to the local metadata adapter. A Photon endpoint and secret must be supplied to deliver notifications rather than queue them. These are intentionally not faked in the MVP.
