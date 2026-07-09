import type { Crumb } from '@/types';

interface Props {
  crumbs: Crumb[];
  onGo: (id: string) => void;
}

export function Breadcrumb({ crumbs, onGo }: Props) {
  if (crumbs.length === 0) return null;
  return (
    <nav className="breadcrumb" aria-label="breadcrumb">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        const label = (
          <>
            {i === 0 && (
              <svg className="breadcrumb__home" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 11l9-8 9 8" />
                <path d="M5 10v10h14V10" />
              </svg>
            )}
            {c.title}
          </>
        );
        return (
          <span key={c.id} className="breadcrumb__item">
            {isLast ? (
              <span className="breadcrumb__current">{label}</span>
            ) : (
              <>
                <button className="breadcrumb__link" onClick={() => onGo(c.id)}>{label}</button>
                <span className="breadcrumb__sep"> › </span>
              </>
            )}
          </span>
        );
      })}
    </nav>
  );
}
