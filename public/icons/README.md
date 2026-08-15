# PWA Icons

Generate the following PNG icons and place them in this directory.
All icons should use the BakeSync amber brand colour (#D97706) as background
with the bread loaf logo centred.

Required sizes:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png   ← used in manifest + notification badge
- icon-384x384.png
- icon-512x512.png   ← used for install splash screen
- apple-touch-icon.png (180x180)

Recommended tool: https://maskable.app/editor (for maskable icons)
Or use: npx pwa-asset-generator ./logo.svg ./public/icons --manifest ./public/manifest.json
