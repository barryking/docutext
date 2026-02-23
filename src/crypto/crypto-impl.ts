/**
 * Injectable crypto primitives for the security handler.
 * Node entry registers implementations from node:crypto.
 * Browser entry leaves them unset (encrypted PDFs unsupported in browser).
 */

type HashFn = (data: Uint8Array) => Uint8Array;
type AesCbcFn = (key: Uint8Array, iv: Uint8Array, data: Uint8Array) => Uint8Array;

let _md5: HashFn | null = null;
let _sha256: HashFn | null = null;
let _sha384: HashFn | null = null;
let _sha512: HashFn | null = null;
let _aesCbcDecrypt: AesCbcFn | null = null;
let _aesCbcDecryptNoPad: AesCbcFn | null = null;
let _aesCbcEncryptNoPad: AesCbcFn | null = null;

export interface V5CryptoImpl {
  sha256: HashFn;
  sha384: HashFn;
  sha512: HashFn;
  aesCbcDecryptNoPad: AesCbcFn;
  aesCbcEncryptNoPad: AesCbcFn;
}

export function setCryptoImpl(
  md5: HashFn,
  aesCbcDecrypt: AesCbcFn,
  v5?: V5CryptoImpl,
): void {
  _md5 = md5;
  _aesCbcDecrypt = aesCbcDecrypt;
  if (v5) {
    _sha256 = v5.sha256;
    _sha384 = v5.sha384;
    _sha512 = v5.sha512;
    _aesCbcDecryptNoPad = v5.aesCbcDecryptNoPad;
    _aesCbcEncryptNoPad = v5.aesCbcEncryptNoPad;
  }
}

export function hasCryptoImpl(): boolean {
  return _md5 !== null && _aesCbcDecrypt !== null;
}

export function hasV5Crypto(): boolean {
  return _sha256 !== null && _aesCbcDecryptNoPad !== null && _aesCbcEncryptNoPad !== null;
}

export function md5(data: Uint8Array): Uint8Array {
  if (!_md5) throw new Error('No crypto implementation configured');
  return _md5(data);
}

export function sha256(data: Uint8Array): Uint8Array {
  if (!_sha256) throw new Error('No SHA-256 implementation configured');
  return _sha256(data);
}

export function sha384(data: Uint8Array): Uint8Array {
  if (!_sha384) throw new Error('No SHA-384 implementation configured');
  return _sha384(data);
}

export function sha512(data: Uint8Array): Uint8Array {
  if (!_sha512) throw new Error('No SHA-512 implementation configured');
  return _sha512(data);
}

export function aesCbcDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
  if (!_aesCbcDecrypt) throw new Error('No crypto implementation configured');
  return _aesCbcDecrypt(key, iv, data);
}

export function aesCbcDecryptNoPad(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
  if (!_aesCbcDecryptNoPad) throw new Error('No crypto implementation configured');
  return _aesCbcDecryptNoPad(key, iv, data);
}

export function aesCbcEncryptNoPad(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
  if (!_aesCbcEncryptNoPad) throw new Error('No crypto implementation configured');
  return _aesCbcEncryptNoPad(key, iv, data);
}
