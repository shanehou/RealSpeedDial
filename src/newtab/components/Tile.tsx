import { useState } from 'react';
import { faviconUrl, firstLetter, colorFromString } from '@/lib/favicon';

interface Props {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  onOpen: (url: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export function Tile({ id, title, url, thumbnail, onOpen, onContextMenu }: Props) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button
      className="tile"
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
