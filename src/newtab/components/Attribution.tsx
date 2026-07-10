import type { WallpaperAttribution } from '@/types';
import { useI18n } from '@/i18n';

export function Attribution({ data }: { data: WallpaperAttribution }) {
  const { t } = useI18n();
  return (
    <div className="attribution">
      {t('attribution.by')} <a href={data.photographerUrl} target="_blank" rel="noopener noreferrer">{data.photographer}</a> {t('attribution.on')} <a href={data.unsplashUrl} target="_blank" rel="noopener noreferrer">Unsplash</a>
    </div>
  );
}
