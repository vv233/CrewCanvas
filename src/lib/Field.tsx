import type { ReactNode } from 'react';

/** Label + control wrapper shared by every inspector and dialog form.
 *  Previously this was copy-pasted into 5+ panel files. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      {children}
    </div>
  );
}
