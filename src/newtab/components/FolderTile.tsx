import { faviconUrl } from '@/lib/favicon';

interface Props {
  id: string;
  title: string;
  preview: string[];
  onEnter: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export function FolderTile({ id, title, preview, onEnter, onContextMenu }: Props) {
  return (
    <button
      className="tile tile--folder"
      onClick={() => onEnter(id)}
      onContextMenu={(e) => onContextMenu(e, id)}
      title={title}
    >
      <div className="tile__thumb tile__folder-grid">
        {preview.slice(0, 4).map((u) => (
          <img key={u} src={faviconUrl(u, 32)} alt="" />
        ))}
      </div>
      <span className="tile__label">📁 {title}</span>
    </button>
  );
}
