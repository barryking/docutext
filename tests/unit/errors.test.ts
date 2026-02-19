import { describe, it, expect } from 'vitest';
import {
  DocuTextError,
  PdfParseError,
  PdfUnsupportedError,
} from '../../src/errors.js';
import { DocuText } from '../../src/index.js';

describe('DocuTextError', () => {
  it('PdfParseError is instanceof DocuTextError and Error', () => {
    const err = new PdfParseError('test');
    expect(err).toBeInstanceOf(DocuTextError);
    expect(err).toBeInstanceOf(Error);
  });

  it('PdfUnsupportedError is instanceof DocuTextError and Error', () => {
    const err = new PdfUnsupportedError('test');
    expect(err).toBeInstanceOf(DocuTextError);
    expect(err).toBeInstanceOf(Error);
  });

  it('PdfParseError.offset stores the byte offset', () => {
    const err = new PdfParseError('parse failed', 42);
    expect(err.offset).toBe(42);
  });

  it('PdfParseError.offset is undefined when not provided', () => {
    const err = new PdfParseError('parse failed');
    expect(err.offset).toBeUndefined();
  });

  it('error.name is correct for DocuTextError', () => {
    const err = new DocuTextError('test');
    expect(err.name).toBe('DocuTextError');
  });

  it('error.name is correct for PdfParseError', () => {
    const err = new PdfParseError('test');
    expect(err.name).toBe('PdfParseError');
  });

  it('error.name is correct for PdfUnsupportedError', () => {
    const err = new PdfUnsupportedError('test');
    expect(err.name).toBe('PdfUnsupportedError');
  });
});

describe('invalid PDF loading', () => {
  it('loading garbage bytes throws PdfParseError', () => {
    expect(() => DocuText.fromBuffer(new Uint8Array([1, 2, 3]))).toThrow(
      PdfParseError,
    );
  });

  it('loading truncated PDF (just %PDF-1.4) throws PdfParseError', () => {
    const truncated = new TextEncoder().encode('%PDF-1.4');
    expect(() => DocuText.fromBuffer(truncated)).toThrow(PdfParseError);
  });
});
