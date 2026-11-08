import { describe, expect, it, vi } from 'vitest'
import whisper from './whisper.cjs'

const setup = (pipeline) => whisper.createWhisper({ cacheDir: 'models', importTransformers: async () => ({ pipeline, env: {} }) })

describe('createWhisper', () => {
  it('loads the model once across calls and transcribes', async () => {
    const pipeline = vi.fn(async () => async () => ({ text: ' Hello. ' }))
    const instance = setup(pipeline)
    await instance.prepare()
    await expect(instance.transcribe(new Float32Array(1600))).resolves.toBe('Hello.')
    expect(pipeline).toHaveBeenCalledTimes(1)
    expect(instance.status().ready).toBe(true)
  })

  it('reports combined download progress across model files', async () => {
    const pipeline = vi.fn(async (_task, _model, options) => {
      options.progress_callback({ status: 'progress', file: 'a', loaded: 50, total: 100 })
      options.progress_callback({ status: 'progress', file: 'b', loaded: 150, total: 300 })
      return async () => ({ text: '' })
    })
    const progress = []
    await setup(pipeline).prepare(update => progress.push(update.percent))
    expect(progress).toEqual([50, 50])
  })

  it('can retry after a failed download', async () => {
    const pipeline = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(async () => ({ text: 'ok' }))
    const instance = setup(pipeline)
    await expect(instance.prepare()).rejects.toThrow('internet')
    await expect(instance.prepare()).resolves.toBeUndefined()
  })

  it('rejects anything but a bounded audio buffer', async () => {
    const instance = setup(vi.fn(async () => async () => ({ text: '' })))
    await expect(instance.transcribe('audio')).rejects.toThrow('invalid')
    await expect(instance.transcribe(new Float32Array(16000 * 21))).rejects.toThrow('invalid')
  })
})
