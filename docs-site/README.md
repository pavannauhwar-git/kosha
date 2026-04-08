# AsciiDoc Documentation Site

This folder contains a local AsciiDoc static site pipeline for the Kosha docs and handover manual.

## Commands

- `npm run generate` - Converts repository Markdown docs into AsciiDoc pages.
- `npm run build` - Generates AsciiDoc pages, then builds static HTML pages from AsciiDoc.
- `npm run preview` - Builds and serves the site locally at `http://localhost:8081`.

## How it works

1. `tools/generate-adoc.mjs` reads:
   - `README.md`
   - `docs/01-system-overview.md`
   - `docs/02-database-architecture.md`
   - `docs/03-data-engine.md`
   - `docs/04-ui-ux-architecture.md`
   - `docs/05-feature-module-architecture.md`
   - `docs/06-quality-reliability-operations.md`
   - `docs/07-governance-roadmap-and-ownership.md`
2. It converts Markdown to AsciiDoc and writes output to `modules/ROOT/pages/generated`.
3. `tools/build-site.mjs` renders the AsciiDoc files into static HTML in `build/site`.

## Deployment

You can deploy `build/site` to any static host (Vercel, Netlify, GitHub Pages, S3 + CloudFront).

For Vercel, set:

- Root directory: `docs-site`
- Build command: `npm run build`
- Output directory: `build/site`
