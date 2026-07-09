import type { TabModel } from '@/types';

interface Props {
  tabs: TabModel[];
  activeTabId: string;
  onSelect: (id: string) => void;
}

export function TabBar({ tabs, activeTabId, onSelect }: Props) {
  const onlyHome = tabs.length === 1 && tabs[0].isHome;
  if (tabs.length === 0 || onlyHome) return null;
  return (
    <div className="tabbar" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === activeTabId}
          className={`tab ${t.id === activeTabId ? 'tab--active' : ''}`}
          onClick={() => onSelect(t.id)}
        >
          {t.title}
        </button>
      ))}
    </div>
  );
}
