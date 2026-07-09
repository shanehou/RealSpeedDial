import { useState } from 'react';

export type EditMode = 'create-bookmark' | 'create-folder' | 'edit-bookmark' | 'rename-folder';

interface Props {
  mode: EditMode;
  initial: { title: string; url?: string };
  onSubmit: (data: { title: string; url?: string }) => void;
  onCancel: () => void;
}

export function EditDialog({ mode, initial, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [url, setUrl] = useState(initial.url ?? '');
  const hasUrl = mode === 'create-bookmark' || mode === 'edit-bookmark';
  const titleMap: Record<EditMode, string> = {
    'create-bookmark': '新增书签', 'create-folder': '新增文件夹',
    'edit-bookmark': '编辑书签', 'rename-folder': '重命名文件夹',
  };
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{titleMap[mode]}</h3>
        <label className="dialog-field"><span>标题</span>
          <input aria-label="标题" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        {hasUrl && (
          <label className="dialog-field"><span>网址</span>
            <input aria-label="网址" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </label>
        )}
        <div className="dialog-actions">
          <button className="btn" onClick={onCancel}>取消</button>
          <button className="btn btn--primary" onClick={() => onSubmit(hasUrl ? { title, url } : { title })}>保存</button>
        </div>
      </div>
    </div>
  );
}
