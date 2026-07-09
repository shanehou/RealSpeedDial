import { useI18n } from '@/i18n';
interface Props { onAdd: () => void; }
export function EmptyState({ onAdd }: Props) {
  const { t } = useI18n();
  return (
    <div className="empty">
      <p>{t('empty.noBookmarks')}</p>
      <button className="btn" onClick={onAdd}>{t('empty.addBookmark')}</button>
    </div>
  );
}
