import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider, useI18n } from './i18n';

function Probe() {
  const { t, lang } = useI18n();
  return <div>{lang}:{t('tab.home')}</div>;
}

describe('I18nProvider', () => {
  it('provides zh translations', () => {
    render(<I18nProvider language="zh"><Probe /></I18nProvider>);
    expect(screen.getByText('zh:主页')).toBeInTheDocument();
  });
  it('provides en translations', () => {
    render(<I18nProvider language="en"><Probe /></I18nProvider>);
    expect(screen.getByText('en:Home')).toBeInTheDocument();
  });
});
