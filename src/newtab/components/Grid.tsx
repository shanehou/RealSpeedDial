import { useEffect, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SpeedDialItem, TileStyle, ThumbnailRecord } from '@/types';
import { Tile } from './Tile';
import { FolderTile } from './FolderTile';
import { createDragClickGuard } from '@/lib/dragClickGuard';

interface Props {
  items: SpeedDialItem[];
  columns: number;
  thumbnails: Record<string, ThumbnailRecord>;
  tileStyle: TileStyle;
  openInNewTab: boolean;
  onEnter: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onReorder: (activeId: string, fromIndex: number, toIndex: number) => void;
  onMoveInto: (activeId: string, folderId: string) => void;
}

function SortableCell({ item, children }: { item: SpeedDialItem; children: React.ReactNode }) {
  // 只铺 listeners（指针拖拽）；不铺 attributes，避免包裹 div 被加上 role="button"/tabIndex
  // 而与内层磁贴 <button> 形成嵌套可交互元素（无 KeyboardSensor，attributes 也无收益）。
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      className="grid__cell"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
    >
      {children}
    </div>
  );
}

export function Grid({ items, columns, thumbnails, tileStyle, openInNewTab, onEnter, onContextMenu, onReorder, onMoveInto }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  // 见 dragClickGuard：拖拽一开始就武装，在 document 捕获层吞掉拖拽结束后补发的那次 click。
  const guardRef = useRef(createDragClickGuard());
  useEffect(() => guardRef.current.install(document), []);

  const handleDragStart = () => { guardRef.current.arm(); };
  const handleDragCancel = () => { guardRef.current.disarm(); };

  const handleDragEnd = (e: DragEndEvent) => {
    // 兜底：拖拽若没有产生 click（松手在空白处），下一 tick 解除武装，避免误吞后续点击。
    window.setTimeout(() => guardRef.current.disarm(), 0);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overItem = items.find((it) => it.id === over.id);
    if (overItem?.kind === 'folder') { onMoveInto(activeId, overItem.id); return; }
    const from = items.findIndex((it) => it.id === active.id);
    const to = items.findIndex((it) => it.id === over.id);
    if (from !== -1 && to !== -1) onReorder(activeId, from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragCancel={handleDragCancel} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="grid" style={{ ['--cols']: String(columns) } as React.CSSProperties}>
          {items.map((it) => (
            <SortableCell key={it.id} item={it}>
              {it.kind === 'bookmark' ? (
                <Tile id={it.id} title={it.title} url={it.url} thumbnail={thumbnails[it.url]?.dataUrl} region={thumbnails[it.url]?.region} tileStyle={tileStyle} openInNewTab={openInNewTab} onContextMenu={onContextMenu} />
              ) : (
                <FolderTile id={it.id} title={it.title} preview={it.childrenPreview} onEnter={onEnter} onContextMenu={onContextMenu} />
              )}
            </SortableCell>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
