import { useState } from 'react';
import { faviconUrl, firstLetter, colorFromString } from '@/lib/favicon';
import type { TileStyle } from '@/types';

interface Props {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  tileStyle?: TileStyle;
  openInNewTab?: boolean;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

// 书签磁贴是真正的 <a>：浏览器原生在左下角显示网址，并支持中键/Cmd 点击、右键复制链接。
// draggable=false 让 dnd-kit 的指针拖拽不被原生链接/图片拖拽劫持。
export function Tile({ id, title, url, thumbnail, tileStyle = 'favicon', openInNewTab, onContextMenu }: Props) {
  const [imgOk, setImgOk] = useState(true);
  const themeMode = !thumbnail && (tileStyle === 'themeColor' || tileStyle === 'screenshot');
  return (
    <a
      className={`tile${thumbnail ? ' tile--shot' : ''}${themeMode ? ' tile--theme' : ''}`}
      href={url}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      draggable={false}
      style={themeMode ? { background: `linear-gradient(135deg, ${colorFromString(url)}, #262a3d)` } : undefined}
      onContextMenu={(e) => onContextMenu(e, id)}
      title={title}
    >
      {thumbnail && <img src={thumbnail} alt="" className="tile__screenshot" draggable={false} />}
      <span className="tile__fav">
        {imgOk ? (
          <img src={faviconUrl(url, 32)} alt="" draggable={false} onError={() => setImgOk(false)} />
        ) : (
          <span className="tile__fav-letter" style={{ background: colorFromString(url) }}>{firstLetter(url)}</span>
        )}
      </span>
      <span className="tile__title">{title}</span>
    </a>
  );
}
