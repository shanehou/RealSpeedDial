import { useState } from 'react';
import { useI18n } from '@/i18n';

export type EditMode = 'create-bookmark' | 'create-folder' | 'edit-bookmark' | 'rename-folder';

interface Props {
  mode: EditMode;
  initial: { title: string; url?: string };
  onSubmit: (data: { title: string; url?: string }) => void;
  onCancel: () => void;
}

export function EditDialog({ mode, initial, onSubmit, onCancel }: Props) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initial.title);
  const [url, setUrl] = useState(initial.url ?? '');
  const hasUrl = mode === 'create-bookmark' || mode === 'edit-bookmark';
  const titleMap: Record<EditMode, string> = {
    'create-bookmark': t('dialog.createBookmark'), 'create-folder': t('dialog.createFolder'),
    'edit-bookmark': t('dialog.editBookmark'), 'rename-folder': t('dialog.renameFolder'),
  };
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{titleMap[mode]}</h3>
        <label className="dialog-field"><span>{t('dialog.title')}</span>
          <input aria-label={t('dialog.title')} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        {hasUrl && (
          <label className="dialog-field"><span>{t('dialog.url')}</span>
            <input aria-label={t('dialog.url')} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </label>
        )}
        <div className="dialog-actions">
          <button className="btn" onClick={onCancel}>{t('action.cancel')}</button>
          <button className="btn btn--primary" onClick={() => onSubmit(hasUrl ? { title, url } : { title })}>{t('action.save')}</button>
        </div>
      </div>
    </div>
  );
}
