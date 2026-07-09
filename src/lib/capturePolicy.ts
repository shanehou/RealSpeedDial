import type { ThumbnailPolicy } from '@/types';

const DAY_MS = 86400000;

// 判断是否应为某 URL 抓取新截图：never 从不；always 总是；stale 仅当无缓存或超过 N 天。
export function shouldCapture(
  policy: ThumbnailPolicy,
  lastCapturedAt: number | undefined,
  staleDays: number,
  now: number,
): boolean {
  if (policy === 'never') return false;
  if (policy === 'always') return true;
  if (lastCapturedAt === undefined) return true;
  return now - lastCapturedAt > staleDays * DAY_MS;
}
