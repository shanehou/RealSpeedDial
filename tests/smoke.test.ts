import { describe, it, expect } from 'vitest';
import { installChromeMock } from './setup';

describe('test env', () => {
  it('chrome mock installs', () => {
    const c = installChromeMock();
    expect(c.bookmarks.getTree).toBeDefined();
  });
});
