import type { SpeedDialBookmark } from '@/types';

interface Props {
  query: string;
  results: SpeedDialBookmark[];
  onQueryChange: (q: string) => void;
  onSubmit: (q: string) => void;
  onPick: (url: string) => void;
}

export function SearchBar({ query, results, onQueryChange, onSubmit, onPick }: Props) {
  return (
    <div className="search">
      <input
        type="search"
        role="searchbox"
        className="search__input"
        placeholder="搜索书签或按回车用搜索引擎搜索"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(query); }}
      />
      {query.trim() && results.length > 0 && (
        <ul className="search__results">
          {results.slice(0, 8).map((r) => (
            <li key={r.id}>
              <button className="search__result" onClick={() => onPick(r.url)}>{r.title}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
