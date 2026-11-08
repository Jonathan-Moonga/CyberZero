import { describe, expect, it } from 'vitest'
import { cleanTranscript, containsSpokenOverride, extractWakeCommand, SentenceChunker, shouldContinueConversation, SpeechSegmenter, toSpeakable, VOICE_FRAME_SAMPLES } from './voice'
import { scriptResponse } from './demo'

// Verbatim output from whisper-base.en for this application's demo phrases.
describe('real Whisper transcripts', () => {
  it.each([
    ['Agent 0, what is the status of my backups?', 'what is the status of my backups'],
    ['Agent 0, initiate 0-day operation.', 'initiate zero-day operation'],
    ['Hey Agent Zero, simulate breach.', 'simulate breach'],
    ['High zero.', ''],
    ['Hey, Agent Zero, run a system check', 'run a system check'],
  ])('wakes on %s', (raw, command) => {
    expect(extractWakeCommand(cleanTranscript(raw))).toEqual({ woke: true, command })
  })

  it('routes a transcribed Zero-Day command to CEO authorization', () => {
    expect(scriptResponse(cleanTranscript('initiate 0-day operation.')).action).toBe('authorize')
  })

  it('accepts the override when Whisper writes digits', () => {
    const heard = 'Access granted. Complete zero-day operation using override code 4, 2, 5, 6, U. as in university, T. as in Texas, D. as in Dallas.'
    expect(containsSpokenOverride(cleanTranscript(heard))).toBe(true)
  })

  it('still rejects a wrong spoken code in digits', () => {
    expect(containsSpokenOverride('Access granted. Override code 4, 2, 5, 7, U as in university, T as in Texas, D as in Dallas.')).toBe(false)
  })

  it('treats a punctuated yes as the guided answer', () => {
    expect(scriptResponse('Yes.').content).toContain('historical scan')
  })

  it('ignores background conversation', () => {
    expect(extractWakeCommand(cleanTranscript('I think we should get lunch after the meeting.')).woke).toBe(false)
  })

  it.each(['[BLANK_AUDIO]', '(wind blowing)', 'Thank you.', ' you '])('drops the non-speech output %s', raw => {
    expect(cleanTranscript(raw)).toBe('')
  })
})

describe('SentenceChunker', () => {
  it('emits sentences as soon as they complete across deltas', () => {
    const chunker = new SentenceChunker()
    expect(chunker.push('The vault is ')).toEqual([])
    expect(chunker.push('secure. Two backups')).toEqual(['The vault is secure.'])
    expect(chunker.push(' exist')).toEqual([])
    expect(chunker.flush()).toBe('Two backups exist')
  })

  it('does not split inside an address', () => {
    expect(new SentenceChunker().push('Source 203.0.113.42 reached CZ-OPS-204. Next')).toEqual(['Source 203.0.113.42 reached CZ-OPS-204.'])
  })
})

describe('toSpeakable', () => {
  it('removes formatting that would be read aloud', () => {
    expect(toSpeakable('**Status:** `BREACH_DETECTED`\n- [Vault](http://x) is safe')).toBe('Status: BREACH DETECTED Vault is safe')
  })
})

describe('SpeechSegmenter', () => {
  const frame = (level: number) => new Float32Array(VOICE_FRAME_SAMPLES).fill(level)
  const feed = (segmenter: SpeechSegmenter, level: number, count: number) => {
    let result: Float32Array | null = null
    for (let i = 0; i < count; i += 1) result = segmenter.push(frame(level)) ?? result
    return result
  }

  it('captures an utterance with pre-roll once silence follows', () => {
    const segmenter = new SpeechSegmenter()
    feed(segmenter, 0.001, 10)
    expect(feed(segmenter, 0.1, 10)).toBeNull()
    expect(segmenter.active).toBe(true)
    const segment = feed(segmenter, 0.001, 7)
    expect(segment).not.toBeNull()
    expect(segment!.length).toBe(VOICE_FRAME_SAMPLES * (3 + 10 + 7))
    expect(segmenter.active).toBe(false)
  })

  it('discards a click too short to be speech', () => {
    const segmenter = new SpeechSegmenter()
    feed(segmenter, 0.001, 10)
    feed(segmenter, 0.1, 1)
    expect(feed(segmenter, 0.001, 8)).toBeNull()
  })

  it('stays silent on steady room noise', () => {
    expect(feed(new SpeechSegmenter(), 0.008, 200)).toBeNull()
  })

  it('cuts off an utterance that never pauses', () => {
    expect(feed(new SpeechSegmenter(), 0.1, 150)).not.toBeNull()
  })
})

describe('wake phrase recognition', () => {
  it.each([
    ['Hey Agent Zero, simulate breach', 'simulate breach'],
    ['Agent Zero show me the attack', 'show me the attack'],
    ['Hi Zero', ''],
  ])('extracts a command from %s', (transcript, command) => {
    expect(extractWakeCommand(transcript)).toEqual({ woke: true, command })
  })

  it('ignores ordinary background speech', () => {
    expect(extractWakeCommand('show me the dashboard').woke).toBe(false)
  })

  it('recognizes the exact spoken CEO override', () => {
    expect(containsSpokenOverride('Access granted. Complete Zero-Day Operation using override code four, two, five, six, U as in University, T as in Texas, D as in Dallas.')).toBe(true)
  })

  it('does not accept a partial spoken override', () => {
    expect(containsSpokenOverride('Access granted, four two five six')).toBe(false)
  })

  it('arms the next conversational response after a question', () => {
    expect(shouldContinueConversation('Would you like me to proceed?')).toBe(true)
  })
})
