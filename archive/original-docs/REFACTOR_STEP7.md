# Myfnt 2.9.7 — Refactor Step 7

## Scope
Authentication / account journey CSS ownership only. The login, OTP, password, country picker, account creation, local session, provider-demo flow, onboarding and tour JavaScript behavior is intentionally unchanged.

## Changes
- `auth.css` is now the single owner of the core identity shell and theme tokens.
- Moved the final effective light/dark identity tokens into `auth.css`.
- Collapsed old base + v2.1.2 + journey overrides for cards, inputs, captions, primary/secondary buttons and business chips into canonical rules.
- Preserved the existing effective values, including the different focus ring behavior for text inputs vs select controls.
- `auth-journey.css` now owns only journey-specific UI: back step, password actions, provider buttons, consent/privacy, progress checklist, guest gate, tour and related responsive rules.
- Removed the duplicated `.oz-progress-pill[hidden]` rule.
- Kept contextual/semantic extensions (country card sizing, primary/secondary specialization, mobile country-card sizing); they are not patch layers.

## Not changed
- `auth.js`
- `auth-journey.js`
- `auth-data.js`
- OTP generation / resend behavior
- password validation / lock behavior
- local session keys or storage format
- country detection (`ipwho.is`) behavior
- Google/Apple demo/provider behavior
- creation of local company/admin defaults
- onboarding progress/tour timing
- HTML structure

## Verification
- All JavaScript files pass `node --check`.
- CSS brace balance is valid.
- `index.html` asset references: 0 missing.
- Service Worker precache references: 0 missing.
- Same-context duplicate selector groups in core auth CSS reduced from 13 to 4 semantic extension groups.
- Journey duplicate `[hidden]` rule removed.
- Cache revision advanced to `v2.9.7-r7-static`; visible app version remains 2.9.7.
