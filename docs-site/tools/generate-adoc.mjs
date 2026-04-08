#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(repoRoot, 'docs-site', 'modules', 'ROOT', 'pages', 'generated');

const sourceMap = [
  { source: 'README.md', target: 'readme-setup.adoc' },
  { source: 'docs/01-system-overview.md', target: '01-system-overview.adoc' },
  { source: 'docs/02-database-architecture.md', target: '02-database-architecture.adoc' },
  { source: 'docs/03-data-engine.md', target: '03-data-engine.adoc' },
  { source: 'docs/04-ui-ux-architecture.md', target: '04-ui-ux-architecture.adoc' },
  { source: 'docs/05-feature-module-architecture.md', target: '05-feature-module-architecture.adoc' },
  { source: 'docs/06-quality-reliability-operations.md', target: '06-quality-reliability-operations.adoc' },
  { source: 'docs/07-governance-roadmap-and-ownership.md', target: '07-governance-roadmap-and-ownership.adoc' }
];

function isMarkdownTableSeparator(line) {
  const trimmed = line.trim();
  return /^\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(trimmed);
}

function isMarkdownTableRow(line) {
  return /^\|.*\|\s*$/.test(line.trim());
}

function splitTableRow(line) {
  const raw = line.trim().replace(/^\|/, '').replace(/\|\s*$/, '');
  return raw.split('|').map((cell) => cell.trim());
}

function convertInlineMarkdownToAsciiDoc(line) {
  let result = line;

  result = result.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, target) => {
    const normalized = target.trim();

    if (normalized.startsWith('#')) {
      return `<<${normalized.slice(1)},${text}>>`;
    }

    if (/^[a-zA-Z]+:\/\//.test(normalized) || normalized.startsWith('mailto:')) {
      return `link:${normalized}[${text}]`;
    }

    const cleaned = normalized.replace(/^\.\//, '').replace(/^\/+/, '');
    return `link:{repo-blob-url}/${cleaned}[${text}]`;
  });

  return result;
}

function convertMarkdownToAsciiDoc(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let inFence = false;

  while (i < lines.length) {
    const rawLine = lines[i];

    if (/^```/.test(rawLine.trim())) {
      if (!inFence) {
        const lang = rawLine.trim().slice(3).trim();
        out.push(lang ? `[source,${lang}]` : '[source]');
        out.push('----');
        inFence = true;
      } else {
        out.push('----');
        inFence = false;
      }
      i += 1;
      continue;
    }

    if (inFence) {
      out.push(rawLine);
      i += 1;
      continue;
    }

    if (isMarkdownTableRow(rawLine) && i + 1 < lines.length && isMarkdownTableSeparator(lines[i + 1])) {
      out.push('|===');
      const header = splitTableRow(rawLine).map((cell) => convertInlineMarkdownToAsciiDoc(cell));
      out.push(`| ${header.join(' | ')}`);
      i += 2;

      while (i < lines.length && isMarkdownTableRow(lines[i])) {
        const cells = splitTableRow(lines[i]).map((cell) => convertInlineMarkdownToAsciiDoc(cell));
        out.push(`| ${cells.join(' | ')}`);
        i += 1;
      }

      out.push('|===');
      continue;
    }

    if (/^>\s?/.test(rawLine)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      out.push('[quote]');
      out.push('____');
      out.push(...quoteLines);
      out.push('____');
      continue;
    }

    let line = rawLine;

    if (/^######\s+/.test(line)) {
      line = line.replace(/^######\s+/, '====== ');
    } else if (/^#####\s+/.test(line)) {
      line = line.replace(/^#####\s+/, '===== ');
    } else if (/^####\s+/.test(line)) {
      line = line.replace(/^####\s+/, '==== ');
    } else if (/^###\s+/.test(line)) {
      line = line.replace(/^###\s+/, '=== ');
    } else if (/^##\s+/.test(line)) {
      line = line.replace(/^##\s+/, '== ');
    } else if (/^#\s+/.test(line)) {
      line = line.replace(/^#\s+/, '= ');
    } else if (/^\s*---+\s*$/.test(line) || /^\s*\*\*\*+\s*$/.test(line)) {
      line = "'''";
    }

    // AsciiDoc ordered lists are best represented with ". " markers.
    line = line.replace(/^\d+\.\s+/, '. ');

    line = convertInlineMarkdownToAsciiDoc(line);
    out.push(line);
    i += 1;
  }

  if (inFence) {
    out.push('----');
  }

  return out.join('\n').trimEnd() + '\n';
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  for (const item of sourceMap) {
    const sourcePath = path.join(repoRoot, item.source);
    const targetPath = path.join(outputDir, item.target);

    const markdown = await fs.readFile(sourcePath, 'utf8');
    const converted = convertMarkdownToAsciiDoc(markdown);
    const banner = `// AUTO-GENERATED FROM ${item.source}\n// Run 'npm run generate' in docs-site to refresh.\n\n`;

    await fs.writeFile(targetPath, banner + converted, 'utf8');
    console.log(`generated ${path.relative(repoRoot, targetPath)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
