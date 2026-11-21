import { createHash } from "node:crypto"
import { checkQuota, QuotaExceededError, recordVendorCall } from "@/lib/locks/quota"
import type { QuotaKind, QuotaStatus } from "@/lib/locks/quota"
import type { LockProvider, LockResult, LockerState } from "@/lib/locks/types"

export type TTLockApi = {
  get(path: string, params: Record<string, number>, kind?: QuotaKind): Promise<unknown>
  post(path: string, params: Record<string, number>, kind?: QuotaKind): Promise<unknown>
}

type TTLockQuota = {
  check(kind: QuotaKind): Promise<QuotaStatus>
  record(): Promise<void>
}

type TTLockClientOptions = {
  baseUrl: string
  clientId: string
  accessToken: string
  fetch?: typeof fetch
  now?: () => number
  quota?: TTLockQuota
}

export class TTLockClient implements TTLockApi {
  private readonly quota: TTLockQuota

  constructor(private readonly options: TTLockClientOptions) {
    this.quota = options.quota ?? {
      check: (kind) => checkQuota({ vendor: "ttlock", kind }),
      record: () => recordVendorCall("ttlock"),
    }
  }

  get(path: string, params: Record<string, number>, kind: QuotaKind = "admin"): Promise<unknown> {
    return this.send("GET", path, params, kind)
  }

  post(path: string, params: Record<string, number>, kind: QuotaKind = "admin"): Promise<unknown> {
    return this.send("POST", path, params, kind)
  }

  private async send(
    method: "GET" | "POST",
    path: string,
    params: Record<string, number>,
    kind: QuotaKind,
  ): Promise<unknown> {
    const status = await this.quota.check(kind)
    if (status !== "ok") throw new QuotaExceededError(status)

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

    // Count the call once it reached the vendor, including vendor-level errors.
    await this.quota.record()

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

function parseTokenResponse(
  json: { access_token?: unknown; refresh_token?: unknown; uid?: unknown; expires_in?: unknown; errcode?: unknown },
  status: number,
  now: () => number,
): TTLockToken {
  if (status < 200 || status >= 300 || typeof json.access_token !== "string" || typeof json.expires_in !== "number") {
    throw new Error(`TTLock token request failed: ${String(json.errcode ?? status)}`)
  }

  return {
    accessToken: json.access_token,
    refreshToken: String(json.refresh_token ?? ""),
    uid: Number(json.uid ?? 0),
    expiresAt: new Date(now() + json.expires_in * 1000).toISOString(),
  }
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
  return parseTokenResponse(await response.json(), response.status, now)
}

export async function refreshTTLockToken(
  input: { baseUrl: string; clientId: string; clientSecret: string; refreshToken: string; uid?: number },
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<TTLockToken> {
  const body = new URLSearchParams({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
  })
  const response = await fetchImpl(`${input.baseUrl.replace(/\/$/, "")}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const token = parseTokenResponse(await response.json(), response.status, now)
  return { ...token, uid: token.uid || input.uid || 0 }
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
      const response = (await this.client.get("/v3/lock/queryOpenState", { lockId }, "state")) as {
        errcode?: unknown
        state?: unknown
      }
      if (response?.errcode !== 0) return UNKNOWN_OFFLINE
      if (response.state === 0) return { status: "locked", batteryLevel: null, online: true }
      if (response.state === 1) return { status: "unlocked", batteryLevel: null, online: true }
      return { status: "unknown", batteryLevel: null, online: true }
    } catch (error) {
      // The quota guard must surface to the caller so the UI can explain the
      // pause; a plain query failure stays an unknown, offline state.
      if (error instanceof QuotaExceededError) throw error
      return UNKNOWN_OFFLINE
    }
  }

  private async command(path: string, vendorLockId: string): Promise<LockResult> {
    const lockId = parseLockId(vendorLockId)
    if (lockId === null) return { success: false, errorCode: "unknown_lock" }

    try {
      const response = (await this.client.post(path, { lockId }, "command")) as { errcode?: unknown }
      if (response?.errcode === 0) return { success: true }
      if (typeof response?.errcode === "number") return { success: false, errorCode: String(response.errcode) }
      return { success: false, errorCode: "invalid_response" }
    } catch (error) {
      if (error instanceof QuotaExceededError) return { success: false, errorCode: "quota_exceeded" }
      return { success: false, errorCode: "network_error" }
    }
  }
}
