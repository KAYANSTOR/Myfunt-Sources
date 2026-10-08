# Myfnt 2.9.7 — Pre-Step20 UI Fix r19d

## Fixes
- Company statistics renders core metrics immediately instead of blocking forever on IndexedDB/export work. Sync/storage enrichment uses bounded timeouts and leaves a clear partial-data note when unavailable.
- Plan/subscription window resets to the top each time it opens and uses one stable vertical scroll container with mobile touch scrolling and safe-area padding.
- Profile page rebuilt into a responsive dashboard: account hero/photo/plan, company summary, account edit card, quick actions, security card, backup/logout card.
- Package action buttons are fixed-size professional square controls; mobile no longer stretches them across the card.
- Double-booking and discount controls stay in one row in the package form, including mobile layouts.
- Suggested package icons were reduced to a curated event/booking set. Picker shows ordinal number badges plus expressive icons; existing package icons remain editable even when not part of suggestions.

## Compatibility
- Existing profile field IDs/events are preserved.
- Package business rules, sync, plans, sequential IDs and repositories are unchanged.
- Visual app version remains 2.9.7; cache revision is r19d.
