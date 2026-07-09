import { useState } from 'react';
import { faviconUrl, firstLetter, colorFromString } from '@/lib/favicon';
import type { TileStyle } from '@/types';

interface Props {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  tileStyle?: TileStyle;
  onOpen: (url: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export function Tile({ id, title, url, thumbnail, tileStyle = 'favicon', onOpen, onContextMenu }: Props) {
  const [imgOk, setImgOk] = useState(true);
  // 回退链：截图 → 主题色 → favicon → 首字母。themeColor 样式、或截图样式但暂无截图时，
  // 用 favicon 主色渐变作背景衬托，避免空白。
  const themeMode = !thumbnail && (tileStyle === 'themeColor' || tileStyle === 'screenshot');
  return (
    <button
      className="tile"
      style={themeMode ? { background: `linear-gradient(135deg, ${colorFromString(url)}, #1e2130)` } : undefined}
      onClick={() => onOpen(url)}
      onContextMenu={(e) => onContextMenu(e, id)}
      title={title}
    >
      <div className="tile__thumb">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="tile__screenshot" />
        ) : imgOk ? (
          <img src={faviconUrl(url, 64)} alt="" className="tile__favicon" onError={() => setImgOk(false)} />
        ) : (
          <span className="tile__letter" style={{ background: colorFromString(url) }}>{firstLetter(url)}</span>
        )}
      </div>
      <span className="tile__label">{title}</span>
    </button>
  );
}
