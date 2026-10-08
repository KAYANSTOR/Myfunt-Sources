# Pre-Step20 r19e — Plan window scroll fix

- Root cause: the plan body was set to `height:auto` inside a fixed window with `overflow:hidden`; on some Android browsers this produced no effective scroll container.
- Fix: `#ozPlanWindow` itself is now the vertical scroll container.
- Header is sticky while the complete plan body flows naturally underneath.
- Added Android-friendly momentum scrolling, `touch-action: pan-y`, safe-area bottom padding, and contained overscroll.
- No plan/business logic changed.
- Cache revision: `v2.9.7-r19e-static`.
