import { webcrypto } from "node:crypto"

process.env.TZ = "UTC"
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto
