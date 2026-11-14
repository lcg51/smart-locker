# Processor and Region Checklist

This is an operator artifact for the Spain pilot, not legal advice. A lawyer reviews the
privacy notice and this checklist before residents are invited. Replace every `TODO` with
a verified answer; do not assume a provider is compliant because it is popular.

| Processor | Purpose | Data | Region | DPA status | Subprocessors | Transfer mechanism | Owner | Last reviewed |
|---|---|---|---|---|---|---|---|---|
| Vercel | Application hosting | Account, locker, share, and event data in transit and server logs | TODO | TODO | TODO | TODO | TODO | TODO |
| Managed PostgreSQL host | Primary database | Account, locker, share-grant hash, event, session, and verification-token data | EU region where available; confirm | TODO | TODO | TODO | TODO | TODO |
| Resend | Sign-in and guest-unlock email delivery | Recipient email, locker name, guest label, unlock time | TODO | TODO | TODO | TODO | TODO | TODO |
| Upstash | Distributed rate limiting | Rate-limit keys derived from email, IP, resident, and token | TODO | TODO | TODO | TODO | TODO | TODO |
| Vercel Analytics | Product pageviews on resident pages | Page path and standard analytics metadata; suppressed on `/share/*` | TODO | TODO | TODO | TODO | TODO | TODO |
| TTLock (Phase 2) | Lock hardware commands and state | Vendor lock ID, lock state, battery, gateway timestamps | TODO | TODO | TODO | TODO | TODO | TODO |

## Before inviting residents

- [ ] Replace `PRIVACY_CONTACT_EMAIL` with the monitored pilot contact address.
- [ ] Confirm the controller legal entity and its postal address for the privacy notice.
- [ ] Confirm each processor's DPA is signed and stored.
- [ ] Confirm the Postgres primary and backup regions are in the EU, or record the transfer mechanism.
- [ ] Record subprocessors and the transfer mechanism for each processor.
- [ ] Confirm the data-retention job is scheduled and has run once against a test database.
- [ ] Have counsel review the privacy notice and this checklist.
- [ ] Recheck this table when a processor, region, or TTLock is activated.
