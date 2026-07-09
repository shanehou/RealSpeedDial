import { useEffect, useState } from 'react';
import { getTree } from '@/lib/bookmarks';
import { loadSettings, saveSettings } from '@/lib/settings';
import type { BookmarkNode, Settings, TileStyle } from '@/types';
import { FolderTreeSelect } from './components/FolderTreeSelect';
import './styles.css';

export default function Options() {
  const [tree, setTree] = useState<BookmarkNode | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => { void getTree().then((t) => setTree(t[0])); }, []);
  useEffect(() => { void loadSettings().then(setSettings); }, []);

  const patch = async (p: Partial<Settings>) => setSettings(await saveSettings(p));

  if (!tree || !settings) return <div>加载中…</div>;

  return (
    <div className="options">
      <h1>Real Speed Dial 设置</h1>

      <section>
        <h2>根目录</h2>
        <p className="hint">选择一个书签目录作为首页内容来源。</p>
        <FolderTreeSelect tree={tree} selectedId={settings.rootFolderId} onSelect={(id) => void patch({ rootFolderId: id })} />
      </section>

      <section>
        <h2>外观</h2>
        <label className="field">
          <span>磁贴样式</span>
          <select aria-label="磁贴样式" value={settings.tileStyle} onChange={(e) => void patch({ tileStyle: e.target.value as TileStyle })}>
            <option value="favicon">图标 + 标题</option>
            <option value="themeColor">主题色背景</option>
            <option value="screenshot">网页截图</option>
          </select>
        </label>
        <label className="field">
          <span>主题</span>
          <select aria-label="主题" value={settings.theme} onChange={(e) => void patch({ theme: e.target.value as Settings['theme'] })}>
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </label>
        <label className="field">
          <span>列数</span>
          <input type="number" min={3} max={12} value={settings.columns} onChange={(e) => void patch({ columns: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>在新标签页打开书签</span>
          <input type="checkbox" checked={settings.openInNewTab} onChange={(e) => void patch({ openInNewTab: e.target.checked })} />
        </label>
        <label className="field">
          <span>打开时恢复上次位置</span>
          <input type="checkbox" checked={settings.restoreLastPosition} onChange={(e) => void patch({ restoreLastPosition: e.target.checked })} />
        </label>
      </section>
    </div>
  );
}
