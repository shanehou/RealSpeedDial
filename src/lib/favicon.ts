export function faviconUrl(pageUrl: string, size = 32): string {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}

export function firstLetter(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '').charAt(0).toUpperCase() || '?';
  } catch {
    return (pageUrl.trim().charAt(0) || '?').toUpperCase();
  }
}

// 由字符串稳定散列出一个色相（0-359），同一站点每次结果一致。
export function hueFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function colorFromString(input: string): string {
  return `hsl(${hueFromString(input)}, 55%, 45%)`;
}
