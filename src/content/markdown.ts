/**
 * Markdown Output Generator
 *
 * Converts structured text items into markdown format by:
 * - Inferring heading levels from font size relative to the page's body text
 * - Detecting bold/italic from font style spans
 * - Detecting paragraphs from vertical spacing
 * - Detecting URLs and wrapping them as markdown links
 * - Preserving line breaks appropriately
 */

import type { StructuredLine } from './assembler.js';
import type { TextSpan } from '../types.js';

/**
 * Convert structured lines to markdown.
 */
export function toMarkdown(lines: StructuredLine[]): string {
  if (lines.length === 0) return '';

  const bodyFontSize = detectBodyFontSize(lines);
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.text.trim();
    if (!trimmed) continue;

    const headingLevel = inferHeadingLevel(line.fontSize, bodyFontSize);

    if (headingLevel > 0 && headingLevel <= 6 && isLikelyHeading(trimmed)) {
      if (result.length > 0 && result[result.length - 1] !== '') {
        result.push('');
      }
      result.push(`${'#'.repeat(headingLevel)} ${trimmed}`);
      result.push('');
    } else if (isLikelyListItem(trimmed)) {
      result.push(formatListItem(renderSpans(line.spans)));
      if (line.isBlankAfter) result.push('');
    } else {
      result.push(renderSpans(line.spans));
      if (line.isBlankAfter) result.push('');
    }
  }

  return cleanMarkdown(result.join('\n'));
}

/**
 * Render text spans with inline markdown formatting (bold, italic, links).
 */
function renderSpans(spans: TextSpan[]): string {
  if (!spans || spans.length === 0) return '';

  const allBold = spans.every(s => s.bold);
  const allItalic = spans.every(s => s.italic);
  const hasAnyFormatting = spans.some(s => s.bold || s.italic || s.link);

  if (!hasAnyFormatting) {
    return autoLinkUrls(spans.map(s => s.text).join('').trim());
  }

  let out = '';
  for (const span of spans) {
    let text = span.text;
    if (!text) continue;

    if (span.link) {
      const linkText = text.trim();
      if (linkText) {
        text = `[${linkText}](${span.link})`;
        if (span.text.startsWith(' ')) text = ' ' + text;
        if (span.text.endsWith(' ')) text = text + ' ';
      }
    }

    if (span.bold && !allBold) {
      text = wrapInline(text, '**');
    }
    if (span.italic && !allItalic) {
      text = wrapInline(text, '*');
    }

    out += text;
  }

  const trimmed = out.trim();

  if (allBold && allItalic) return `***${trimmed}***`;
  if (allBold) return `**${trimmed}**`;
  if (allItalic) return `*${trimmed}*`;

  if (!spans.some(s => s.link)) {
    return autoLinkUrls(trimmed);
  }

  return trimmed;
}

/**
 * Wrap inline text with a marker (** or *), preserving leading/trailing spaces.
 */
function wrapInline(text: string, marker: string): string {
  const leading = text.match(/^(\s*)/)?.[1] ?? '';
  const trailing = text.match(/(\s*)$/)?.[1] ?? '';
  const inner = text.trim();
  if (!inner) return text;
  return `${leading}${marker}${inner}${marker}${trailing}`;
}

/**
 * Auto-detect URLs in plain text and wrap them as markdown links.
 */
function autoLinkUrls(text: string): string {
  return text.replace(
    /https?:\/\/[^\s),\]]+/g,
    (url) => `[${url}](${url})`,
  );
}

/**
 * Detect the most common (body) font size from a set of lines.
 */
function detectBodyFontSize(lines: StructuredLine[]): number {
  const sizeCounts = new Map<number, number>();

  for (const line of lines) {
    const trimmed = line.text.trim();
    if (!trimmed) continue;

    const rounded = Math.round(line.fontSize * 2) / 2;
    const textLen = trimmed.length;
    sizeCounts.set(rounded, (sizeCounts.get(rounded) ?? 0) + textLen);
  }

  let maxCount = 0;
  let bodySize = 12;
  for (const [size, count] of sizeCounts) {
    if (count > maxCount) {
      maxCount = count;
      bodySize = size;
    }
  }

  return bodySize;
}

/**
 * Infer heading level based on font size ratio to body text.
 */
function inferHeadingLevel(fontSize: number, bodyFontSize: number): number {
  if (bodyFontSize <= 0) return 0;

  const ratio = fontSize / bodyFontSize;

  if (ratio >= 2.0) return 1;
  if (ratio >= 1.6) return 2;
  if (ratio >= 1.3) return 3;
  if (ratio >= 1.15) return 4;

  return 0;
}

/**
 * Heuristic: a line is likely a heading if it's short and doesn't end with
 * sentence-ending punctuation.
 */
function isLikelyHeading(text: string): boolean {
  if (text.length > 200) return false;
  if (text.endsWith(',') || text.endsWith(';')) return false;
  return true;
}

/**
 * Detect list items (bullet points, numbered lists).
 */
function isLikelyListItem(text: string): boolean {
  return /^[\u2022\u2023\u25E6\u2043\u2219\uF0B7•\-\*]\s/.test(text) ||
         /^\d{1,3}[.)]\s/.test(text) ||
         /^[a-z][.)]\s/i.test(text);
}

/**
 * Format a detected list item with markdown bullet syntax.
 */
function formatListItem(text: string): string {
  if (/^[\-\*]\s/.test(text)) return text;

  if (/^[\u2022\u2023\u25E6\u2043\u2219\uF0B7•]\s/.test(text)) {
    return `- ${text.substring(2)}`;
  }

  if (/^\d{1,3}\.\s/.test(text)) return text;

  const numberedMatch = text.match(/^(\d{1,3})\)\s(.*)/);
  if (numberedMatch) {
    return `${numberedMatch[1]}. ${numberedMatch[2]}`;
  }

  return text;
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +\n/g, '\n')
    .trim();
}
