interface Props {
  id: string;
  title: string;
  preview?: string[];
  onEnter: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export function FolderTile({ id, title, onEnter, onContextMenu }: Props) {
  return (
    <button
      className="tile tile--folder"
      onClick={() => onEnter(id)}
      onContextMenu={(e) => onContextMenu(e, id)}
      title={title}
    >
      <span className="tile__fav tile__fav--folder" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      </span>
      <span className="tile__title">{title}</span>
    </button>
  );
}
