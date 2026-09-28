'use client';

import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import StatusCard from './StatusCard';
import type { Website, WebsiteStatus } from '@/lib/client/types';

interface SortableStatusCardProps {
  website: Website;
  status: WebsiteStatus | undefined;
  onRecheck?: (website: Website) => Promise<unknown>;
  index: number;
}

/**
 * Envuelve StatusCard con la mecánica sortable de @dnd-kit. La tarjeta se
 * mueve mediante el asa de arrastre de su cabecera; el resto (botón de
 * re-chequeo, enlace del sitio) sigue siendo clicable.
 */
export default function SortableStatusCard({ website, status, onRecheck, index }: SortableStatusCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: website.id,
    // Deslizamiento más largo y suave al hacer hueco y al soltar la tarjeta
    // (por defecto son 200ms/ease). Mismo easing que el resto del sistema.
    transition: { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <StatusCard
      ref={setNodeRef}
      style={style}
      website={website}
      status={status}
      onRecheck={onRecheck}
      index={index}
      isDragging={isDragging}
      dragHandleRef={setActivatorNodeRef}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}
