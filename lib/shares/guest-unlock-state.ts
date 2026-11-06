export type GuestUnlockStatus =
  | "idle"
  | "unlocked"
  | "relocking"
  | "relocked"
  | "relock-failed"

export type GuestUnlockState = {
  status: GuestUnlockStatus
  error: string | null
  canUnlockAgain: boolean
  relockAt: number | null
  secondsRemaining: number
  measured: boolean
}

export type GuestUnlockAction =
  | { type: "unlockStarted" }
  | {
      type: "unlockSucceeded"
      relockAt: number
      secondsRemaining: number
      canUnlockAgain: boolean
    }
  | { type: "unlockFailed"; message: string; terminal: boolean }
  | { type: "tick"; secondsRemaining: number }
  | { type: "relockStarted" }
  | { type: "relockSucceeded" }
  | { type: "relockFailed" }
  | { type: "retryRelock" }

export function createGuestUnlockState({
  initialDeadline,
  relockOnly,
}: {
  initialDeadline: number | null
  relockOnly: boolean
}): GuestUnlockState {
  return {
    status: initialDeadline === null ? "idle" : "unlocked",
    error: null,
    canUnlockAgain: !relockOnly,
    relockAt: initialDeadline,
    secondsRemaining: 0,
    measured: false,
  }
}

export function guestUnlockReducer(
  state: GuestUnlockState,
  action: GuestUnlockAction,
): GuestUnlockState {
  switch (action.type) {
    case "unlockStarted":
      return { ...state, error: null }
    case "unlockSucceeded":
      return {
        ...state,
        status: "unlocked",
        error: null,
        canUnlockAgain: action.canUnlockAgain,
        relockAt: action.relockAt,
        secondsRemaining: action.secondsRemaining,
        measured: true,
      }
    case "unlockFailed":
      return {
        ...state,
        error: action.message,
        canUnlockAgain: action.terminal ? false : state.canUnlockAgain,
      }
    case "tick":
      if (state.relockAt === null) return state
      if (state.measured && state.secondsRemaining === action.secondsRemaining) return state
      return { ...state, secondsRemaining: action.secondsRemaining, measured: true }
    case "relockStarted":
      if (state.status !== "unlocked") return state
      return { ...state, status: "relocking" }
    case "relockSucceeded":
      if (state.status !== "relocking") return state
      return { ...state, status: "relocked", relockAt: null, secondsRemaining: 0 }
    case "relockFailed":
      if (state.status !== "relocking") return state
      return { ...state, status: "relock-failed" }
    case "retryRelock":
      if (state.status !== "relock-failed") return state
      return { ...state, status: "unlocked" }
  }
}
