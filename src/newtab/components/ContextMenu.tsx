import { useEffect } from 'react';

export type MenuAction = 'edit' | 'delete' | 'open-new-tab' | 'refresh-thumb';

interface Props {
  x: number;
  y: number;
  isFolder: boolean;
  onAction: (a: MenuAction) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, isFolder, onAction, onClose }: Props) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [onClose]);

  return (
    <div className="ctxmenu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      <button className="ctxmenu__item" onClick={() => onAction('edit')}>编辑</button>
      {!isFolder && <button className="ctxmenu__item" onClick={() => onAction('open-new-tab')}>在新标签页打开</button>}
      {!isFolder && <button className="ctxmenu__item" onClick={() => onAction('refresh-thumb')}>刷新缩略图</button>}
      <button className="ctxmenu__item ctxmenu__item--danger" onClick={() => onAction('delete')}>删除</button>
    </div>
  );
}
