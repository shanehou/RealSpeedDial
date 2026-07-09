import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettings } from './hooks/useSettings';
import { useBookmarkTree } from './hooks/useBookmarkTree';
import { useNavState } from './hooks/useNavState';
import { buildFolderView } from '@/lib/mapping';
import { HOME_TAB_ID } from '@/lib/constants';
import { TabBar } from './components/TabBar';
import { Grid } from './components/Grid';
import { Breadcrumb } from './components/Breadcrumb';
import { EmptyState } from './components/EmptyState';
import { Guidance } from './components/Guidance';
import './styles.css';

export default function App() {
  const { settings } = useSettings();
  const rootId = settings?.rootFolderId ?? null;
  const { root, loading } = useBookmarkTree(rootId);
  const { navState, persist, ready } = useNavState(settings?.restoreLastPosition ?? true);

  const [folderId, setFolderId] = useState<string | null>(null);
  const [tabId, setTabId] = useState<string>(HOME_TAB_ID);

  // 初始化：优先恢复 navState（若开启且有效），否则用根
  useEffect(() => {
    if (!root || !ready || folderId !== null) return;
    const restored = settings?.restoreLastPosition ? navState : null;
    const initialFolder = restored?.currentFolderId ?? root.id;
    const initialTab = restored?.selectedTabId ?? HOME_TAB_ID;
    setFolderId(initialFolder);
    setTabId(initialTab);
  }, [root, ready, navState, settings, folderId]);

  const view = useMemo(() => {
    if (!root || folderId === null) return null;
    return buildFolderView(root, folderId, tabId);
  }, [root, folderId, tabId]);

  const navigate = useCallback((nextFolderId: string, nextTabId: string, push: boolean) => {
    setFolderId(nextFolderId);
    setTabId(nextTabId);
    persist({ currentFolderId: nextFolderId, selectedTabId: nextTabId });
    if (push) history.pushState({ folderId: nextFolderId, tabId: nextTabId }, '');
  }, [persist]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = e.state as { folderId?: string; tabId?: string } | null;
      if (s?.folderId) { setFolderId(s.folderId); setTabId(s.tabId ?? HOME_TAB_ID); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openUrl = useCallback((url: string) => {
    if (settings?.openInNewTab) window.open(url, '_blank');
    else window.location.href = url;
  }, [settings]);

  const openOptions = useCallback(() => chrome.runtime.openOptionsPage(), []);

  if (!settings || loading) return <div className="loading" />;
  if (!rootId) return <Guidance onOpenOptions={openOptions} />;
  if (!view) return <div className="loading" />;

  return (
    <div className="app">
      <Breadcrumb crumbs={view.breadcrumb} onGo={(id) => navigate(id, HOME_TAB_ID, true)} />
      <TabBar tabs={view.tabs} activeTabId={view.activeTabId} onSelect={(id) => navigate(view.folderId, id, true)} />
      {view.items.length === 0 ? (
        <EmptyState onAdd={() => openOptions()} />
      ) : (
        <Grid
          items={view.items}
          columns={settings.columns}
          thumbnails={{}}
          onOpen={openUrl}
          onEnter={(id) => navigate(id, HOME_TAB_ID, true)}
          onContextMenu={() => {}}
        />
      )}
    </div>
  );
}
