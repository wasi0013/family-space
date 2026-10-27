import { describe, expect, it } from 'vitest';
import { appAddress, EXPORT_ADDRESS, slug } from './capture';

describe('slug', () => {
  it.each([
    ['Alex', 'alex'],
    ['Alex Rivera', 'alex-rivera'],
    ['  Zoë  Ng! ', 'zoë-ng'],
    ['আরিফ', 'আরিফ'],
    ['!!!', 'my-sky'],
  ])('names files for %s as %s', (name, expected) => {
    expect(slug(name)).toBe(expected);
  });
});

describe('export addresses', () => {
  it('marks every frame with the book’s home', () => {
    expect(EXPORT_ADDRESS).toBe('raisingthegiftedmind.com');
  });

  it('invites viewers to make their own sky, in their language', () => {
    expect(appAddress('en')).toBe('familyspace.raisingthegiftedmind.com');
    expect(appAddress('bn')).toBe('familyspace.raisingthegiftedmind.com/bn');
  });
});
