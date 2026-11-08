import { toSpeakable } from './voice'

export interface SpeakerEvents {
  voiceName: () => string
  muted: () => boolean
  onStart: () => void
  /** Fires once speech has drained and no more text is expected for the current reply. */
  onIdle: () => void
}

/** Queues reply sentences for speech synthesis and reports when the whole reply has been spoken. */
export class Speaker {
  // Chromium drops the end event for utterances that have been garbage collected, so each one is held until it finishes.
  private utterances = new Set<SpeechSynthesisUtterance>()
  private open = false
  private events: SpeakerEvents = { voiceName: () => '', muted: () => true, onStart: () => undefined, onIdle: () => undefined }

  /** Supplies the current callbacks; called after every render so they never go stale. */
  bind(events: SpeakerEvents) { this.events = events }

  begin() { this.open = true }

  say(text: string) {
    const spoken = toSpeakable(text)
    if (!spoken || this.events.muted() || !('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(spoken)
    const voices = speechSynthesis.getVoices()
    utterance.voice = voices.find(v => v.name === this.events.voiceName()) ?? voices.find(v => /zira|aria|female|samantha/i.test(v.name)) ?? null
    utterance.rate = .96
    utterance.onstart = () => this.events.onStart()
    const finished = () => { if (this.utterances.delete(utterance)) this.settle() }
    utterance.onend = finished
    utterance.onerror = finished
    this.utterances.add(utterance)
    speechSynthesis.speak(utterance)
  }

  finish() {
    this.open = false
    this.settle()
  }

  stop({ notify = true } = {}) {
    const wasBusy = this.open || this.utterances.size > 0
    this.open = false
    this.utterances.clear()
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    if (notify && wasBusy) this.events.onIdle()
  }

  private settle() {
    if (!this.open && this.utterances.size === 0) this.events.onIdle()
  }
}
