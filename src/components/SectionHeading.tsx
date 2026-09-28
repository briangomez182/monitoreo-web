import type { ReactNode } from 'react';

export default function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-heading flex items-end justify-between gap-3 mt-10 mb-3">
      <h2 className="supply-heading m-0">{children}</h2>
      {action}
    </div>
  );
}
