'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import SectionHeading from '../SectionHeading';
import SortableStatusCard from '../SortableStatusCard';
import { useCardOrder } from '@/lib/client/useCardOrder';
import type { StatusById, Website } from '@/lib/client/types';

export interface DashboardSummary {
  total: number;
  up: number;
  down: number;
  unknown: number;
}

interface DashboardViewProps {
  summary: DashboardSummary;
  websites: Website[];
  statusById: StatusById;
  onRecheck: (website: Website) => Promise<unknown>;
}

/** Home: solo el dashboard de estado en vivo, con tarjetas reordenables. */
export default function DashboardView({ summary, websites, statusById, onRecheck }: DashboardViewProps) {
  const { orderedWebsites, orderedIds, reorder } = useCardOrder(websites);

  // El PointerSensor arranca solo tras 6px de arrastre: así los clicks en el
  // botón de re-chequeo y en el enlace del sitio siguen funcionando.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) reorder(String(active.id), String(over.id));
  };

  return (
    <>
      <div className="dash-summary mt-6">
        <div className="dash-summary__total text-[54px] leading-none tracking-[0.025em]">
          {String(summary.total).padStart(3, '0')}
        </div>
        <div className="supply-micro hidden md:block" style={{ marginTop: 8 }}>
          SITIOS MONITORIZADOS · {summary.up} OK · {summary.down} FALLO · {summary.unknown} SIN DATOS
        </div>
        {/* Solo mobile: versión compacta con lo relevante. */}
        <div className="dash-summary__compact supply-micro md:hidden">
          <span>SITIOS</span>
          <span> · {summary.up} OK</span>
          <span className={summary.down > 0 ? 'dash-summary__alert' : undefined}> · {summary.down} FALLO</span>
          {summary.unknown > 0 ? <span> · {summary.unknown} SIN DATOS</span> : null}
        </div>
      </div>

      <SectionHeading>Status Dashboard</SectionHeading>

      {orderedWebsites.length === 0 ? (
        <p className="supply-label">No hay sitios registrados todavía.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
            <div className="supply-grid">
              {orderedWebsites.map((website, index) => (
                <SortableStatusCard
                  key={website.id}
                  website={website}
                  status={statusById[website.id]}
                  onRecheck={onRecheck}
                  index={index}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </>
  );
}
