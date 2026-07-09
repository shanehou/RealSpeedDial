import { useI18n } from '@/i18n';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: (q: string) => void;
}

export function SearchBar({ query, onQueryChange, onSubmit }: Props) {
  const { t } = useI18n();
  return (
    <div className="search">
      <input
        type="search"
        role="searchbox"
        className="search__input"
        placeholder={t('search.placeholder')}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(query); }}
      />
    </div>
  );
}
