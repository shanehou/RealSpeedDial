import type { TabModel } from '@/types';
import { useI18n } from '@/i18n';

interface Props {
  tabs: TabModel[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onEnter: (id: string) => void;
}

export function TabBar({ tabs, activeTabId, onSelect, onEnter }: Props) {
  const { t } = useI18n();
  const onlyHome = tabs.length === 1 && tabs[0].isHome;
  if (tabs.length === 0 || onlyHome) return null;
  return (
    <div className="tabbar" role="tablist">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <span key={tab.id} className={`tab-wrap ${active ? 'tab-wrap--active' : ''}`}>
            <button
              role="tab"
              aria-selected={active}
              className={`tab ${active ? 'tab--active' : ''}`}
              onClick={() => onSelect(tab.id)}
            >
              {tab.isHome ? t('tab.home') : tab.title}
            </button>
            {active && !tab.isHome && (
              <button
                type="button"
                className="tab__enter"
                aria-label={t('tab.enter')}
                title={t('tab.enter')}
                onClick={(e) => { e.stopPropagation(); onEnter(tab.id); }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4v7a4 4 0 0 0 4 4h12" />
                  <path d="M15 11l4 4-4 4" />
                </svg>
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
