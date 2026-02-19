/**
 * docutext/markdown - Opt-in markdown output for docutext.
 *
 * This subpath entry provides markdown conversion functions.
 * Import from 'docutext/markdown' to include markdown support;
 * consumers who only need plain text can import from 'docutext'
 * and the markdown code will be tree-shaken away.
 *
 * @example
 * ```typescript
 * import { DocuText } from 'docutext';
 * import { docToMarkdown, pageToMarkdown } from 'docutext/markdown';
 *
 * const doc = await DocuText.load('file.pdf');
 * console.log(docToMarkdown(doc));
 * console.log(pageToMarkdown(doc.pages[0]));
 * ```
 */

import type { DocuText } from './document.js';
import { type PDFPage, PAGE_INTERNALS } from './page.js';
import { assembleStructuredItems, stripFormPlaceholderText } from './content/assembler.js';
import { toMarkdown } from './content/markdown.js';
import { extractLinks } from './content/links.js';
export type { TextSpan } from './types.js';
export type { StructuredLine } from './content/assembler.js';

/**
 * Convert a single page to markdown.
 */
export function pageToMarkdown(page: PDFPage): string {
  const internals = page[PAGE_INTERNALS];
  if (!internals.pageDict || !internals.parser) return '';
  const links = extractLinks(internals.pageDict, internals.parser);
  const shouldStrip = internals.assemblyOptions?.stripFormPlaceholders ?? true;

  const structured = assembleStructuredItems(page.textItems, links, internals.assemblyOptions);
  let md = toMarkdown(structured);
  if (shouldStrip) {
    md = stripFormPlaceholderText(md);
  }
  return md;
}

/**
 * Convert an entire document to markdown.
 * @param separator - String used between pages (default: '\n\n')
 */
export function docToMarkdown(doc: DocuText, separator = '\n\n'): string {
  const parts: string[] = [];
  for (const page of doc.pages) {
    const md = pageToMarkdown(page);
    if (md.length > 0) {
      parts.push(md);
    }
  }
  return parts.join(separator);
}
