import { describe, expect, it } from 'vitest';
import { exportAddress, slug } from './capture';

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

describe('exportAddress', () => {
  it('leads English viewers to the app and Bengali viewers to its Bengali page', () => {
    expect(exportAddress('en')).toBe('familyspace.raisingthegiftedmind.com');
    expect(exportAddress('bn')).toBe('familyspace.raisingthegiftedmind.com/bn');
  });
});
