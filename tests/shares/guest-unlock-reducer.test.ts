import { describe, expect, it } from "vitest"
import {
  createGuestUnlockState,
  guestUnlockReducer,
  type GuestUnlockState,
} from "@/lib/shares/guest-unlock-state"

function state(overrides: Partial<GuestUnlockState> = {}): GuestUnlockState {
  return {
    ...createGuestUnlockState({ initialDeadline: null, relockOnly: false }),
    ...overrides,
  }
}

describe("createGuestUnlockState", () => {
  it("starts idle and unlockable when nothing is pending", () => {
    expect(createGuestUnlockState({ initialDeadline: null, relockOnly: false })).toEqual({
      status: "idle",
      error: null,
      canUnlockAgain: true,
      relockAt: null,
      secondsRemaining: 0,
      measured: false,
    })
  })

  it("starts unlocked from a server deadline", () => {
    const deadline = Date.parse("2026-11-06T10:01:00.000Z")

    expect(createGuestUnlockState({ initialDeadline: deadline, relockOnly: false })).toMatchObject({
      status: "unlocked",
      canUnlockAgain: true,
      relockAt: deadline,
    })
    expect(createGuestUnlockState({ initialDeadline: deadline, relockOnly: true })).toMatchObject({
      status: "unlocked",
      canUnlockAgain: false,
      relockAt: deadline,
    })
  })
})

describe("guestUnlockReducer", () => {
  it("clears the previous error when an unlock starts", () => {
    const before = state({ error: "Too many attempts." })

    expect(guestUnlockReducer(before, { type: "unlockStarted" })).toEqual({ ...before, error: null })
  })

  it("moves to unlocked with the server deadline and remaining seconds", () => {
    const deadline = Date.parse("2026-11-06T10:01:00.000Z")

    const after = guestUnlockReducer(state(), {
      type: "unlockSucceeded",
      relockAt: deadline,
      secondsRemaining: 60,
      canUnlockAgain: true,
    })

    expect(after).toEqual({
      status: "unlocked",
      error: null,
      canUnlockAgain: true,
      relockAt: deadline,
      secondsRemaining: 60,
      measured: true,
    })
  })

  it("keeps the state shape when an unlock fails", () => {
    const after = guestUnlockReducer(state(), {
      type: "unlockFailed",
      message: "Too many attempts. Please wait a minute and try again.",
      terminal: false,
    })

    expect(after).toEqual(state({
      error: "Too many attempts. Please wait a minute and try again.",
    }))
  })

  it("marks the link unavailable when an unlock fails terminally", () => {
    const after = guestUnlockReducer(state(), {
      type: "unlockFailed",
      message: "This link is no longer available. Ask for a new link.",
      terminal: true,
    })

    expect(after).toMatchObject({ canUnlockAgain: false, status: "idle" })
  })

  it("ignores ticks when no deadline is pending", () => {
    const before = state()

    expect(guestUnlockReducer(before, { type: "tick", secondsRemaining: 10 })).toBe(before)
  })

  it("records measured seconds from a deadline tick", () => {
    const deadline = Date.parse("2026-11-06T10:01:00.000Z")

    const after = guestUnlockReducer(state({ status: "unlocked", relockAt: deadline }), {
      type: "tick",
      secondsRemaining: 42,
    })

    expect(after).toMatchObject({ secondsRemaining: 42, measured: true })
  })

  it("does not re-render when a measured tick reports the same value", () => {
    const before = state({
      status: "unlocked",
      relockAt: Date.parse("2026-11-06T10:01:00.000Z"),
      secondsRemaining: 0,
      measured: true,
    })

    expect(guestUnlockReducer(before, { type: "tick", secondsRemaining: 0 })).toBe(before)
  })

  it("starts relocking only from the unlocked state", () => {
    const unlocked = state({ status: "unlocked", relockAt: 1, measured: true })

    expect(guestUnlockReducer(unlocked, { type: "relockStarted" })).toMatchObject({
      status: "relocking",
    })
    expect(guestUnlockReducer(state(), { type: "relockStarted" })).toEqual(state())
  })

  it("clears the deadline after a successful relock", () => {
    const relocking = state({
      status: "relocking",
      relockAt: Date.parse("2026-11-06T10:01:00.000Z"),
      secondsRemaining: 0,
      measured: true,
    })

    expect(guestUnlockReducer(relocking, { type: "relockSucceeded" })).toEqual({
      ...relocking,
      status: "relocked",
      relockAt: null,
      secondsRemaining: 0,
    })
  })

  it("keeps the deadline after a failed relock so retry can use it", () => {
    const deadline = Date.parse("2026-11-06T10:01:00.000Z")
    const relocking = state({ status: "relocking", relockAt: deadline, measured: true })

    expect(guestUnlockReducer(relocking, { type: "relockFailed" })).toMatchObject({
      status: "relock-failed",
      relockAt: deadline,
    })
  })

  it("returns to the unlocked state for a retry", () => {
    const failed = state({ status: "relock-failed", relockAt: 1, measured: true })

    expect(guestUnlockReducer(failed, { type: "retryRelock" })).toMatchObject({
      status: "unlocked",
      relockAt: 1,
    })
    expect(guestUnlockReducer(state({ status: "relocked" }), { type: "retryRelock" }))
      .toEqual(state({ status: "relocked" }))
  })

  it("can unlock again after a successful relock", () => {
    const deadline = Date.parse("2026-11-06T10:01:00.000Z")
    const relocked = state({ status: "relocked", relockAt: null })

    expect(guestUnlockReducer(relocked, {
      type: "unlockSucceeded",
      relockAt: deadline,
      secondsRemaining: 60,
      canUnlockAgain: false,
    })).toMatchObject({
      status: "unlocked",
      relockAt: deadline,
      canUnlockAgain: false,
    })
  })
})
