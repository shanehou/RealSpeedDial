import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettings } from './hooks/useSettings';
import { useBookmarkTree } from './hooks/useBookmarkTree';
import { useNavState } from './hooks/useNavState';
import { useThumbnails } from './hooks/useThumbnails';
import { buildFolderView } from '@/lib/mapping';
import { resolveInitialNav } from '@/lib/navState';
import { HOME_TAB_ID } from '@/lib/constants';
import { TabBar } from './components/TabBar';
import { Grid } from './components/Grid';
import { Breadcrumb } from './components/Breadcrumb';
import { EmptyState } from './components/EmptyState';
import { Guidance } from './components/Guidance';
import { EditDialog, type EditMode } from './components/EditDialog';
import { ContextMenu, type MenuAction } from './components/ContextMenu';
import { SearchBar } from './components/SearchBar';
import { createBookmark, updateBookmark, removeBookmark, removeFolder, moveBookmark } from '@/lib/bookmarks';
import { resolveMoveIndex } from '@/lib/reorder';
import { filterBookmarks, buildSearchUrl } from '@/lib/search';
import { ensureCapturePermission } from '@/lib/permissions';
import './styles.css';

export default function App() {
  const { settings } = useSettings();
  const rootId = settings?.rootFolderId ?? null;
  const { root, loading } = useBookmarkTree(rootId);
  const { navState, persist, ready } = useNavState(settings?.restoreLastPosition ?? true);

  const [folderId, setFolderId] = useState<string | null>(null);
  const [tabId, setTabId] = useState<string>(HOME_TAB_ID);

  // 初始化：优先恢复 navState（若开启且仍有效），否则优雅回退到根；失效目录/Tab 不会白屏
  useEffect(() => {
    if (!root || !ready || folderId !== null) return;
    const init = resolveInitialNav(root, navState, settings?.restoreLastPosition ?? true);
    setFolderId(init.currentFolderId);
    setTabId(init.selectedTabId);
    // 播种基础 history 条目，使首次按下浏览器后退键即可从当前位置正确回退
    history.replaceState({ folderId: init.currentFolderId, tabId: init.selectedTabId }, '');
  }, [root, ready, navState, settings, folderId]);

  const view = useMemo(() => {
    if (!root || folderId === null) return null;
    return buildFolderView(root, folderId, tabId);
  }, [root, folderId, tabId]);

  const bookmarkUrls = useMemo(
    () => view?.items.flatMap((i) => (i.kind === 'bookmark' ? [i.url] : [])) ?? [],
    [view],
  );
  const thumbnails = useThumbnails(bookmarkUrls, settings?.tileStyle ?? 'favicon');

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
    if (settings?.openInNewTab) window.open(url, '_blank', 'noopener');
    else window.location.href = url;
  }, [settings]);

  const openOptions = useCallback(() => chrome.runtime.openOptionsPage(), []);

  const [query, setQuery] = useState('');
  const searchResults = useMemo(() => (root ? filterBookmarks(root, query) : []), [root, query]);
  const submitSearch = useCallback((q: string) => {
    if (!q.trim() || !settings) return;
    window.location.href = buildSearchUrl(settings.searchEngine, q);
  }, [settings]);

  const [dialog, setDialog] = useState<{ mode: EditMode; targetId?: string; initial: { title: string; url?: string } } | null>(null);

  const submitDialog = useCallback(async (data: { title: string; url?: string }) => {
    if (!dialog || folderId === null) return;
    if (dialog.mode === 'create-bookmark') await createBookmark(folderId, data.title, data.url);
    else if (dialog.mode === 'create-folder') await createBookmark(folderId, data.title);
    else if (dialog.mode === 'edit-bookmark' && dialog.targetId) await updateBookmark(dialog.targetId, { title: data.title, url: data.url });
    else if (dialog.mode === 'rename-folder' && dialog.targetId) await updateBookmark(dialog.targetId, { title: data.title });
    setDialog(null);
  }, [dialog, folderId]);

  const [menu, setMenu] = useState<{ x: number; y: number; id: string; isFolder: boolean } | null>(null);

  const openContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const isFolder = view?.items.find((it) => it.id === id)?.kind === 'folder';
    setMenu({ x: e.clientX, y: e.clientY, id, isFolder: !!isFolder });
  }, [view]);

  const handleMenuAction = useCallback(async (a: MenuAction) => {
    if (!menu || !view) return;
    const item = view.items.find((it) => it.id === menu.id);
    if (!item) { setMenu(null); return; }
    if (a === 'delete') {
      if (item.kind === 'folder') await removeFolder(item.id); else await removeBookmark(item.id);
    } else if (a === 'edit') {
      if (item.kind === 'bookmark') setDialog({ mode: 'edit-bookmark', targetId: item.id, initial: { title: item.title, url: item.url } });
      else setDialog({ mode: 'rename-folder', targetId: item.id, initial: { title: item.title } });
    } else if (a === 'open-new-tab' && item.kind === 'bookmark') {
      window.open(item.url, '_blank', 'noopener');
    } else if (a === 'refresh-thumb' && item.kind === 'bookmark') {
      if (await ensureCapturePermission()) {
        chrome.runtime.sendMessage({ type: 'capture-url', url: item.url });
      }
    }
    setMenu(null);
  }, [menu, view]);

  const handleReorder = useCallback(async (activeId: string, from: number, to: number) => {
    if (folderId === null || !view) return;
    // 目标父目录：当前激活 Tab 对应的文件夹（主页则为当前文件夹）
    const parentId = tabId === HOME_TAB_ID ? folderId : tabId;
    // 用每项真实 index 换算，避免混排目录里显示位置≠存储索引导致错位
    await moveBookmark(activeId, { parentId, index: resolveMoveIndex(view.items, from, to) });
  }, [folderId, tabId, view]);

  const handleMoveInto = useCallback(async (activeId: string, targetFolderId: string) => {
    await moveBookmark(activeId, { parentId: targetFolderId });
  }, []);

  if (!settings || loading) return <div className="loading" />;
  if (!rootId) return <Guidance onOpenOptions={openOptions} />;
  if (!view) return <div className="loading" />;

  return (
    <div className="app">
      <SearchBar query={query} results={searchResults} onQueryChange={setQuery} onSubmit={submitSearch} onPick={openUrl} />
      <Breadcrumb crumbs={view.breadcrumb} onGo={(id) => navigate(id, HOME_TAB_ID, true)} />
      <TabBar tabs={view.tabs} activeTabId={view.activeTabId} onSelect={(id) => navigate(view.folderId, id, true)} />
      {view.items.length === 0 ? (
        <EmptyState onAdd={() => setDialog({ mode: 'create-bookmark', initial: { title: '', url: '' } })} />
      ) : (
        <Grid
          items={view.items}
          columns={settings.columns}
          thumbnails={thumbnails}
          tileStyle={settings.tileStyle}
          onOpen={openUrl}
          onEnter={(id) => navigate(id, HOME_TAB_ID, true)}
          onContextMenu={openContextMenu}
          onReorder={handleReorder}
          onMoveInto={handleMoveInto}
        />
      )}
      <button className="fab" onClick={() => setDialog({ mode: 'create-bookmark', initial: { title: '', url: '' } })}>＋</button>
      {dialog && <EditDialog mode={dialog.mode} initial={dialog.initial} onSubmit={submitDialog} onCancel={() => setDialog(null)} />}
      {menu && <ContextMenu x={menu.x} y={menu.y} isFolder={menu.isFolder} onAction={handleMenuAction} onClose={() => setMenu(null)} />}
    </div>
  );
}
