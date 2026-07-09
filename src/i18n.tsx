import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { resolveLang, t as translate, type Lang, type MessageKey } from '@/lib/i18n';
import type { Language } from '@/types';

export interface I18nValue {
  lang: Lang;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

// 默认值（无 Provider 时）：按 navigator.language 解析。
// 测试环境已把 navigator.language 钉成 zh-CN，故独立渲染的组件默认得到中文。
const I18nContext = createContext<I18nValue>({
  lang: resolveLang('auto'),
  t: (key, params) => translate(resolveLang('auto'), key, params),
});

export function I18nProvider({ language, children }: { language?: Language; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => {
    const lang = resolveLang(language ?? 'auto');
    return { lang, t: (key, params) => translate(lang, key, params) };
  }, [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
