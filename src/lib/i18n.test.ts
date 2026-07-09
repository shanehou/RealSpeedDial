import { describe, it, expect, vi, afterEach } from 'vitest';
import { t, resolveLang } from './i18n';

describe('i18n', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('translates by language', () => {
    expect(t('zh', 'tab.home')).toBe('主页');
    expect(t('en', 'tab.home')).toBe('Home');
  });

  it('interpolates params', () => {
    expect(t('en', 'options.currentRoot', { name: 'Work' })).toContain('Work');
    expect(t('zh', 'options.currentRoot', { name: '工作' })).toContain('工作');
  });

  it('resolveLang honors explicit setting', () => {
    expect(resolveLang('zh')).toBe('zh');
    expect(resolveLang('en')).toBe('en');
  });

  it('resolveLang auto follows navigator.language', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' });
    expect(resolveLang('auto')).toBe('zh');
    vi.stubGlobal('navigator', { language: 'en-US' });
    expect(resolveLang('auto')).toBe('en');
  });
});
