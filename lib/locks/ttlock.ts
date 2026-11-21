import { createHash } from "node:crypto"
import type { LockProvider, LockResult, LockerState } from "@/lib/locks/types"

export type TTLockApi = {
  get(path: string, params: Record<string, number>): Promise<unknown>
  post(path: string, params: Record<string, number>): Promise<unknown>
}

type TTLockClientOptions = {
  baseUrl: string
  clientId: string
  accessToken: string
  fetch?: typeof fetch
  now?: () => number
}

export class TTLockClient implements TTLockApi {
  constructor(private readonly options: TTLockClientOptions) {}

  get(path: string, params: Record<string, number>): Promise<unknown> {
    return this.send("GET", path, params)
  }

  post(path: string, params: Record<string, number>): Promise<unknown> {
    return this.send("POST", path, params)
  }

  private async send(method: "GET" | "POST", path: string, params: Record<string, number>): Promise<unknown> {
    const fetchImpl = this.options.fetch ?? fetch
    const now = this.options.now ?? Date.now
    const body = new URLSearchParams({
      clientId: this.options.clientId,
      accessToken: this.options.accessToken,
      date: String(now()),
      ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    })
    const base = this.options.baseUrl.replace(/\/$/, "")

    const response = method === "GET"
      ? await fetchImpl(`${base}${path}?${body.toString()}`, { method })
      : await fetchImpl(`${base}${path}`, {
          method,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        })

    if (!response.ok) throw new Error(`TTLock responded with HTTP ${response.status}`)
    return response.json()
  }
}

export type TTLockToken = {
  accessToken: string
  refreshToken: string
  uid: number
  expiresAt: string
}

export async function requestTTLockToken(
  input: { baseUrl: string; clientId: string; clientSecret: string; username: string; password: string },
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<TTLockToken> {
  const body = new URLSearchParams({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    username: input.username,
    password: createHash("md5").update(input.password).digest("hex"),
  })
  const response = await fetchImpl(`${input.baseUrl.replace(/\/$/, "")}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const json = (await response.json()) as {
    access_token?: unknown
    refresh_token?: unknown
    uid?: unknown
    expires_in?: unknown
    errcode?: unknown
  }

  if (!response.ok || typeof json.access_token !== "string" || typeof json.expires_in !== "number") {
    throw new Error(`TTLock token request failed: ${String(json.errcode ?? response.status)}`)
  }

  return {
    accessToken: json.access_token,
    refreshToken: String(json.refresh_token ?? ""),
    uid: Number(json.uid ?? 0),
    expiresAt: new Date(now() + json.expires_in * 1000).toISOString(),
  }
}

const UNKNOWN_OFFLINE: LockerState = { status: "unknown", batteryLevel: null, online: false }

function parseLockId(vendorLockId: string): number | null {
  return /^\d+$/.test(vendorLockId) ? Number(vendorLockId) : null
}

export class TTLockProvider implements LockProvider {
  constructor(private readonly client: TTLockApi) {}

  async provision(_input: { name: string }): Promise<{ vendorLockId: string }> {
    throw new Error("TTLock locks are added in the TTLock app, then enrolled with their lockId")
  }

  unlock(vendorLockId: string): Promise<LockResult> {
    return this.command("/v3/lock/unlock", vendorLockId)
  }

  lock(vendorLockId: string): Promise<LockResult> {
    return this.command("/v3/lock/lock", vendorLockId)
  }

  async getState(vendorLockId: string): Promise<LockerState> {
    const lockId = parseLockId(vendorLockId)
    if (lockId === null) return UNKNOWN_OFFLINE

    try {
      const response = (await this.client.get("/v3/lock/queryOpenState", { lockId })) as { errcode?: unknown; state?: unknown }
      if (response?.errcode !== 0) return UNKNOWN_OFFLINE
      if (response.state === 0) return { status: "locked", batteryLevel: null, online: true }
      if (response.state === 1) return { status: "unlocked", batteryLevel: null, online: true }
      return { status: "unknown", batteryLevel: null, online: true }
    } catch {
      return UNKNOWN_OFFLINE
    }
  }

  private async command(path: string, vendorLockId: string): Promise<LockResult> {
    const lockId = parseLockId(vendorLockId)
    if (lockId === null) return { success: false, errorCode: "unknown_lock" }

    try {
      const response = (await this.client.post(path, { lockId })) as { errcode?: unknown }
      if (response?.errcode === 0) return { success: true }
      if (typeof response?.errcode === "number") return { success: false, errorCode: String(response.errcode) }
      return { success: false, errorCode: "invalid_response" }
    } catch {
      return { success: false, errorCode: "network_error" }
    }
  }
}
