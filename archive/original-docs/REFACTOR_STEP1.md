# Myfnt Refactor — Step 1 (Structure Only)

## Goal
Organize the package without changing UI, runtime behavior, business rules, or load order.

## Changes
- Moved CSS files to `assets/css/`.
- Moved application/vendor JavaScript files to `assets/js/`.
- Moved icons/screenshots to `assets/images/`.
- Kept `index.html`, `manifest.json`, and `service-worker.js` at root.
- Updated all known references in HTML, manifest, diagnostics, JavaScript, and Service Worker.
- Preserved the exact CSS and JS load order from the original package.
- No CSS rules were merged/deleted in this step.
- No functions, event handlers, storage keys, database schemas, or UI markup were intentionally changed.

## Why service-worker.js remains at root
Moving it would narrow its default scope and could change PWA behavior. Keeping it at root preserves the existing application scope.

## Next step
Create a CSS ownership map and migrate duplicated rules one component at a time while snapshot-checking visual behavior.
