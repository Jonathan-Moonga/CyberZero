import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { openMic } from './mic'
import { cleanTranscript, SpeechSegmenter } from './voice'

export type VoicePhase = 'off' | 'loading' | 'ready' | 'hearing' | 'transcribing' | 'blocked' | 'error'

const RESUME_DELAY_MS = 250

/** Runs microphone capture and local transcription while enabled, delivering each spoken utterance as text. */
export function useVoiceInput(enabled: boolean, handlers: { onTranscript: (text: string) => void; onFailure: (phase: 'blocked' | 'error', detail: string) => void }) {
  const [phase, setPhase] = useState<VoicePhase>('off')
  const [detail, setDetail] = useState('')
  const pausedRef = useRef(false)
  const resumeTimerRef = useRef<number | undefined>(undefined)
  const handlersRef = useRef(handlers)
  useEffect(() => { handlersRef.current = handlers })

  const pause = useCallback(() => {
    window.clearTimeout(resumeTimerRef.current)
    pausedRef.current = true
  }, [])
  const resume = useCallback(() => {
    window.clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = window.setTimeout(() => { pausedRef.current = false }, RESUME_DELAY_MS)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let closeMic = () => undefined as void
    let queue = Promise.resolve()
    const segmenter = new SpeechSegmenter()
    const fail = (failure: 'blocked' | 'error', message: string) => {
      if (cancelled) return
      setPhase(failure)
      setDetail(message)
      handlersRef.current.onFailure(failure, message)
    }
    const transcribe = (segment: Float32Array) => {
      queue = queue.then(async () => {
        if (cancelled || pausedRef.current) return
        setPhase('transcribing')
        const text = cleanTranscript(await api().transcribe(segment))
        if (cancelled) return
        setPhase('ready')
        if (text) handlersRef.current.onTranscript(text)
      }).catch(() => fail('error', 'Speech could not be transcribed.'))
    }
    const onFrame = (frame: Float32Array) => {
      if (pausedRef.current) { segmenter.reset(); return }
      const wasActive = segmenter.active
      const segment = segmenter.push(frame)
      if (segmenter.active !== wasActive && segmenter.active) setPhase('hearing')
      else if (wasActive && !segmenter.active && !segment) setPhase('ready')
      if (segment) transcribe(segment)
    }
    const start = async () => {
      setPhase('loading')
      setDetail('')
      try {
        await api().prepareVoice(({ percent }) => { if (!cancelled) setDetail(`Downloading voice model · ${percent}%`) })
      } catch (error) {
        fail('error', error instanceof Error ? error.message : 'The voice model could not be loaded.')
        return
      }
      if (cancelled) return
      try {
        const close = await openMic(onFrame)
        if (cancelled) { close(); return }
        closeMic = close
        setPhase('ready')
        setDetail('')
      } catch (error) {
        const denied = error instanceof DOMException && error.name === 'NotAllowedError'
        fail(denied ? 'blocked' : 'error', denied ? 'Microphone permission was not granted.' : 'No usable microphone was found.')
      }
    }
    void start()
    return () => {
      cancelled = true
      closeMic()
      setPhase(current => current === 'blocked' || current === 'error' ? current : 'off')
    }
  }, [enabled])

  return { phase, detail, pause, resume }
}
