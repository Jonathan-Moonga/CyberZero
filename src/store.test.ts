import { beforeEach, describe, expect, it } from 'vitest'
import { useCyberStore } from './store'

describe('CyberZero state machine store', () => {
  beforeEach(() => { localStorage.clear(); useCyberStore.getState().resetDemo() })

  it('persists the breach state across navigation', () => {
    useCyberStore.getState().setSystemState('BREACH_DETECTED')
    useCyberStore.getState().setPage('detection')
    expect(useCyberStore.getState().systemState).toBe('BREACH_DETECTED')
    expect(useCyberStore.getState().page).toBe('detection')
  })

  it('stops the transfer when isolated', () => {
    useCyberStore.getState().setTransferredGb(20)
    useCyberStore.getState().setSystemState('ISOLATED')
    useCyberStore.getState().setTransferredGb(0)
    expect(useCyberStore.getState().transferredGb).toBe(0)
  })
})
