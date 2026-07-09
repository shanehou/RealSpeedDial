import { useEffect } from 'react';
import { useI18n } from '@/i18n';

export type MenuAction = 'edit' | 'delete' | 'open-new-tab' | 'refresh-thumb';

interface Props {
  x: number;
  y: number;
  isFolder: boolean;
  onAction: (a: MenuAction) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, isFolder, onAction, onClose }: Props) {
  const { t } = useI18n();
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [onClose]);

  return (
    <div className="ctxmenu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      <button className="ctxmenu__item" onClick={() => onAction('edit')}>{t('ctx.edit')}</button>
      {!isFolder && <button className="ctxmenu__item" onClick={() => onAction('open-new-tab')}>{t('ctx.openNewTab')}</button>}
      {!isFolder && <button className="ctxmenu__item" onClick={() => onAction('refresh-thumb')}>{t('ctx.refreshThumb')}</button>}
      <button className="ctxmenu__item ctxmenu__item--danger" onClick={() => onAction('delete')}>{t('ctx.delete')}</button>
    </div>
  );
}
