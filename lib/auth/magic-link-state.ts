export type RequestMagicLinkState = {
  error: string | null
  at: number
}

export const initialRequestMagicLinkState: RequestMagicLinkState = { error: null, at: 0 }
