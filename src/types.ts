export interface BookmarkNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  index?: number;
  dateAdded?: number;
  children?: BookmarkNode[];
}

export type TileStyle = 'favicon' | 'themeColor' | 'screenshot';

export interface SpeedDialBookmark {
  kind: 'bookmark';
  id: string;
  title: string;
  url: string;
  index: number;
}

export interface SpeedDialFolder {
  kind: 'folder';
  id: string;
  title: string;
  index: number;
  childrenPreview: string[];
}

export type SpeedDialItem = SpeedDialBookmark | SpeedDialFolder;

export interface TabModel {
  id: string;
  title: string;
  isHome: boolean;
}

export interface Crumb {
  id: string;
  title: string;
}

export interface FolderView {
  folderId: string;
  tabs: TabModel[];
  activeTabId: string;
  items: SpeedDialItem[];
  breadcrumb: Crumb[];
}

export type ThumbnailPolicy = 'always' | 'stale' | 'never';

export type WallpaperSource = 'bing' | 'picsum' | 'unsplash';

export type BackgroundSetting =
  | { type: 'color'; value: string }
  | { type: 'wallpaper' }
  | { type: 'auto'; source: WallpaperSource };

export type Language = 'auto' | 'zh' | 'en';

export interface WallpaperAttribution {
  photographer: string;
  photographerUrl: string; // 含 utm
  unsplashUrl: string;     // 含 utm
}

export interface Settings {
  rootFolderId: string | null; // 语义：新标签页默认落地目录
  tileStyle: TileStyle;
  thumbnailPolicy: ThumbnailPolicy;
  thumbnailStaleDays: number;
  openInNewTab: boolean;
  restoreLastPosition: boolean;
  theme: 'system' | 'light' | 'dark';
  background: BackgroundSetting;
  columns: number;
  searchEngine: string;
  language: Language;
}

export const DEFAULT_SETTINGS: Settings = {
  rootFolderId: null,
  tileStyle: 'favicon',
  thumbnailPolicy: 'stale',
  thumbnailStaleDays: 7,
  openInNewTab: false,
  restoreLastPosition: true,
  theme: 'system',
  background: { type: 'color', value: '#1e2130' },
  columns: 6,
  searchEngine: 'https://www.google.com/search?q=%s',
  language: 'auto',
};

export interface NavState {
  currentFolderId: string;
  selectedTabId: string;
}

export interface ThumbnailRecord {
  url: string;
  dataUrl: string;
  capturedAt: number;
}
