import type { Crumb } from '@/types';
import { useI18n } from '@/i18n';

interface Props {
  crumbs: Crumb[];
  onGo: (id: string) => void;
}

export function Breadcrumb({ crumbs, onGo }: Props) {
  const { t } = useI18n();
  if (crumbs.length === 0) return null;
  return (
    <nav className="breadcrumb" aria-label="breadcrumb">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        const isHome = i === 0;
        const label = (
          <>
            {isHome && (
              <svg className="breadcrumb__home" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 11l9-8 9 8" />
                <path d="M5 10v10h14V10" />
              </svg>
            )}
            {isHome ? (c.title || t('breadcrumb.root')) : c.title}
          </>
        );
        // 根（home）始终可点击返回首页；其余上级可点击；仅「非根的当前层」为不可点文本
        const clickable = isHome || !isLast;
        return (
          <span key={c.id} className="breadcrumb__item">
            {clickable ? (
              <button
                className={`breadcrumb__link${isLast ? ' breadcrumb__link--current' : ''}`}
                onClick={() => onGo(c.id)}
              >
                {label}
              </button>
            ) : (
              <span className="breadcrumb__current">{label}</span>
            )}
            {!isLast && <span className="breadcrumb__sep"> › </span>}
          </span>
        );
      })}
    </nav>
  );
}
