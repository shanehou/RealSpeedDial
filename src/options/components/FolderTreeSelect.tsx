import type { BookmarkNode } from '@/types';

interface Props {
  tree: BookmarkNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function FolderNode({ node, depth, selectedId, onSelect }: { node: BookmarkNode; depth: number; selectedId: string | null; onSelect: (id: string) => void; }) {
  const subfolders = (node.children ?? []).filter((c) => c.url === undefined);
  return (
    <div>
      {node.title && (
        <button
          className={`folder-row ${selectedId === node.id ? 'folder-row--selected' : ''}`}
          style={{ paddingLeft: depth * 16 + 8 }}
          aria-label={node.title}
          onClick={() => onSelect(node.id)}
        >
          📁 {node.title}
        </button>
      )}
      {subfolders.map((sf) => (
        <FolderNode key={sf.id} node={sf} depth={node.title ? depth + 1 : depth} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function FolderTreeSelect({ tree, selectedId, onSelect }: Props) {
  return <div className="folder-tree">{(tree.children ?? []).map((c) => (
    <FolderNode key={c.id} node={c} depth={0} selectedId={selectedId} onSelect={onSelect} />
  ))}</div>;
}
