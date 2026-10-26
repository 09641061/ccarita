# Decision: Embedded Signup behind a setting, with a development form

Status: implemented

## Problem

The owner connects the establishment's WhatsApp number through Meta's Embedded Signup (W2, `../docs/07-whatsapp-integration.md` §3): Meta's JavaScript SDK opens a window with Takodu's app id and configuration id, and returns a single-use code with the chosen WhatsApp account and number, which `POST /api/v1/establishments/{id}/whatsapp-line` sends to pibble. Takodu has no Meta app yet, so ccarita has no ids to put in it, and pibble's dev mode (`DevWhatsappOnboarding`) accepts any code without Meta. The screen must work in development without pretending to connect a real number in production.

## Decision

`EmbeddedSignup` (`conversations/infrastructure/embedded-signup.ts`) loads Meta's SDK, opens the coexistence flow and resolves with `{ code, wabaId, phoneNumberId }` once both the login callback and Meta's `WA_EMBEDDED_SIGNUP` finish message have arrived; closing the window fails with `SIGNUP_CANCELLED`. It is configured by `META_SIGNUP`, which `app.config.ts` provides from `environment.metaSignup` (`{ appId, configId, graphVersion }`), and that is `null` in every environment. While it is `null`, the WhatsApp screen says connecting is not set up, and only development builds (`isDevMode()`) add a form, labelled as a test, that posts the values pibble's dev mode accepts (`dev-code` and the contract's example ids). Production builds never show that form.

## Alternatives considered

**A fake connection in every build.** It would demo well, but a production owner would see a number "connected" that receives nothing.

**No connect button until Takodu has a Meta app.** Honest, but the line, the inbox and the onboarding step could not be tried against pibble at all.

**Loading the SDK from `index.html`.** Every page would load Meta's script, and the Content Security Policy would have to allow it even where no line is connected.

## Consequences

Turning the real flow on is setting `environment.metaSignup` and allowing `https://connect.facebook.net` in the site's Content Security Policy. The SDK flow is covered by unit tests with a fake `FB` object; it has not run against Meta. Retrying after a lost answer reuses Meta's code with the same idempotency key, since the code works once.
