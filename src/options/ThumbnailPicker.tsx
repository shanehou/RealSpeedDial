import { useEffect, useMemo, useState } from 'react';
import { getTree } from '@/lib/bookmarks';
import { loadSettings } from '@/lib/settings';
import { searchBookmarkChoices, type SearchHit } from '@/lib/search';
import {
  deletePendingCapture,
  getPendingCapture,
  putThumbnail,
  type PendingThumbnailCapture,
} from '@/lib/thumbnails';
import { resolveLang, t as translate, type Lang } from '@/lib/i18n';
import type { BookmarkNode } from '@/types';

export function ThumbnailPicker({ captureId }: { captureId: string }) {
  const [root, setRoot] = useState<BookmarkNode | null>(null);
  const [capture, setCapture] = useState<PendingThumbnailCapture | null | undefined>(undefined);
  const [lang, setLang] = useState<Lang>(() => resolveLang('auto'));
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getTree(), getPendingCapture(captureId), loadSettings()]).then(([tree, pending, settings]) => {
      if (cancelled) return;
      setRoot(tree[0] ?? null);
      setCapture(pending ?? null);
      setLang(resolveLang(settings.language));
    });
    return () => { cancelled = true; };
  }, [captureId]);

  useEffect(() => {
    const cleanDraft = () => { void deletePendingCapture(captureId); };
    window.addEventListener('pagehide', cleanDraft);
    return () => window.removeEventListener('pagehide', cleanDraft);
  }, [captureId]);

  const choices = useMemo(() => root ? searchBookmarkChoices(root, query) : [], [root, query]);

  const closeAndClean = async () => {
    await deletePendingCapture(captureId);
    window.close();
  };

  const choose = async (hit: SearchHit) => {
    if (!capture || saving) return;
    setSaving(true);
    try {
      await putThumbnail({ url: hit.url, dataUrl: capture.dataUrl, capturedAt: capture.capturedAt });
      await deletePendingCapture(captureId);
      try {
        await chrome.runtime.sendMessage({ type: 'thumbnail-updated', urls: [hit.url] });
      } catch { /* no open new-tab page */ }
      window.close();
    } finally {
      setSaving(false);
    }
  };

  if (capture === undefined || !root) return <main className="picker"><p>{t('options.loading')}</p></main>;
  if (!capture) return <main className="picker"><p className="warn">{t('picker.loadError')}</p></main>;

  return (
    <main className="picker">
      <header className="picker__header">
        <div>
          <h1>{t('picker.title')}</h1>
          <p className="picker__source"><strong>{t('picker.source')}：</strong>{capture.sourceUrl}</p>
        </div>
        <img className="picker__preview" src={capture.dataUrl} alt="" />
      </header>
      <input
        className="picker__search"
        type="search"
        role="searchbox"
        autoFocus
        placeholder={t('picker.search')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="picker__results">
        {choices.length === 0 ? <p className="picker__empty">{t('picker.noMatch')}</p> : choices.map((hit) => (
          <button key={hit.id} className="picker__row" disabled={saving} onClick={() => void choose(hit)}>
            <span className="picker__title">{hit.title}</span>
            <span className="picker__url">{hit.url}</span>
            <span className="picker__path">{hit.path.map((part) => part.title).join(' › ')}</span>
          </button>
        ))}
      </div>
      <footer className="picker__actions">
        <button className="btn" disabled={saving} onClick={() => void closeAndClean()}>{t('action.cancel')}</button>
      </footer>
    </main>
  );
}
