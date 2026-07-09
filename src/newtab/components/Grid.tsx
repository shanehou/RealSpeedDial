import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SpeedDialItem } from '@/types';
import { Tile } from './Tile';
import { FolderTile } from './FolderTile';

interface Props {
  items: SpeedDialItem[];
  columns: number;
  thumbnails: Record<string, string>;
  onOpen: (url: string) => void;
  onEnter: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onReorder: (activeId: string, fromIndex: number, toIndex: number) => void;
  onMoveInto: (activeId: string, folderId: string) => void;
}

function SortableCell({ item, children }: { item: SpeedDialItem; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export function Grid({ items, columns, thumbnails, onOpen, onEnter, onContextMenu, onReorder, onMoveInto }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (e: DragEndEvent) => {
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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {items.map((it) => (
            <SortableCell key={it.id} item={it}>
              {it.kind === 'bookmark' ? (
                <Tile id={it.id} title={it.title} url={it.url} thumbnail={thumbnails[it.url]} onOpen={onOpen} onContextMenu={onContextMenu} />
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
export { arrayMove };
