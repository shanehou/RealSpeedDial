import { HOME_TAB_ID } from './constants';
import type { FolderView } from '@/types';

// Chrome bookmarks.move 的 index 语义：目标插入位置。向下移动时，因源项先“占位”，
// 需要 +1 才能落在视觉目标之后。
export function computeMoveIndex(from: number, to: number): number {
  return to > from ? to + 1 : to;
}

// 把「网格显示位置」换算成 chrome.bookmarks.move 需要的真实索引。
// 网格 items 只包含当前可见项（主页隐藏文件夹、子目录 Tab 书签在前文件夹在后），
// 其显示顺序未必等于父目录里的真实存储索引；必须用每项自身的真实 index 计算，
// 否则在「书签+文件夹混排」的目录里排序会静默错位。
export function resolveMoveIndex(items: { index: number }[], from: number, to: number): number {
  return computeMoveIndex(items[from].index, items[to].index);
}

export function resolveReorderDestination(view: FolderView, from: number, to: number): { parentId: string; index: number } {
  return {
    parentId: !view.activeTabId || view.activeTabId === HOME_TAB_ID ? view.folderId : view.activeTabId,
    index: resolveMoveIndex(view.items, from, to),
  };
}
