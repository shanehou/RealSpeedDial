// 拖拽结束后浏览器会在原元素补发一次 click，导致 <a> 原生导航或 <button> onClick 被误触。
// dnd-kit 的 distance 约束与 isDragging 改 href 都不可靠（click 晚于拖拽状态复位）。
// 该守卫在拖拽「开始」时就武装，并在 document 捕获阶段（最外层、早于 React 合成事件）
// 吞掉紧随的那一次 click——时序无关，且能真正 preventDefault 掉链接导航。
export function createDragClickGuard() {
  let armed = false;
  const onClick = (e: Event) => {
    if (!armed) return;
    armed = false; // 只消费紧随拖拽的这一次 click
    e.preventDefault();
    e.stopPropagation();
  };
  return {
    arm() { armed = true; },
    disarm() { armed = false; },
    isArmed() { return armed; },
    install(target: Document | HTMLElement = document): () => void {
      target.addEventListener('click', onClick, true);
      return () => target.removeEventListener('click', onClick, true);
    },
  };
}
