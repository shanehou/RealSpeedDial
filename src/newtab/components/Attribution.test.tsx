import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n';
import { Attribution } from './Attribution';

describe('Attribution', () => {
  it('renders photographer + Unsplash links carrying utm', () => {
    render(
      <I18nProvider language="en">
        <Attribution data={{
          photographer: 'Ansel',
          photographerUrl: 'https://unsplash.com/@ansel?utm_source=real_speed_dial&utm_medium=referral',
          unsplashUrl: 'https://unsplash.com/?utm_source=real_speed_dial&utm_medium=referral',
        }} />
      </I18nProvider>,
    );
    expect(screen.getByRole('link', { name: 'Ansel' }).getAttribute('href')).toContain('utm_source=real_speed_dial');
    expect(screen.getByRole('link', { name: 'Unsplash' }).getAttribute('href')).toContain('unsplash.com');
  });
});
