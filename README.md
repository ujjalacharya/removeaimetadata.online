# Image Evidence Desk

A local-first TanStack Start app with two browser-side workflows:

- remove standard EXIF, IPTC, XMP, location, and editing metadata by decoding and re-encoding JPEG, PNG, and WebP images;
- scan embedded metadata and provenance text for explainable AI-generation or AI-editing signals.

The AI scan is intentionally evidence-based. A missing marker is not proof that an image is human-made, and metadata removal does not guarantee how a social platform will classify an image.

## Run locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Checks

```bash
npm run typecheck
npm test
npm run build
```
