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

// 标题为主视觉（类 logo），favicon 缩为左上角小图标，避免放大导致锯齿；
// 有网页截图时截图铺满卡片，底部渐变蒙层保证标题可读。
export function Tile({ id, title, url, thumbnail, tileStyle = 'favicon', onOpen, onContextMenu }: Props) {
  const [imgOk, setImgOk] = useState(true);
  const themeMode = !thumbnail && (tileStyle === 'themeColor' || tileStyle === 'screenshot');
  return (
    <button
      className={`tile${thumbnail ? ' tile--shot' : ''}`}
      style={themeMode ? { background: `linear-gradient(135deg, ${colorFromString(url)}, #262a3d)` } : undefined}
      onClick={() => onOpen(url)}
      onContextMenu={(e) => onContextMenu(e, id)}
      title={title}
    >
      {thumbnail && <img src={thumbnail} alt="" className="tile__screenshot" />}
      <span className="tile__fav">
        {imgOk ? (
          <img src={faviconUrl(url, 32)} alt="" onError={() => setImgOk(false)} />
        ) : (
          <span className="tile__fav-letter" style={{ background: colorFromString(url) }}>{firstLetter(url)}</span>
        )}
      </span>
      <span className="tile__title">{title}</span>
    </button>
  );
}
