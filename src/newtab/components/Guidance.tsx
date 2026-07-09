import { useI18n } from '@/i18n';
interface Props { onOpenOptions: () => void; }
export function Guidance({ onOpenOptions }: Props) {
  const { t } = useI18n();
  return (
    <div className="guidance">
      <h1>Real Speed Dial</h1>
      <p>{t('guidance.desc')}</p>
      <button className="btn btn--primary" onClick={onOpenOptions}>{t('guidance.select')}</button>
    </div>
  );
}
