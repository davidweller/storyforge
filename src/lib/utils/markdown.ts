/**
 * Markdown rendering utilities for ContentDisplay.
 *
 * These are pure functions with no React dependencies — extracted from
 * ContentDisplay.tsx so they can be tested and reused independently.
 */

/** Sentinel characters used to protect table HTML from the line-level pipeline. */
const TABLE_BLOCK_PREFIX = '\u0000TABLE:';
const TABLE_BLOCK_SUFFIX = '\u0000';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatInline(text: string): string {
  let html = escapeHtml(text);

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-[var(--muted)] px-1.5 py-0.5 rounded text-sm">$1</code>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-[var(--accent)] underline hover:text-[var(--accent-foreground)]" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Bold (must precede italic)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');

  // Italic (avoid conflicts with bold)
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');

  return html;
}

/** Convert markdown table blocks to card-style HTML (avoids <table> elements). */
export function replaceMarkdownTables(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;

  function isTableRow(line: string): boolean {
    const t = line.trim();
    return /^\|.+\|$/.test(t) && t.includes('|');
  }

  function parseTableRow(line: string): string[] {
    return line
      .trim()
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
  }

  while (i < lines.length) {
    const line = lines[i];

    if (!isTableRow(line)) {
      result.push(line);
      i++;
      continue;
    }

    const rows: string[][] = [];
    while (i < lines.length && isTableRow(lines[i])) {
      rows.push(parseTableRow(lines[i]));
      i++;
    }

    const hasSeparator = rows.length >= 2 && rows[1].every((cell) => /^-+$/.test(cell));
    const headerRow = hasSeparator ? rows[0] : null;
    const bodyRows = hasSeparator ? rows.slice(2) : rows;

    if (headerRow && bodyRows.length > 0) {
      const headerText = headerRow.map((c) => escapeHtml(c)).join(' · ');
      const cards = bodyRows
        .map((cells) => `<p class="prose-book-card">${cells.map((c) => escapeHtml(c)).join(' · ')}</p>`)
        .join('');
      const blockHtml = `<p class="prose-book-cards-header"><strong>${headerText}</strong></p>${cards}`;
      result.push(TABLE_BLOCK_PREFIX + blockHtml + TABLE_BLOCK_SUFFIX);
    } else {
      rows.forEach((r) => result.push(r.join(' | ')));
    }
  }

  return result.join('\n');
}

/** Render markdown text to HTML suitable for use with dangerouslySetInnerHTML. */
export function formatMarkdown(text: string): string {
  if (!text) return '';

  const withCards = replaceMarkdownTables(text);
  const lines = withCards.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  let blankRun = false;

  function flushList() {
    if (listItems.length > 0 && listType) {
      const tag = listType === 'ul' ? 'ul' : 'ol';
      const listClass = listType === 'ul' ? 'list-disc' : 'list-decimal';
      result.push(`<${tag} class="my-2 space-y-1 ml-6 ${listClass}">`);
      result.push(listItems.join(''));
      result.push(`</${tag}>`);
      listItems = [];
      listType = null;
      inList = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      flushList();
      blankRun = false;
      if (inCodeBlock) {
        result.push('</code></pre>');
        inCodeBlock = false;
      } else {
        result.push('<pre class="bg-[var(--muted)] p-4 rounded-lg my-4 overflow-x-auto"><code>');
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { result.push(line + '\n'); continue; }

    // Horizontal rules
    if (trimmed === '---' || trimmed === '***') {
      flushList();
      blankRun = false;
      result.push('<hr class="my-4 border-[var(--border)]" />');
      continue;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList();
      if (blankRun) { result.push('<br />'); blankRun = false; }
      result.push(`<h3>${escapeHtml(trimmed.substring(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      if (blankRun) { result.push('<br />'); blankRun = false; }
      result.push(`<h2>${escapeHtml(trimmed.substring(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      if (blankRun) { result.push('<br />'); blankRun = false; }
      result.push(`<h1>${escapeHtml(trimmed.substring(2))}</h1>`);
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith('> ')) {
      flushList();
      if (blankRun) { result.push('<br />'); blankRun = false; }
      result.push(`<blockquote>${formatInline(trimmed.substring(2))}</blockquote>`);
      continue;
    }

    // Lists
    const unorderedMatch = trimmed.match(/^-\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      const content = unorderedMatch ? unorderedMatch[1] : orderedMatch![1];
      const currentListType: 'ul' | 'ol' = unorderedMatch ? 'ul' : 'ol';
      if (blankRun) { result.push('<br />'); blankRun = false; }
      if (!inList || listType !== currentListType) { flushList(); inList = true; listType = currentListType; }
      listItems.push(`<li class="mb-1">${formatInline(content)}</li>`);
      continue;
    }

    if (inList && trimmed) flushList();

    // Blank lines — collapse multiple into a single pending break
    if (!trimmed) {
      if (!inList) blankRun = true;
      continue;
    }

    if (blankRun) { result.push('<br />'); blankRun = false; }

    // Table-as-cards sentinel block (already pre-escaped, emit verbatim)
    if (trimmed.startsWith(TABLE_BLOCK_PREFIX) && trimmed.endsWith(TABLE_BLOCK_SUFFIX)) {
      result.push(trimmed.slice(TABLE_BLOCK_PREFIX.length, trimmed.length - TABLE_BLOCK_SUFFIX.length));
      continue;
    }

    // Regular paragraph
    result.push(`<p>${formatInline(trimmed)}</p>`);
  }

  flushList();
  if (inCodeBlock) result.push('</code></pre>');

  return result.join('\n');
}

/** Convert chapter HTML/markdown into editorial-friendly plain text with structure preserved. */
export function htmlToEditorialText(input: string): string {
  if (!input) return '';
  if (!/<[a-z][\s\S]*>/i.test(input)) return input;

  let text = input;

  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '_$2_');
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  text = text.replace(/<\/?(div|section|article|blockquote|ul|ol|li|pre|code)[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
