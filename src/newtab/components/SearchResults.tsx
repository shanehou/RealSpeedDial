import type { GroupedSearch, SearchHit } from '@/lib/search';
import { faviconUrl } from '@/lib/favicon';
import { useI18n } from '@/i18n';

interface Props {
  results: GroupedSearch;
  openInNewTab: boolean;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

function Row({ hit, openInNewTab, onContextMenu }: { hit: SearchHit; openInNewTab: boolean; onContextMenu: (e: React.MouseEvent, id: string) => void; }) {
  const pathText = hit.path.map((c) => c.title).join(' › ');
  return (
    <a
      className="sresult"
      href={hit.url}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      onContextMenu={(e) => onContextMenu(e, hit.id)}
    >
      <img className="sresult__fav" src={faviconUrl(hit.url, 32)} alt="" draggable={false}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
      <span className="sresult__text">
        <span className="sresult__title">{hit.title}</span>
        {pathText && <span className="sresult__path">{pathText}</span>}
      </span>
    </a>
  );
}

export function SearchResults({ results, openInNewTab, onContextMenu }: Props) {
  const { t } = useI18n();
  if (results.current.length + results.others.length === 0) {
    return <div className="empty"><p>{t('search.noMatch')}</p></div>;
  }
  return (
    <div className="sresults">
      {results.current.length > 0 && (
        <section>
          <p className="sresults__group">{t('search.groupCurrent')}</p>
          {results.current.map((h) => <Row key={h.id} hit={h} openInNewTab={openInNewTab} onContextMenu={onContextMenu} />)}
        </section>
      )}
      {results.others.length > 0 && (
        <section>
          <p className="sresults__group">{t('search.groupOthers')}</p>
          {results.others.map((h) => <Row key={h.id} hit={h} openInNewTab={openInNewTab} onContextMenu={onContextMenu} />)}
        </section>
      )}
    </div>
  );
}
