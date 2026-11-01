import type { LockProvider, LockResult, LockerState } from "@/lib/locks/types"

type MockLockProviderOptions = {
  strictUnknown?: boolean
  failNextUnlock?: boolean
}

function initialState(): LockerState {
  return { status: "locked", batteryLevel: 100, online: true }
}

export class MockLockProvider implements LockProvider {
  private readonly locks = new Map<string, LockerState>()
  private nextId = 1
  private failNextUnlock: boolean

  constructor(private readonly options: MockLockProviderOptions = {}) {
    this.failNextUnlock = options.failNextUnlock ?? false
  }

  async provision(_input: { name: string }): Promise<{ vendorLockId: string }> {
    const vendorLockId = `mock-${this.nextId}`
    this.nextId += 1
    this.locks.set(vendorLockId, initialState())
    return { vendorLockId }
  }

  async unlock(vendorLockId: string): Promise<LockResult> {
    const state = this.getOrRegister(vendorLockId)
    if (!state) return { success: false, errorCode: "unknown_lock" }

    if (this.failNextUnlock) {
      this.failNextUnlock = false
      return { success: false, errorCode: "mock_failure" }
    }

    state.status = "unlocked"
    return { success: true }
  }

  async lock(vendorLockId: string): Promise<LockResult> {
    const state = this.getOrRegister(vendorLockId)
    if (!state) return { success: false, errorCode: "unknown_lock" }

    state.status = "locked"
    return { success: true }
  }

  async getState(vendorLockId: string): Promise<LockerState> {
    const state = this.locks.get(vendorLockId)
    return state ? { ...state } : { status: "unknown", batteryLevel: null, online: false }
  }

  private getOrRegister(vendorLockId: string): LockerState | undefined {
    const existing = this.locks.get(vendorLockId)
    if (existing) return existing
    if (this.options.strictUnknown) return undefined

    const state = initialState()
    this.locks.set(vendorLockId, state)
    return state
  }
}
