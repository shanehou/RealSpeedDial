import { useEffect, useState } from 'react';
import { getThumbnail } from '@/lib/thumbnails';
import type { TileStyle } from '@/types';

// 仅在「网页截图」样式下从 IndexedDB 读取缩略图；其他样式返回空表（走 favicon/主题色）。
export function useThumbnails(urls: string[], style: TileStyle): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});
  const key = urls.join('|');

  useEffect(() => {
    if (style !== 'screenshot') { setMap({}); return; }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const u of urls) {
        const rec = await getThumbnail(u);
        if (rec) next[u] = rec.dataUrl;
      }
      if (!cancelled) setMap(next);
    })();
    return () => { cancelled = true; };
    // key 代表 urls 内容；style 变化时重取
  }, [key, style]); // eslint-disable-line react-hooks/exhaustive-deps

  return map;
}
