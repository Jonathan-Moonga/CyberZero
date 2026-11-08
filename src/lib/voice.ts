export const WAKE_PHRASES = ['hey agent zero', 'agent zero', 'hi zero', 'hey zero'] as const

const wakePattern = /\b(?:(?:hey|hi)[\s,]+agent[\s-]+zero|agent[\s-]+zero|(?:hey|hi)[\s,]+zero)\b/i
const noiseOnly = /^(?:thank you|thanks for watching|you|bye)[.!]?$/i

/** Corrects Whisper's habitual spellings of this app's vocabulary and removes its non-speech annotations. */
export function cleanTranscript(raw: string): string {
  const text = raw
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, ' ')
    .replace(/\bagent[\s-]+0\b/gi, 'Agent Zero')
    .replace(/\bhigh[\s,]+zero\b/gi, 'Hi Zero')
    .replace(/\b(hey|hi)[\s,]+0\b/gi, '$1 Zero')
    .replace(/\b0[\s-]day\b/gi, 'zero-day')
    .replace(/\s+/g, ' ')
    .trim()
  return noiseOnly.test(text) ? '' : text
}

export function extractWakeCommand(transcript: string): { woke: boolean; command: string } {
  const match = wakePattern.exec(transcript)
  if (!match) return { woke: false, command: transcript.trim() }
  const command = `${transcript.slice(0, match.index)} ${transcript.slice(match.index + match[0].length)}`
    .replace(/^[\s,.:;!?-]+|[\s,.:;!?-]+$/g, '')
    .trim()
  return { woke: true, command }
}

export function containsSpokenOverride(transcript: string): boolean {
  const value = transcript.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const hasCode = value.includes('4256utd') || value.includes('4256 u t d') || /four\s+two\s+five\s+six/.test(value) || /\b4\s*2\s*5\s*6\b/.test(value)
  const hasPhonetics = value.includes('university') && value.includes('texas') && value.includes('dallas')
  return value.includes('access granted') && hasCode && (value.includes('u t d') || hasPhonetics)
}

export function shouldContinueConversation(response: string): boolean {
  return response.trim().endsWith('?')
}

/** Rewrites model output so the speech engine does not read formatting characters aloud. */
export function toSpeakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/[*`#>]+/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Splits streamed text into complete sentences so speech can begin before the model finishes. */
export class SentenceChunker {
  private buffer = ''

  push(delta: string): string[] {
    this.buffer += delta
    const sentences: string[] = []
    for (let match = /[.!?]+["')]*\s+|\n+/.exec(this.buffer); match; match = /[.!?]+["')]*\s+|\n+/.exec(this.buffer)) {
      const end = match.index + match[0].length
      const sentence = this.buffer.slice(0, end).trim()
      this.buffer = this.buffer.slice(end)
      if (sentence) sentences.push(sentence)
    }
    return sentences
  }

  flush(): string {
    const rest = this.buffer.trim()
    this.buffer = ''
    return rest
  }
}

export const VOICE_SAMPLE_RATE = 16000
export const VOICE_FRAME_SAMPLES = 2048
const FRAME_MS = VOICE_FRAME_SAMPLES / VOICE_SAMPLE_RATE * 1000
const MIN_LEVEL = 0.012
const PRE_ROLL_FRAMES = 3
const END_SILENCE_MS = 800
const MIN_VOICED_MS = 250
const MAX_SEGMENT_MS = 18000

const rms = (frame: Float32Array) => Math.sqrt(frame.reduce((sum, sample) => sum + sample * sample, 0) / frame.length)

function concat(frames: Float32Array[]): Float32Array {
  const joined = new Float32Array(frames.reduce((sum, frame) => sum + frame.length, 0))
  let offset = 0
  for (const frame of frames) { joined.set(frame, offset); offset += frame.length }
  return joined
}

/** Finds utterances in a microphone stream by comparing frame energy against an adaptive noise floor. */
export class SpeechSegmenter {
  private noiseFloor = 0.004
  private preRoll: Float32Array[] = []
  private speech: Float32Array[] = []
  private silentFrames = 0
  private voicedFrames = 0

  get active() { return this.speech.length > 0 }

  reset() {
    this.preRoll = []
    this.speech = []
    this.silentFrames = 0
    this.voicedFrames = 0
  }

  /** Returns a finished utterance when one ends on this frame, otherwise null. */
  push(frame: Float32Array): Float32Array | null {
    const level = rms(frame)
    const threshold = Math.max(MIN_LEVEL, this.noiseFloor * 3)
    if (!this.active) {
      if (level > threshold) {
        this.speech = [...this.preRoll, frame]
        this.preRoll = []
        this.voicedFrames = 1
        this.silentFrames = 0
        return null
      }
      this.noiseFloor = this.noiseFloor * 0.95 + level * 0.05
      this.preRoll.push(frame)
      if (this.preRoll.length > PRE_ROLL_FRAMES) this.preRoll.shift()
      return null
    }
    this.speech.push(frame)
    if (level > threshold * 0.6) { this.voicedFrames += 1; this.silentFrames = 0 } else this.silentFrames += 1
    if (this.silentFrames * FRAME_MS < END_SILENCE_MS && this.speech.length * FRAME_MS < MAX_SEGMENT_MS) return null
    const segment = this.voicedFrames * FRAME_MS >= MIN_VOICED_MS ? concat(this.speech) : null
    this.reset()
    return segment
  }
}
