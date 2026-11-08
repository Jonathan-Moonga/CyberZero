import { VOICE_FRAME_SAMPLES, VOICE_SAMPLE_RATE } from './voice'

/** Streams microphone audio as 16 kHz mono frames and returns a function that releases the device. */
export async function openMic(onFrame: (frame: Float32Array) => void): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  const context = new AudioContext({ sampleRate: VOICE_SAMPLE_RATE })
  const source = context.createMediaStreamSource(stream)
  // ScriptProcessor rather than AudioWorklet: worklet modules cannot load under this app's file:// origin and script-src policy.
  const processor = context.createScriptProcessor(VOICE_FRAME_SAMPLES, 1, 1)
  processor.onaudioprocess = event => onFrame(event.inputBuffer.getChannelData(0).slice())
  source.connect(processor)
  processor.connect(context.destination)
  await context.resume()
  return () => {
    processor.onaudioprocess = null
    processor.disconnect()
    source.disconnect()
    stream.getTracks().forEach(track => track.stop())
    void context.close()
  }
}
