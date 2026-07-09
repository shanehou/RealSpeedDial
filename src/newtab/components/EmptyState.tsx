interface Props { onAdd: () => void; }
export function EmptyState({ onAdd }: Props) {
  return (
    <div className="empty">
      <p>这个目录还没有书签</p>
      <button className="btn" onClick={onAdd}>+ 新增书签</button>
    </div>
  );
}
