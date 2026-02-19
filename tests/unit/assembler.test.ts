import { describe, it, expect } from 'vitest';
import {
  shouldInsertSpace,
  assembleText,
  sortTextItems,
  assembleStructuredItems,
  stripFormPlaceholderText,
  isFormPlaceholderItem,
  normalizePUA,
} from '../../src/content/assembler.js';
import type { TextItem } from '../../src/types.js';

function makeItem(
  overrides: Partial<TextItem> & { text: string; x: number; y: number }
): TextItem {
  return {
    text: overrides.text,
    x: overrides.x,
    y: overrides.y,
    fontSize: overrides.fontSize ?? 12,
    fontName: overrides.fontName ?? 'Helvetica',
    width: overrides.width ?? 0,
    ...overrides,
  };
}

describe('assembler', () => {
  describe('assembleText', () => {
    it('sorts items by Y descending, X ascending (items at y=100 come before y=50; two items on same line by x order)', () => {
      const items: TextItem[] = [
        makeItem({ text: 'B', x: 20, y: 93, width: 8 }),
        makeItem({ text: 'A', x: 0, y: 100, width: 8 }),
        makeItem({ text: 'C', x: 9, y: 100, width: 8 }),
      ];
      const result = assembleText(items);
      // y=100 items first (A, C in x order; xGap 1 < 1.8 so no space), then y=93 (B, gap 7 triggers newline but not paragraph)
      expect(result).toBe('AC\nB');
    });

    it('inserts spaces for X-gaps > 15% of fontSize (items on same y, second item has gap > fontSize*0.15 with metric width)', () => {
      const items: TextItem[] = [
        makeItem({ text: 'Hello', x: 0, y: 100, fontSize: 12, width: 30 }),
        makeItem({ text: 'World', x: 40, y: 100, fontSize: 12, width: 25 }),
      ];
      // xGap = 40 - (0 + 30) = 10. 10 > 12*0.15 = 1.8 → insert space
      const result = assembleText(items);
      expect(result).toBe('Hello World');
    });

    it('inserts newlines for Y-gaps > 50% of fontSize', () => {
      const items: TextItem[] = [
        makeItem({ text: 'Line1', x: 0, y: 100, fontSize: 12 }),
        makeItem({ text: 'Line2', x: 0, y: 93, fontSize: 12 }),
      ];
      // yDelta = 7 > 12*0.5 = 6 → new line; 7 < 12*1.8 = 21.6 → no paragraph break
      const result = assembleText(items);
      expect(result).toBe('Line1\nLine2');
    });

    it('inserts blank lines for paragraph breaks (Y-gap > 1.8x fontSize)', () => {
      const items: TextItem[] = [
        makeItem({ text: 'Para1', x: 0, y: 100, fontSize: 12 }),
        makeItem({ text: 'Para2', x: 0, y: 76, fontSize: 12 }),
      ];
      // yDelta = 24 > 12*1.8 = 21.6 → paragraph break (blank line)
      const result = assembleText(items);
      expect(result).toBe('Para1\n\nPara2');
    });
  });

  describe('shouldInsertSpace', () => {
    it('returns true for large xGap with metric width (xGap=5, fontSize=12, hasMetricWidth=true)', () => {
      // 5 > 12*0.15 = 1.8 → true
      expect(shouldInsertSpace(5, 0, 1, 12, true)).toBe(true);
    });

    it('uses position-based fallback without metric width (xGap=0, posGap=20, textLen=1, fontSize=12)', () => {
      // posGap 20 > estimatedRunWidth = 1*12*0.5 = 6 → true
      expect(shouldInsertSpace(0, 20, 1, 12, false)).toBe(true);
    });
  });

  describe('assembleStructuredItems', () => {
    it('produces spans with bold/italic from font name (Helvetica-Bold for bold, Helvetica-Oblique for italic)', () => {
      const items: TextItem[] = [
        makeItem({ text: 'bold', x: 0, y: 100, fontName: 'Helvetica-Bold' }),
        makeItem({ text: 'italic', x: 50, y: 100, fontName: 'Helvetica-Oblique' }),
      ];
      const result = assembleStructuredItems(items);
      expect(result).toHaveLength(1);
      expect(result[0].spans).toHaveLength(2);
      expect(result[0].spans[0]).toMatchObject({ text: 'bold ', bold: true, italic: false });
      expect(result[0].spans[1]).toMatchObject({ text: 'italic', bold: false, italic: true });
    });

    it('merges adjacent spans with same style', () => {
      const items: TextItem[] = [
        makeItem({ text: 'Hello', x: 0, y: 100, fontName: 'Helvetica', width: 30 }),
        makeItem({ text: 'World', x: 40, y: 100, fontName: 'Helvetica', width: 25 }),
      ];
      const result = assembleStructuredItems(items);
      expect(result).toHaveLength(1);
      expect(result[0].spans).toHaveLength(1);
      expect(result[0].spans[0].text).toBe('Hello World');
      expect(result[0].spans[0]).toMatchObject({ bold: false, italic: false });
    });
  });

  describe('stripFormPlaceholderText', () => {
    it('strips self-closing form anchors (\\signature1\\)', () => {
      expect(stripFormPlaceholderText('Hello \\signature1\\ World')).toBe('Hello  World');
    });

    it('strips open form anchors with digits (\\namehere1)', () => {
      expect(stripFormPlaceholderText('\\namehere1 John Doe')).toBe(' John Doe');
    });

    it('does not greedily consume digits from real content after anchor', () => {
      // \date1 followed by 4/1/2025 -- the "4" must NOT be eaten
      expect(stripFormPlaceholderText('\\date14/1/2025')).toBe('\\date14/1/2025');
      // With space separator, the anchor is cleanly stripped
      expect(stripFormPlaceholderText('\\date1 4/1/2025')).toBe(' 4/1/2025');
    });

    it('strips trailing backslash artifacts from DocuSign fields', () => {
      expect(stripFormPlaceholderText('Christian Rivera\\')).toBe('Christian Rivera');
      expect(stripFormPlaceholderText('mohit@incident.io\\')).toBe('mohit@incident.io');
      expect(stripFormPlaceholderText('Rivera\\ next line')).toBe('Rivera next line');
    });

    it('strips orphaned closing delimiters (consumes preceding space)', () => {
      expect(stripFormPlaceholderText('value \\ ')).toBe('value ');
    });

    it('preserves backslashes that are not anchors or trailing artifacts', () => {
      // Backslash followed by digits (not an anchor pattern)
      expect(stripFormPlaceholderText('line1\\2 data')).toBe('line1\\2 data');
    });

    it('strips underscore-style anchors (\\IIO_Finance_Contact_Name_1\\)', () => {
      expect(stripFormPlaceholderText('\\IIO_Finance_Contact_Name_1\\ Peter')).toBe(' Peter');
    });

  });

  describe('normalizePUA', () => {
    it('maps SymbolMT bullet U+F0B7 to standard bullet U+2022', () => {
      expect(normalizePUA('\uF0B7')).toBe('\u2022');
    });

    it('maps multiple known PUA codepoints', () => {
      expect(normalizePUA('\uF0A7')).toBe('\u00A7'); // section sign
      expect(normalizePUA('\uF0B0')).toBe('\u00B0'); // degree sign
      expect(normalizePUA('\uF0B7')).toBe('\u2022'); // bullet
    });

    it('strips unknown PUA characters', () => {
      expect(normalizePUA('before\uE001after')).toBe('beforeafter');
    });

    it('passes through normal text unchanged', () => {
      expect(normalizePUA('Hello World 123!')).toBe('Hello World 123!');
    });

    it('handles mixed PUA and normal text', () => {
      expect(normalizePUA('\uF0B7 $18,346 in respect of')).toBe('\u2022 $18,346 in respect of');
    });
  });

  describe('assembleText PUA normalization', () => {
    it('normalizes SymbolMT bullet into standard bullet in output', () => {
      const items: TextItem[] = [
        makeItem({ text: '\uF0B7', x: 10, y: 100, fontName: 'SymbolMT', width: 5 }),
        makeItem({ text: ' $18,346', x: 16, y: 100, fontName: 'Helvetica', width: 40 }),
      ];
      const result = assembleText(items);
      expect(result).toContain('\u2022');
      expect(result).not.toContain('\uF0B7');
    });

    it('strips unknown PUA characters from text output', () => {
      const items: TextItem[] = [
        makeItem({ text: 'Hello\uE123World', x: 0, y: 100, width: 50 }),
      ];
      const result = assembleText(items);
      expect(result).toBe('HelloWorld');
    });
  });

  describe('assembleStructuredItems PUA normalization', () => {
    it('normalizes PUA in structured spans', () => {
      const items: TextItem[] = [
        makeItem({ text: '\uF0B7', x: 10, y: 100, fontName: 'SymbolMT', width: 5 }),
        makeItem({ text: ' item text', x: 16, y: 100, fontName: 'Helvetica', width: 40 }),
      ];
      const result = assembleStructuredItems(items);
      expect(result).toHaveLength(1);
      expect(result[0].text).toContain('\u2022');
      expect(result[0].text).not.toContain('\uF0B7');
    });
  });

  describe('isFormPlaceholderItem', () => {
    it('identifies self-closing form anchors', () => {
      expect(isFormPlaceholderItem('\\signature1\\')).toBe(true);
      expect(isFormPlaceholderItem('\\namehere1\\')).toBe(true);
      expect(isFormPlaceholderItem('\\IIO_Finance_Contact_Name_1\\')).toBe(true);
    });

    it('identifies open form anchors', () => {
      expect(isFormPlaceholderItem('\\date1')).toBe(true);
      expect(isFormPlaceholderItem('\\titlehere2')).toBe(true);
    });

    it('rejects normal text', () => {
      expect(isFormPlaceholderItem('Hello World')).toBe(false);
      expect(isFormPlaceholderItem('4/1/2025')).toBe(false);
      expect(isFormPlaceholderItem('$25.50')).toBe(false);
    });

    it('rejects text with backslash in middle', () => {
      expect(isFormPlaceholderItem('path\\to')).toBe(false);
    });
  });

  describe('column-aware text flow', () => {
    it('reorders side-by-side signature blocks column-first', () => {
      const w = 60;
      const items: TextItem[] = [
        makeItem({ text: 'Name:', x: 50, y: 700, width: w }),
        makeItem({ text: 'Andrew Foley', x: 120, y: 700, width: w }),
        makeItem({ text: 'Name:', x: 350, y: 700, width: w }),
        makeItem({ text: 'Chris Smith', x: 420, y: 700, width: w }),

        makeItem({ text: 'Title:', x: 50, y: 685, width: w }),
        makeItem({ text: 'GM', x: 120, y: 685, width: w }),
        makeItem({ text: 'Title:', x: 350, y: 685, width: w }),
        makeItem({ text: 'Director', x: 420, y: 685, width: w }),

        makeItem({ text: 'Date:', x: 50, y: 670, width: w }),
        makeItem({ text: '11/27/2023', x: 120, y: 670, width: w }),
        makeItem({ text: 'Date:', x: 350, y: 670, width: w }),
        makeItem({ text: '11/27/2023', x: 420, y: 670, width: w }),
      ];

      const result = assembleText(items, { stripFormPlaceholders: false });
      const lines = result.split('\n').filter(l => l.trim());

      expect(lines[0]).toContain('Andrew Foley');
      expect(lines[0]).not.toContain('Chris Smith');
      expect(lines[1]).toContain('GM');
      expect(lines[1]).not.toContain('Director');
      expect(lines[2]).toContain('11/27/2023');

      expect(lines[3]).toContain('Chris Smith');
      expect(lines[4]).toContain('Director');
      expect(lines[5]).toContain('11/27/2023');
    });

    it('preserves normal single-column text as row-first', () => {
      const items: TextItem[] = [
        makeItem({ text: 'Line one', x: 50, y: 700, width: 80 }),
        makeItem({ text: 'Line two', x: 50, y: 685, width: 80 }),
        makeItem({ text: 'Line three', x: 50, y: 670, width: 80 }),
      ];

      const result = assembleText(items, { stripFormPlaceholders: false });
      expect(result).toBe('Line one\nLine two\nLine three');
    });

    it('does not trigger column detection for only 2 lines with gaps', () => {
      const w = 60;
      const items: TextItem[] = [
        makeItem({ text: 'Left1', x: 50, y: 700, width: w }),
        makeItem({ text: 'Right1', x: 350, y: 700, width: w }),
        makeItem({ text: 'Left2', x: 50, y: 685, width: w }),
        makeItem({ text: 'Right2', x: 350, y: 685, width: w }),
      ];

      const result = assembleText(items, { stripFormPlaceholders: false });
      const lines = result.split('\n').filter(l => l.trim());
      expect(lines[0]).toContain('Left1');
      expect(lines[0]).toContain('Right1');
    });

    it('handles mixed single-column and multi-column regions', () => {
      const w = 60;
      const items: TextItem[] = [
        makeItem({ text: 'Header text here', x: 50, y: 750, width: 200 }),

        makeItem({ text: 'ColA-1', x: 50, y: 700, width: w }),
        makeItem({ text: 'ColB-1', x: 350, y: 700, width: w }),
        makeItem({ text: 'ColA-2', x: 50, y: 685, width: w }),
        makeItem({ text: 'ColB-2', x: 350, y: 685, width: w }),
        makeItem({ text: 'ColA-3', x: 50, y: 670, width: w }),
        makeItem({ text: 'ColB-3', x: 350, y: 670, width: w }),

        makeItem({ text: 'Footer text here', x: 50, y: 620, width: 200 }),
      ];

      const result = assembleText(items, { stripFormPlaceholders: false });
      const lines = result.split('\n').filter(l => l.trim());

      expect(lines[0]).toBe('Header text here');

      const colAIdx = lines.findIndex(l => l.includes('ColA-1'));
      const colBIdx = lines.findIndex(l => l.includes('ColB-1'));
      expect(colAIdx).toBeLessThan(colBIdx);

      const footerIdx = lines.findIndex(l => l.includes('Footer'));
      expect(footerIdx).toBe(lines.length - 1);
    });

    it('sortTextItems returns column-first order for multi-column items', () => {
      const w = 60;
      const items: TextItem[] = [
        makeItem({ text: 'L1', x: 50, y: 700, width: w }),
        makeItem({ text: 'R1', x: 350, y: 700, width: w }),
        makeItem({ text: 'L2', x: 50, y: 685, width: w }),
        makeItem({ text: 'R2', x: 350, y: 685, width: w }),
        makeItem({ text: 'L3', x: 50, y: 670, width: w }),
        makeItem({ text: 'R3', x: 350, y: 670, width: w }),
      ];

      const sorted = sortTextItems(items);
      const texts = sorted.map(i => i.text);

      expect(texts.indexOf('L1')).toBeLessThan(texts.indexOf('L2'));
      expect(texts.indexOf('L2')).toBeLessThan(texts.indexOf('L3'));
      expect(texts.indexOf('L3')).toBeLessThan(texts.indexOf('R1'));
      expect(texts.indexOf('R1')).toBeLessThan(texts.indexOf('R2'));
      expect(texts.indexOf('R2')).toBeLessThan(texts.indexOf('R3'));
    });

    it('bridges gap-less lines in a form grid (single-column rows between gap rows)', () => {
      const w = 60;
      const items: TextItem[] = [
        // Row 1: both columns (gap detected)
        makeItem({ text: 'Email:', x: 50, y: 700, width: w }),
        makeItem({ text: 'user@example.c', x: 120, y: 700, width: w }),
        makeItem({ text: 'Billing City', x: 350, y: 700, width: w }),
        makeItem({ text: 'London', x: 450, y: 700, width: w }),

        // Row 2: left only (email wraps -- "om" fragment)
        makeItem({ text: 'om', x: 120, y: 685, width: 15 }),

        // Row 3: right only
        makeItem({ text: 'Billing State', x: 350, y: 670, width: w }),
        makeItem({ text: 'England', x: 450, y: 670, width: w }),

        // Row 4: both columns (gap detected)
        makeItem({ text: 'Phone:', x: 50, y: 655, width: w }),
        makeItem({ text: '555-1234', x: 120, y: 655, width: w }),
        makeItem({ text: 'Zip Code', x: 350, y: 655, width: w }),
        makeItem({ text: 'EC4M', x: 450, y: 655, width: w }),

        // Row 5: both columns (gap detected)
        makeItem({ text: 'Fax:', x: 50, y: 640, width: w }),
        makeItem({ text: '555-5678', x: 120, y: 640, width: w }),
        makeItem({ text: 'Country', x: 350, y: 640, width: w }),
        makeItem({ text: 'UK', x: 450, y: 640, width: w }),
      ];

      const result = assembleText(items, { stripFormPlaceholders: false });
      const lines = result.split('\n').filter(l => l.trim());

      // "om" should stay with left-column content, near the email
      const emailIdx = lines.findIndex(l => l.includes('user@example'));
      const omIdx = lines.findIndex(l => l.includes('om') && !l.includes('example'));
      const billingStateIdx = lines.findIndex(l => l.includes('Billing State'));

      expect(omIdx).toBe(emailIdx + 1);
      expect(omIdx).toBeLessThan(billingStateIdx);
    });

    it('extends column region backward to absorb header lines', () => {
      const w = 60;
      const items: TextItem[] = [
        // Header line: 2 company names side by side (gap, but only 1 line)
        makeItem({ text: 'Vanta', x: 50, y: 730, width: 40 }),
        makeItem({ text: 'Accelerant Ltd', x: 350, y: 730, width: w }),

        // By: line (gap, but still only 2 cumulative lines)
        makeItem({ text: 'By:', x: 50, y: 715, width: 20 }),
        makeItem({ text: 'By:', x: 350, y: 715, width: 20 }),

        // 3 lines with gaps → triggers column detection
        makeItem({ text: 'Name:', x: 50, y: 700, width: w }),
        makeItem({ text: 'Andrew', x: 120, y: 700, width: w }),
        makeItem({ text: 'Name:', x: 350, y: 700, width: w }),
        makeItem({ text: 'Chris', x: 420, y: 700, width: w }),

        makeItem({ text: 'Title:', x: 50, y: 685, width: w }),
        makeItem({ text: 'GM', x: 120, y: 685, width: w }),
        makeItem({ text: 'Title:', x: 350, y: 685, width: w }),
        makeItem({ text: 'Director', x: 420, y: 685, width: w }),

        makeItem({ text: 'Date:', x: 50, y: 670, width: w }),
        makeItem({ text: '11/27/2023', x: 120, y: 670, width: w }),
        makeItem({ text: 'Date:', x: 350, y: 670, width: w }),
        makeItem({ text: '11/27/2023', x: 420, y: 670, width: w }),
      ];

      const result = assembleText(items, { stripFormPlaceholders: false });
      const lines = result.split('\n').filter(l => l.trim());

      // "Vanta" should be separated from "Accelerant Ltd"
      const vantaLine = lines.find(l => l.includes('Vanta'));
      expect(vantaLine).not.toContain('Accelerant');

      // "Vanta" block should come before "Accelerant" block
      const vantaIdx = lines.findIndex(l => l.includes('Vanta'));
      const accelIdx = lines.findIndex(l => l.includes('Accelerant'));
      expect(vantaIdx).toBeLessThan(accelIdx);
    });
  });
});
