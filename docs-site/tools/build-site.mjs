#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import asciidoctorFactory from '@asciidoctor/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const docsRoot = path.join(repoRoot, 'docs-site');
const generatedDir = path.join(docsRoot, 'modules', 'ROOT', 'pages', 'generated');
const outputDir = path.join(docsRoot, 'build', 'site');
const assetsDir = path.join(docsRoot, 'assets');

const repoBlobUrl = process.env.DOCS_REPO_BLOB_URL || 'https://github.com/your-org/kosha/blob/main';

const pages = [
  { slug: 'index', title: 'Kosha Documentation', source: null },
  { slug: 'readme-setup', title: 'Repository Guide and Setup', source: 'readme-setup.adoc' },
  { slug: '01-system-overview', title: 'Chapter 1: System Overview', source: '01-system-overview.adoc' },
  { slug: '02-database-architecture', title: 'Chapter 2: Database Architecture', source: '02-database-architecture.adoc' },
  { slug: '03-data-engine', title: 'Chapter 3: Data Engine', source: '03-data-engine.adoc' },
  { slug: '04-ui-ux-architecture', title: 'Chapter 4: UI UX Architecture', source: '04-ui-ux-architecture.adoc' },
  { slug: '05-feature-module-architecture', title: 'Chapter 5: Feature Module Architecture', source: '05-feature-module-architecture.adoc' },
  { slug: '06-quality-reliability-operations', title: 'Chapter 6: Quality Reliability and Operations', source: '06-quality-reliability-operations.adoc' },
  { slug: '07-governance-roadmap-and-ownership', title: 'Chapter 7: Governance and Ownership', source: '07-governance-roadmap-and-ownership.adoc' }
];

const asciidoctor = asciidoctorFactory();

function renderNav(currentSlug) {
  const items = pages
    .map((page) => {
      const href = `${page.slug}.html`;
      const active = page.slug === currentSlug ? 'active' : '';
      return `<li><a class="${active}" href="${href}">${page.title}</a></li>`;
    })
    .join('\n');

  return `<ul class="nav">${items}</ul>`;
}

function renderLayout({ title, bodyHtml, currentSlug }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="assets/site.css" />
  </head>
  <body>
    <div class="layout">
      <aside class="sidebar">
        <h1 class="brand"><a href="index.html">Kosha Docs</a></h1>
        ${renderNav(currentSlug)}
      </aside>
      <main class="main">
        <article class="page">
          ${bodyHtml}
          <p class="meta">Generated from repository docs. Source links use ${repoBlobUrl}.</p>
        </article>
      </main>
    </div>
  </body>
</html>
`;
}

function renderHomeBody() {
  const chapterLinks = pages
    .filter((page) => page.slug !== 'index')
    .map((page) => `<li><a href="${page.slug}.html">${page.title}</a></li>`)
    .join('\n');

  return `
<h1>Kosha Documentation</h1>
<p>This website is generated from the repository Markdown docs and converted to AsciiDoc for publishing.</p>
<h2>Included Content</h2>
<ul>
${chapterLinks}
</ul>
<h2>Update Workflow</h2>
<ol>
  <li>Edit source docs in <strong>README.md</strong> or <strong>docs/*.md</strong>.</li>
  <li>Run <code>npm run build</code> inside <strong>docs-site</strong>.</li>
  <li>Deploy <strong>docs-site/build/site</strong> to your static host.</li>
</ol>
`;
}

async function buildPage(page) {
  if (page.slug === 'index') {
    return renderLayout({
      title: page.title,
      bodyHtml: renderHomeBody(),
      currentSlug: page.slug
    });
  }

  const sourcePath = path.join(generatedDir, page.source);
  const adoc = await fs.readFile(sourcePath, 'utf8');

  const bodyHtml = asciidoctor.convert(adoc, {
    safe: 'safe',
    backend: 'html5',
    header_footer: false,
    attributes: {
      'repo-blob-url': repoBlobUrl,
      source_highlighter: 'highlight.js',
      toc: 'auto'
    }
  });

  return renderLayout({
    title: page.title,
    bodyHtml,
    currentSlug: page.slug
  });
}

async function main() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(path.join(outputDir, 'assets'), { recursive: true });
  await fs.copyFile(path.join(assetsDir, 'site.css'), path.join(outputDir, 'assets', 'site.css'));

  for (const page of pages) {
    const html = await buildPage(page);
    await fs.writeFile(path.join(outputDir, `${page.slug}.html`), html, 'utf8');
    console.log(`built docs-site/build/site/${page.slug}.html`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
