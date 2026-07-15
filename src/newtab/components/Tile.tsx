import { useEffect, useRef, useState } from 'react';
import { faviconUrl, firstLetter, colorFromString, hueFromString } from '@/lib/favicon';
import { computeFocusBackground, FULL_REGION, type FocusBackground } from '@/lib/thumbFocus';
import type { NormalizedRegion, TileStyle } from '@/types';

interface Props {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  region?: NormalizedRegion;
  tileStyle?: TileStyle;
  openInNewTab?: boolean;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

const COVER: FocusBackground = { backgroundSize: 'cover', backgroundPositionX: 'center', backgroundPositionY: 'center' };

// 书签磁贴是真正的 <a>：浏览器原生在左下角显示网址，并支持中键/Cmd 点击、右键复制链接。
export function Tile({ id, title, url, thumbnail, region, tileStyle = 'themeColor', openInNewTab, onContextMenu }: Props) {
  const [imgOk, setImgOk] = useState(true);
  const screenshot = tileStyle === 'screenshot' ? thumbnail : undefined;
  const themeMode = !screenshot;
  const shotRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<FocusBackground>(COVER);

  // 依据图片自然比例与磁贴当前比例计算焦点背景；磁贴比例随列数变化时经 ResizeObserver 重算。
  useEffect(() => {
    const el = shotRef.current;
    if (!screenshot || !el) return;
    let aspect = 0;
    const recompute = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (!aspect || !cw || !ch) return;
      setFocus(computeFocusBackground(region ?? FULL_REGION, aspect, cw / ch));
    };
    const img = new Image();
    img.onload = () => { aspect = img.naturalWidth / img.naturalHeight; recompute(); };
    img.src = screenshot;
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [screenshot, region?.x, region?.y, region?.w, region?.h]);

  return (
    <a
      className={`tile${screenshot ? ' tile--shot' : ''}${themeMode ? ' tile--theme' : ''}`}
      href={url}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      draggable={false}
      style={themeMode ? ({ ['--tile-hue']: hueFromString(url) } as React.CSSProperties) : undefined}
      onContextMenu={(e) => onContextMenu(e, id)}
      title={title}
    >
      {screenshot && (
        <div
          ref={shotRef}
          className="tile__screenshot"
          style={{
            backgroundImage: `url(${screenshot})`,
            backgroundSize: focus.backgroundSize,
            backgroundPositionX: focus.backgroundPositionX,
            backgroundPositionY: focus.backgroundPositionY,
          }}
        />
      )}
      <span className="tile__fav">
        {imgOk ? (
          <img src={faviconUrl(url, 32)} alt="" draggable={false} onError={() => setImgOk(false)} />
        ) : (
          <span className="tile__fav-letter" style={{ background: colorFromString(url) }}>{firstLetter(url)}</span>
        )}
      </span>
      <span className="tile__title">{title}</span>
    </a>
  );
}
