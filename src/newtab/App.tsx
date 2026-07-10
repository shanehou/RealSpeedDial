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
import { Tile } from './components/Tile';
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
import { resolveTheme } from '@/lib/theme';
import { getAsset, deleteThumbnail } from '@/lib/thumbnails';
import { WALLPAPER_KEY } from '@/lib/constants';
import { I18nProvider } from '@/i18n';
import { resolveLang, t as translate } from '@/lib/i18n';
import './styles.css';

export default function App() {
  const { settings } = useSettings();
  const rootId = settings?.rootFolderId ?? null;
  const lang = resolveLang(settings?.language ?? 'auto');
  const t = useCallback((key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate(lang, key, params), [lang]);
  const { root, loading } = useBookmarkTree();
  const { navState, persist, ready } = useNavState(settings?.restoreLastPosition ?? true);

  const [folderId, setFolderId] = useState<string | null>(null);
  const [tabId, setTabId] = useState<string>(HOME_TAB_ID);

  // 初始化：优先恢复 navState（若开启且仍有效），否则优雅回退到根；失效目录/Tab 不会白屏
  useEffect(() => {
    if (!root || !ready || folderId !== null) return;
    const init = resolveInitialNav(root, navState, settings?.restoreLastPosition ?? true, rootId ?? undefined);
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
  const [thumbRefresh, setThumbRefresh] = useState(0);
  const thumbnails = useThumbnails(bookmarkUrls, settings?.tileStyle ?? 'favicon', thumbRefresh);

  // 当前激活 Tab 对应的文件夹：主页 Tab → 当前文件夹；子目录 Tab → 该子目录。
  // 新增/排序都应作用于「用户当前所见」的这个文件夹。
  const activeFolderId = folderId !== null && tabId !== HOME_TAB_ID ? tabId : folderId;

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

  // 应用主题与背景（纯色 / 壁纸图片）
  useEffect(() => {
    if (!settings) return;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true;
    document.documentElement.dataset.theme = resolveTheme(settings.theme, prefersDark);
    let cancelled = false;
    let objectUrl: string | null = null;
    if (settings.background.type === 'color') {
      document.body.style.background = settings.background.value;
    } else {
      void getAsset(WALLPAPER_KEY).then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        document.body.style.background = `url(${objectUrl}) center/cover no-repeat fixed`;
      });
    }
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [settings]);

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
    if (!dialog || activeFolderId === null) return;
    // 新增写入「当前所见文件夹」（含子目录 Tab），与拖拽排序一致
    if (dialog.mode === 'create-bookmark') await createBookmark(activeFolderId, data.title, data.url);
    else if (dialog.mode === 'create-folder') await createBookmark(activeFolderId, data.title);
    else if (dialog.mode === 'edit-bookmark' && dialog.targetId) await updateBookmark(dialog.targetId, { title: data.title, url: data.url });
    else if (dialog.mode === 'rename-folder' && dialog.targetId) await updateBookmark(dialog.targetId, { title: data.title });
    setDialog(null);
  }, [dialog, activeFolderId]);

  const [menu, setMenu] = useState<{ x: number; y: number; id: string; isFolder: boolean } | null>(null);

  // 上下文菜单可作用于普通网格项或搜索结果项
  const findItem = useCallback(
    (id: string) => view?.items.find((it) => it.id === id) ?? searchResults.find((b) => b.id === id),
    [view, searchResults],
  );

  const openContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const isFolder = findItem(id)?.kind === 'folder';
    setMenu({ x: e.clientX, y: e.clientY, id, isFolder: !!isFolder });
  }, [findItem]);

  const handleMenuAction = useCallback(async (a: MenuAction) => {
    if (!menu) return;
    const item = findItem(menu.id);
    if (!item) { setMenu(null); return; }
    if (a === 'delete') {
      if (item.kind === 'folder') await removeFolder(item.id);
      else { await removeBookmark(item.id); await deleteThumbnail(item.url); }
    } else if (a === 'edit') {
      if (item.kind === 'bookmark') setDialog({ mode: 'edit-bookmark', targetId: item.id, initial: { title: item.title, url: item.url } });
      else setDialog({ mode: 'rename-folder', targetId: item.id, initial: { title: item.title } });
    } else if (a === 'open-new-tab' && item.kind === 'bookmark') {
      window.open(item.url, '_blank', 'noopener');
    } else if (a === 'refresh-thumb' && item.kind === 'bookmark') {
      if (await ensureCapturePermission()) {
        // 抓取完成后回调 → 触发缩略图重读，无需刷新页面即可看到新图
        chrome.runtime.sendMessage({ type: 'capture-url', url: item.url }, () => setThumbRefresh((t) => t + 1));
      }
    }
    setMenu(null);
  }, [menu, findItem]);

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

  const searching = query.trim().length > 0;

  let content: React.ReactNode;
  if (!settings || loading) content = <div className="loading" />;
  else if (!rootId) content = <Guidance onOpenOptions={openOptions} />;
  else if (!view) content = <div className="loading" />;
  else content = (
    <div className="app">
      <button className="icon-btn settings-btn" title={t('action.settings')} aria-label={t('action.settings')} onClick={openOptions}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <circle cx="9" cy="7" r="2.4" fill="currentColor" stroke="none" />
          <line x1="4" y1="17" x2="20" y2="17" />
          <circle cx="15" cy="17" r="2.4" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <div className="topbar">
        <SearchBar query={query} onQueryChange={setQuery} onSubmit={submitSearch} />
      </div>

      {searching ? (
        <>
          <p className="search-header">搜索结果：{searchResults.length} 个匹配「{query.trim()}」</p>
          {searchResults.length === 0 ? (
            <div className="empty"><p>没有匹配的书签</p></div>
          ) : (
            <div className="grid" style={{ ['--cols']: String(settings.columns) } as React.CSSProperties}>
              {searchResults.map((b) => (
                <div className="grid__cell" key={b.id}>
                  <Tile id={b.id} title={b.title} url={b.url} thumbnail={thumbnails[b.url]} tileStyle={settings.tileStyle} onOpen={openUrl} onContextMenu={openContextMenu} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <Breadcrumb crumbs={view.breadcrumb} onGo={(id) => navigate(id, HOME_TAB_ID, true)} />
          <TabBar tabs={view.tabs} activeTabId={view.activeTabId} onSelect={(id) => navigate(view.folderId, id, true)} onEnter={(id) => navigate(id, HOME_TAB_ID, true)} />
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
        </>
      )}

      <div className="fab-group">
        <button className="fab fab--secondary" title={t('action.newFolder')} aria-label={t('action.newFolder')} onClick={() => setDialog({ mode: 'create-folder', initial: { title: '' } })}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <line x1="12" y1="11" x2="12" y2="15" />
            <line x1="10" y1="13" x2="14" y2="13" />
          </svg>
        </button>
        <button className="fab" title={t('action.newBookmark')} aria-label={t('action.newBookmark')} onClick={() => setDialog({ mode: 'create-bookmark', initial: { title: '', url: '' } })}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
      {dialog && <EditDialog mode={dialog.mode} initial={dialog.initial} onSubmit={submitDialog} onCancel={() => setDialog(null)} />}
      {menu && <ContextMenu x={menu.x} y={menu.y} isFolder={menu.isFolder} onAction={handleMenuAction} onClose={() => setMenu(null)} />}
    </div>
  );
  return <I18nProvider language={settings?.language}>{content}</I18nProvider>;
}
