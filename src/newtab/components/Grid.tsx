import type { SpeedDialItem } from '@/types';
import { Tile } from './Tile';
import { FolderTile } from './FolderTile';

interface Props {
  items: SpeedDialItem[];
  columns: number;
  thumbnails: Record<string, string>;
  onOpen: (url: string) => void;
  onEnter: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export function Grid({ items, columns, thumbnails, onOpen, onEnter, onContextMenu }: Props) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {items.map((it) =>
        it.kind === 'bookmark' ? (
          <Tile key={it.id} id={it.id} title={it.title} url={it.url} thumbnail={thumbnails[it.url]} onOpen={onOpen} onContextMenu={onContextMenu} />
        ) : (
          <FolderTile key={it.id} id={it.id} title={it.title} preview={it.childrenPreview} onEnter={onEnter} onContextMenu={onContextMenu} />
        ),
      )}
    </div>
  );
}
