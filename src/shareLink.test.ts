import { describe, expect, it, vi } from 'vitest';
import { exampleSky } from './example';
import { packSky, SHARE_LINK_MAX_CHARS, SHARE_PATH, shareLink, unpackSky } from './shareLink';
import { MAX_MOMENTS, MAX_PEOPLE, PROFILE_NAME_MAX_LENGTH, readSkyFile, SKY_FILE_MAX_BYTES, toSkyFile } from './skyFile';
import { MOMENT_TITLE_MAX_LENGTH } from './moments';
import { MEMORY_MAX_LENGTH, PERSON_NAME_MAX_LENGTH } from './people';

/** Deflates raw bytes the way a link would carry them, to build hostile links by hand. */
async function deflated(bytes: Uint8Array): Promise<string> {
  const packed = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
  return Buffer.from(packed).toString('base64url');
}
const problemOf = async (fragment: string) => {
  const result = await unpackSky(fragment);
  return 'problem' in result ? result.problem : null;
};

describe('a shared link', () => {
  it.each(['en', 'bn'] as const)('carries the whole example life in %s', async (lang) => {
    const example = exampleSky(lang);
    const result = await unpackSky(await packSky(toSkyFile(example)));
    expect(result).toEqual({ sky: example });
  });

  it.each(['en', 'bn'] as const)('stays short enough to pass along in %s', async (lang) => {
    const example = exampleSky(lang);
    expect((await packSky(toSkyFile(example))).length).toBeLessThan(2600);
    expect((await packSky(toSkyFile(example, false))).length).toBeLessThan(1300);
  });

  it('carries the largest sky the checks allow, written out in full in Bengali', async () => {
    let seed = 7;
    // Letters picked at random, which pack far worse than real words do.
    const text = (n: number) =>
      Array.from({ length: n }, () => String.fromCharCode(0x995 + ((seed = (seed * 48271) % 2147483647) % 40))).join('');
    const largest = {
      profile: { name: text(PROFILE_NAME_MAX_LENGTH), age: 120 },
      people: Array.from({ length: MAX_PEOPLE }, (_, i) => ({
        id: crypto.randomUUID(),
        name: text(PERSON_NAME_MAX_LENGTH),
        bond: 'permanent' as const,
        joinAge: 0,
        departAge: 100 + (i % 20),
        color: '#ff8a7a',
        memory: text(MEMORY_MAX_LENGTH),
      })),
      moments: Array.from({ length: MAX_MOMENTS }, (_, i) => ({
        id: crypto.randomUUID(),
        title: text(MOMENT_TITLE_MAX_LENGTH),
        age: i,
        kind: 'love' as const,
        note: text(MEMORY_MAX_LENGTH),
      })),
    };
    const json = JSON.stringify(toSkyFile(largest));
    expect(new TextEncoder().encode(json).length).toBeLessThan(SKY_FILE_MAX_BYTES);
    expect(readSkyFile(json)).toEqual({ sky: largest });
    const packed = await packSky(toSkyFile(largest));
    expect(packed.length).toBeLessThan(SHARE_LINK_MAX_CHARS);
    expect(await unpackSky(packed)).toEqual({ sky: largest });
  });

  it('opens on this site, in this language, with the sky after the #', async () => {
    const link = await shareLink(toSkyFile(exampleSky('bn')), 'https://familyspace.example/bn/');
    const url = new URL(link);
    expect(url.pathname).toBe('/bn/s');
    expect(SHARE_PATH.test(url.pathname)).toBe(true);
    expect(url.search).toBe('');
    expect(url.hash).toMatch(/^#[A-Za-z0-9_-]+$/);
  });

  it('matches only the share pages', () => {
    expect(['/s', '/s/', '/bn/s'].every((p) => SHARE_PATH.test(p))).toBe(true);
    expect(['/', '/sky', '/x/s', '/bn/example', '/s/x'].some((p) => SHARE_PATH.test(p))).toBe(false);
  });
});

describe('opening a link from someone else', () => {
  it('refuses a link that would unpack into far more than any sky', async () => {
    // About 40 MB of nothing, packed into a link a few dozen kilobytes long.
    const bomb = await deflated(new Uint8Array(40 * 1024 * 1024).fill(32));
    expect(bomb.length).toBeLessThan(SHARE_LINK_MAX_CHARS);
    expect(await problemOf(bomb)).toBe('tooLarge');
  });

  it('refuses a link too long to be real without unpacking it', async () => {
    expect(await problemOf('A'.repeat(SHARE_LINK_MAX_CHARS + 1))).toBe('tooLarge');
  });

  it.each(['', '#', 'abc def', 'abc+/=', '<script>', 'A', 'AAAAAAAA', 'eyJ0b2tlbiI6MX0'])(
    'refuses a damaged link %o',
    async (fragment) => expect(await problemOf(fragment)).toBe('damaged'),
  );

  it('refuses a link cut short on its way', async () => {
    const whole = await packSky(toSkyFile(exampleSky('en')));
    expect(await problemOf(whole.slice(0, whole.length / 2))).toBe('damaged');
  });

  it('refuses a link whose text is not UTF-8', async () => {
    expect(await problemOf(await deflated(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])))).toBe('damaged');
  });

  it('says when the browser is too old to unpack a link, rather than blaming the link', async () => {
    const packed = await packSky(toSkyFile(exampleSky('en')));
    vi.stubGlobal('DecompressionStream', undefined);
    try {
      expect(await problemOf(packed)).toBe('oldBrowser');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reads what a link carries through the same checks as a file', async () => {
    const forged = { ...toSkyFile(exampleSky('en')), profile: { name: 'Alex', age: 500 } };
    expect(await problemOf(await deflated(new TextEncoder().encode(JSON.stringify(forged))))).toBe('damaged');
    expect(await problemOf(await deflated(new TextEncoder().encode('{"hello":1}')))).toBe('notSky');
  });
});
