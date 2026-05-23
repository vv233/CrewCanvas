import type { NodeRunState } from '../../types';

const COLORS: Record<NodeRunState['status'], string> = {
  idle: 'bg-muted/40',
  queued: 'bg-accent-cool/60',
  running: 'bg-accent-warm animate-pulse',
  done: 'bg-emerald-400',
  error: 'bg-accent-danger',
  skipped: 'bg-muted/30',
};

export function StatusDot({ status }: { status: NodeRunState['status'] }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${COLORS[status]}`}
      title={status}
    />
  );
}
