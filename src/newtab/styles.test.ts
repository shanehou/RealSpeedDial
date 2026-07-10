import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/newtab/styles.css'), 'utf8');

describe('tile hover motion', () => {
  it('drifts the theme gradient on hover', () => {
    expect(css).toMatch(/\.tile--theme\s*\{[^}]*background-size:\s*160%\s+160%/s);
    expect(css).toMatch(/\.tile--theme:hover\s*\{[^}]*background-position:\s*100%\s+100%/s);
  });

  it('disables tile motion when reduced motion is preferred', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.tile--theme/);
  });
});
