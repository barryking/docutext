/**
 * Custom error types for docutext.
 * Provides structured errors for PDF parsing failures and unsupported features.
 */

export class DocuTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocuTextError';
  }
}

export class PdfParseError extends DocuTextError {
  constructor(message: string, public readonly offset?: number) {
    super(message);
    this.name = 'PdfParseError';
  }
}

export class PdfUnsupportedError extends DocuTextError {
  constructor(message: string) {
    super(message);
    this.name = 'PdfUnsupportedError';
  }
}
