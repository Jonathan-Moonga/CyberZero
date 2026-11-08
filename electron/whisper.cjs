// Local speech-to-text. The model is downloaded once from Hugging Face; audio is only ever processed on this device.
const MODEL_ID = 'onnx-community/whisper-base.en'
const SAMPLE_RATE = 16000
const MAX_SECONDS = 20

function aggregateProgress(files, event) {
  if (event.status !== 'progress' || !event.file) return null
  files.set(event.file, { loaded: event.loaded ?? 0, total: event.total ?? 0 })
  const all = [...files.values()]
  const total = all.reduce((sum, file) => sum + file.total, 0)
  return total ? Math.min(100, Math.round(all.reduce((sum, file) => sum + file.loaded, 0) / total * 100)) : null
}

function createWhisper({ cacheDir, importTransformers = () => import('@huggingface/transformers') }) {
  let ready = null
  let loaded = false

  const prepare = (onProgress = () => undefined) => {
    ready ??= (async () => {
      const { pipeline, env } = await importTransformers()
      env.cacheDir = cacheDir
      const files = new Map()
      const instance = await pipeline('automatic-speech-recognition', MODEL_ID, {
        dtype: 'q8',
        device: 'cpu',
        progress_callback: event => {
          const percent = aggregateProgress(files, event)
          if (percent !== null) onProgress({ percent })
        },
      })
      loaded = true
      return instance
    })().catch(() => {
      ready = null
      throw new Error('The voice model could not be loaded. The first use needs an internet connection to download it.')
    })
    return ready.then(() => undefined)
  }

  const transcribe = async (samples) => {
    if (!(samples instanceof Float32Array) || samples.length === 0 || samples.length > SAMPLE_RATE * MAX_SECONDS) throw new Error('Audio segment is invalid')
    await prepare()
    const transcriber = await ready
    const result = await transcriber(samples)
    return typeof result?.text === 'string' ? result.text.trim() : ''
  }

  const status = () => ({ available: true, ready: loaded, detail: loaded ? `Whisper ready on this device (${MODEL_ID.split('/')[1]})` : 'Downloads once on first use, then runs offline on this device' })

  return { prepare, transcribe, status }
}

module.exports = { createWhisper }
