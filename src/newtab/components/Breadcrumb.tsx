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
        return (
          <span key={c.id} className="breadcrumb__item">
            {isLast ? (
              <span className="breadcrumb__current">{c.title}</span>
            ) : (
              <>
                <button className="breadcrumb__link" onClick={() => onGo(c.id)}>{c.title}</button>
                <span className="breadcrumb__sep"> › </span>
              </>
            )}
          </span>
        );
      })}
    </nav>
  );
}
