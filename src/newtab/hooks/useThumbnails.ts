import { useEffect, useState } from 'react';
import { getThumbnail } from '@/lib/thumbnails';
import type { ThumbnailRecord, TileStyle } from '@/types';
import type { RsdMessage } from '@/lib/messages';

// 仅在「网页截图」样式下从 IndexedDB 读取缩略图记录（含焦点区域）；其他样式返回空表（走 favicon/主题色）。
// refreshKey 变化时强制重读（用于手动刷新缩略图后即时更新，无需刷新页面）。
export function useThumbnails(urls: string[], style: TileStyle, refreshKey = 0): Record<string, ThumbnailRecord> {
  const [map, setMap] = useState<Record<string, ThumbnailRecord>>({});
  const [backgroundRevision, setBackgroundRevision] = useState(0);
  const key = urls.join('|');

  useEffect(() => {
    const listener = (message: RsdMessage) => {
      if (message.type === 'thumbnail-updated' && message.urls.some((url) => urls.includes(url))) {
        setBackgroundRevision((revision) => revision + 1);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
    // key represents the current URL contents.
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (style !== 'screenshot') { setMap({}); return; }
    let cancelled = false;
    void (async () => {
      const next: Record<string, ThumbnailRecord> = {};
      for (const u of urls) {
        const rec = await getThumbnail(u);
        if (rec) next[u] = rec;
      }
      if (!cancelled) setMap(next);
    })();
    return () => { cancelled = true; };
    // key 代表 urls 内容；style / refreshKey 变化时重取
  }, [key, style, refreshKey, backgroundRevision]); // eslint-disable-line react-hooks/exhaustive-deps

  return map;
}
