interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: (q: string) => void;
}

export function SearchBar({ query, onQueryChange, onSubmit }: Props) {
  return (
    <div className="search">
      <input
        type="search"
        role="searchbox"
        className="search__input"
        placeholder="搜索书签，或按回车用搜索引擎搜索"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(query); }}
      />
    </div>
  );
}
