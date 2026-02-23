/**
 * docutext - Zero-dependency TypeScript PDF text extraction for RAG and AI pipelines
 *
 * @example
 * ```typescript
 * import { DocuText } from 'docutext';
 *
 * const doc = await DocuText.load('document.pdf');
 *
 * // Full text
 * console.log(doc.text);
 *
 * // Page by page
 * for (const page of doc) {
 *   console.log(`Page ${page.number}: ${page.text}`);
 * }
 * ```
 */

import { inflateSync } from 'node:zlib';
import { createHash, createDecipheriv, createCipheriv } from 'node:crypto';
import { setInflate } from './stream/inflate.js';
import { setCryptoImpl } from './crypto/crypto-impl.js';

function nodeInflate(data: Uint8Array): Uint8Array {
  try {
    return new Uint8Array(inflateSync(data));
  } catch {
    return new Uint8Array(inflateSync(data, { finishFlush: 0 }));
  }
}

setInflate(nodeInflate);

function aesCbcAlgo(key: Uint8Array): string {
  return key.length === 32 ? 'aes-256-cbc' : 'aes-128-cbc';
}

setCryptoImpl(
  (data) => new Uint8Array(createHash('md5').update(data).digest()),
  (key, iv, data) => {
    const decipher = createDecipheriv(aesCbcAlgo(key), key, iv);
    decipher.setAutoPadding(true);
    const a = decipher.update(data);
    const b = decipher.final();
    const result = new Uint8Array(a.length + b.length);
    result.set(new Uint8Array(a.buffer, a.byteOffset, a.length));
    result.set(new Uint8Array(b.buffer, b.byteOffset, b.length), a.length);
    return result;
  },
  {
    sha256: (data) => new Uint8Array(createHash('sha256').update(data).digest()),
    sha384: (data) => new Uint8Array(createHash('sha384').update(data).digest()),
    sha512: (data) => new Uint8Array(createHash('sha512').update(data).digest()),
    aesCbcDecryptNoPad: (key, iv, data) => {
      const d = createDecipheriv(aesCbcAlgo(key), key, iv);
      d.setAutoPadding(false);
      const r = d.update(data);
      d.final();
      return new Uint8Array(r.buffer, r.byteOffset, r.length);
    },
    aesCbcEncryptNoPad: (key, iv, data) => {
      const c = createCipheriv(aesCbcAlgo(key), key, iv);
      c.setAutoPadding(false);
      const r = c.update(data);
      c.final();
      return new Uint8Array(r.buffer, r.byteOffset, r.length);
    },
  },
);

export { DocuText } from './document.js';
export { PDFPage } from './page.js';
export { DocuTextError, PdfParseError, PdfUnsupportedError } from './errors.js';
export type {
  DocumentMetadata,
  TextItem,
  LoadOptions,
  PageData,
  DocumentData,
} from './types.js';
