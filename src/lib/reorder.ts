// Chrome bookmarks.move 的 index 语义：目标插入位置。向下移动时，因源项先“占位”，
// 需要 +1 才能落在视觉目标之后。
export function computeMoveIndex(from: number, to: number): number {
  return to > from ? to + 1 : to;
}
