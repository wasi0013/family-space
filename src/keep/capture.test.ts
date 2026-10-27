import { describe, expect, it } from 'vitest';
import { slug } from './capture';

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
