import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock } from '../../tests/setup';
import { faviconUrl, firstLetter, colorFromString } from './favicon';

beforeEach(() => { installChromeMock(); });

describe('favicon utils', () => {
  it('faviconUrl builds chrome _favicon url', () => {
    const u = faviconUrl('https://github.com', 32);
    expect(u).toContain('/_favicon/');
    expect(u).toContain('pageUrl=https%3A%2F%2Fgithub.com');
    expect(u).toContain('size=32');
  });
  it('firstLetter returns uppercase first char of host', () => {
    expect(firstLetter('https://github.com')).toBe('G');
    expect(firstLetter('not a url')).toBe('N');
  });
  it('colorFromString is deterministic hsl', () => {
    expect(colorFromString('abc')).toBe(colorFromString('abc'));
    expect(colorFromString('abc')).toMatch(/^hsl\(/);
  });
});
