/**
 * A sky carried inside a link. The sky file is compressed with the browser's own deflate and
 * written after the `#`, which browsers never send to any server, so a shared sky travels only
 * between the people who pass the link along. Opening a link reads it through the same strict
 * checks as a file.
 */
import { readSkyFile, SKY_FILE_MAX_BYTES, type SkyFile, type SkyFileResult } from './skyFile';

/** Where shared skies open, under the language's home: `/s` or `/bn/s`. */
export const SHARE_PATH = /^(\/bn)?\/s\/?$/;
/**
 * Longer than any sky's link, and refused unread past it. The largest sky the checks allow, every
 * name and memory written out in full in Bengali, packs into about 72,000 characters.
 */
export const SHARE_LINK_MAX_CHARS = 128 * 1024;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** The link that opens this sky, on this site and in this language. */
export async function shareLink(file: SkyFile, home: string): Promise<string> {
  return `${home}s#${await packSky(file)}`;
}

export async function packSky(file: SkyFile): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(file));
  const packed = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
  return toBase64Url(new Uint8Array(packed));
}

/** Opens what follows the `#` of a shared link. Never throws; anything doubtful is refused whole. */
export async function unpackSky(fragment: string): Promise<SkyFileResult> {
  const packed = fragment.replace(/^#/, '');
  if (packed.length > SHARE_LINK_MAX_CHARS) return { problem: 'tooLarge' };
  if (!BASE64URL.test(packed)) return { problem: 'damaged' };
  if (typeof DecompressionStream === 'undefined') return { problem: 'oldBrowser' };
  try {
    const bytes = await inflate(fromBase64Url(packed));
    if (!bytes) return { problem: 'tooLarge' };
    return readSkyFile(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    // Not deflate, cut short, or not UTF-8: a link that was damaged on its way here.
    return { problem: 'damaged' };
  }
}

/**
 * Inflates at most a sky file's worth of bytes, or returns null. A few characters of link can
 * unpack into gigabytes, so it stops reading the moment the output grows past that size.
 */
async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > SKY_FILE_MAX_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
