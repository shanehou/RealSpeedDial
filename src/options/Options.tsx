import { useEffect, useRef, useState } from 'react';
import { getTree } from '@/lib/bookmarks';
import { loadSettings, saveSettings } from '@/lib/settings';
import { findNode } from '@/lib/mapping';
import { ensureCapturePermission } from '@/lib/permissions';
import { putAsset } from '@/lib/thumbnails';
import { WALLPAPER_KEY } from '@/lib/constants';
import { resolveLang, t as translate } from '@/lib/i18n';
import type { BookmarkNode, Settings, TileStyle } from '@/types';
import { FolderTreeSelect } from './components/FolderTreeSelect';
import './styles.css';

export default function Options() {
  const [tree, setTree] = useState<BookmarkNode | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { void getTree().then((t) => setTree(t[0])); }, []);
  useEffect(() => { void loadSettings().then(setSettings); }, []);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const patch = async (p: Partial<Settings>) => {
    setSettings(await saveSettings(p));
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1600);
  };

  if (!tree || !settings) return <div>{translate(resolveLang('auto'), 'options.loading')}</div>;

  const lang = resolveLang(settings.language);
  const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate(lang, key, params);

  const selectedFolder = settings.rootFolderId ? findNode(tree, settings.rootFolderId) : null;

  return (
    <div className="options">
      <div className="options-header">
        <div>
          <h1>{t('options.title')}</h1>
          <p className="hint">{t('options.instantHint')}</p>
        </div>
        <div className="options-header__right">
          {saved && <span className="saved-badge" role="status">{t('options.saved')}</span>}
          <button className="btn btn--primary" onClick={() => chrome.tabs.create({})}>{t('options.preview')}</button>
        </div>
      </div>

      <section>
        <h2>{t('options.rootTitle')}</h2>
        <p className="hint">{t('options.rootHint')}</p>
        <FolderTreeSelect tree={tree} selectedId={settings.rootFolderId} onSelect={(id) => void patch({ rootFolderId: id })} />
        {selectedFolder ? (
          <p className="confirm">{t('options.currentRoot', { name: selectedFolder.title || t('options.unnamed') })}</p>
        ) : (
          <p className="warn">{t('options.noRoot')}</p>
        )}
      </section>

      <section>
        <h2>{t('options.appearance')}</h2>
        <label className="field">
          <span>{t('options.language')}</span>
          <select aria-label={t('options.language')} value={settings.language} onChange={(e) => void patch({ language: e.target.value as Settings['language'] })}>
            <option value="auto">{t('options.langAuto')}</option>
            <option value="zh">{t('options.langZh')}</option>
            <option value="en">{t('options.langEn')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('options.tileStyle')}</span>
          <select
            aria-label={t('options.tileStyle')}
            value={settings.tileStyle}
            onChange={async (e) => {
              const style = e.target.value as TileStyle;
              if (style === 'screenshot' && !(await ensureCapturePermission())) {
                alert(t('options.captureDenied'));
                return;
              }
              await patch({ tileStyle: style });
            }}
          >
            <option value="favicon">{t('options.tileFavicon')}</option>
            <option value="themeColor">{t('options.tileTheme')}</option>
            <option value="screenshot">{t('options.tileShot')}</option>
          </select>
        </label>
        {settings.tileStyle === 'screenshot' && (
          <>
            <label className="field">
              <span>{t('options.autoReshot')}</span>
              <select
                aria-label={t('options.autoReshot')}
                value={settings.thumbnailPolicy}
                onChange={(e) => void patch({ thumbnailPolicy: e.target.value as Settings['thumbnailPolicy'] })}
              >
                <option value="always">{t('options.reshotAlways')}</option>
                <option value="stale">{t('options.reshotStale')}</option>
                <option value="never">{t('options.reshotNever')}</option>
              </select>
            </label>
            {settings.thumbnailPolicy === 'stale' && (
              <label className="field">
                <span>{t('options.staleDays')}</span>
                <span className="field-inline">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={settings.thumbnailStaleDays}
                    onChange={(e) => void patch({ thumbnailStaleDays: Math.min(90, Math.max(1, Number(e.target.value) || 7)) })}
                  />
                  <span className="unit">{t('options.staleDaysUnit')}</span>
                </span>
              </label>
            )}
          </>
        )}
        <label className="field">
          <span>{t('options.theme')}</span>
          <select aria-label={t('options.theme')} value={settings.theme} onChange={(e) => void patch({ theme: e.target.value as Settings['theme'] })}>
            <option value="system">{t('options.themeSystem')}</option>
            <option value="light">{t('options.themeLight')}</option>
            <option value="dark">{t('options.themeDark')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('options.background')}</span>
          <select
            aria-label={t('options.background')}
            value={settings.background.type}
            onChange={(e) => void patch({ background: e.target.value === 'wallpaper' ? { type: 'wallpaper' } : { type: 'color', value: '#1e2130' } })}
          >
            <option value="color">{t('options.bgColor')}</option>
            <option value="wallpaper">{t('options.bgWallpaper')}</option>
          </select>
        </label>
        {settings.background.type === 'color' && (
          <label className="field">
            <span>{t('options.bgColorLabel')}</span>
            <input type="color" value={settings.background.value} onChange={(e) => void patch({ background: { type: 'color', value: e.target.value } })} />
          </label>
        )}
        {settings.background.type === 'wallpaper' && (
          <label className="field">
            <span>{t('options.uploadWallpaper')}</span>
            <input type="file" accept="image/*" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) { await putAsset(WALLPAPER_KEY, file); await patch({ background: { type: 'wallpaper' } }); }
            }} />
          </label>
        )}
        <label className="field">
          <span>{t('options.columns')}</span>
          <input type="number" min={3} max={12} value={settings.columns} onChange={(e) => void patch({ columns: Math.min(12, Math.max(3, Number(e.target.value) || 6)) })} />
        </label>
        <label className="field">
          <span>{t('options.openInNewTab')}</span>
          <input type="checkbox" checked={settings.openInNewTab} onChange={(e) => void patch({ openInNewTab: e.target.checked })} />
        </label>
        <label className="field">
          <span>{t('options.restore')}</span>
          <input type="checkbox" checked={settings.restoreLastPosition} onChange={(e) => void patch({ restoreLastPosition: e.target.checked })} />
        </label>
      </section>
    </div>
  );
}
