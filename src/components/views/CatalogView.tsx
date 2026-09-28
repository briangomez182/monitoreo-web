import SectionHeading from '../SectionHeading';
import WebsiteTable from '../WebsiteTable';
import type { StatusById, Website } from '@/lib/client/types';

interface CatalogViewProps {
  websites: Website[];
  statusById: StatusById;
  onEdit: (website: Website) => void;
  onDelete: (website: Website) => void;
}

/** Vista de gestión: el listado de URLs y el alta/edición de sitios. */
export default function CatalogView({ websites, statusById, onEdit, onDelete }: CatalogViewProps) {
  return (
    <>
      <SectionHeading>
        Catálogo · {websites.length} {websites.length === 1 ? 'sitio' : 'sitios'}
      </SectionHeading>

      <WebsiteTable
        websites={websites}
        statusById={statusById}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </>
  );
}
