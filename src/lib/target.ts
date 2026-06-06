import { nanoid } from 'nanoid';
import i18n from '../i18n';
import type {
  TargetStatus,
  Workflow,
  WorkflowTarget,
  WorkflowTargetItem,
  WorkflowTargetReview,
} from '../types';

export function createTargetItem(text = ''): WorkflowTargetItem {
  return {
    id: nanoid(),
    text,
    done: false,
    updatedAt: Date.now(),
  };
}

export function emptyTarget(): WorkflowTarget {
  return {
    enabled: false,
    title: '',
    objective: '',
    status: 'draft',
    context: '',
    acceptanceCriteria: [],
    constraints: [],
    checklist: [],
    risks: '',
  };
}

export function normalizeTarget(raw: unknown): WorkflowTarget {
  if (!raw || typeof raw !== 'object') return emptyTarget();
  const t = raw as Partial<WorkflowTarget>;
  return {
    enabled: Boolean(t.enabled),
    title: typeof t.title === 'string' ? t.title : '',
    objective: typeof t.objective === 'string' ? t.objective : '',
    status: isTargetStatus(t.status) ? t.status : 'draft',
    context: typeof t.context === 'string' ? t.context : '',
    acceptanceCriteria: normalizeItems(t.acceptanceCriteria),
    constraints: normalizeItems(t.constraints),
    checklist: normalizeItems(t.checklist),
    risks: typeof t.risks === 'string' ? t.risks : '',
    lastReview: normalizeReview(t.lastReview),
  };
}

export function targetHasContent(target: WorkflowTarget | undefined): boolean {
  if (!target) return false;
  return Boolean(
    target.title.trim() ||
      target.objective.trim() ||
      target.context.trim() ||
      target.risks.trim() ||
      target.acceptanceCriteria.some((i) => i.text.trim()) ||
      target.constraints.some((i) => i.text.trim()) ||
      target.checklist.some((i) => i.text.trim())
  );
}

export function targetProgress(target: WorkflowTarget | undefined): {
  done: number;
  total: number;
  percent: number;
} {
  const checklist = target?.checklist.filter((i) => i.text.trim()) ?? [];
  const total = checklist.length;
  const done = checklist.filter((i) => i.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function targetStatusLabel(status: TargetStatus): string {
  return i18n.t(`target.status.${status}`);
}

export function formatTargetForPrompt(wf: Workflow): string {
  const target = wf.target;
  if (!target?.enabled || !targetHasContent(target)) return '';

  const progress = targetProgress(target);
  const parts = [
    `# ${i18n.t('targetPrompt.heading')}`,
    i18n.t('targetPrompt.instructions'),
    target.title.trim() ? `## ${i18n.t('targetPrompt.title')}\n${target.title.trim()}` : '',
    target.objective.trim()
      ? `## ${i18n.t('targetPrompt.objective')}\n${target.objective.trim()}`
      : '',
    `## ${i18n.t('targetPrompt.status')}\n${targetStatusLabel(target.status)}${
      progress.total ? ` · ${progress.done}/${progress.total}` : ''
    }`,
    target.context.trim()
      ? `## ${i18n.t('targetPrompt.context')}\n${target.context.trim()}`
      : '',
    listSection(i18n.t('targetPrompt.acceptance'), target.acceptanceCriteria),
    listSection(i18n.t('targetPrompt.constraints'), target.constraints),
    listSection(i18n.t('targetPrompt.checklist'), target.checklist, true),
    target.risks.trim() ? `## ${i18n.t('targetPrompt.risks')}\n${target.risks.trim()}` : '',
  ];
  return parts.filter(Boolean).join('\n\n');
}

export function withTargetSystemPrompt(systemPrompt: string, wf: Workflow): string {
  const target = formatTargetForPrompt(wf);
  return [target, systemPrompt].filter(Boolean).join('\n\n');
}

export function withTargetUserMessage(userMessage: string, wf: Workflow): string {
  const target = formatTargetForPrompt(wf);
  if (!target) return userMessage;
  return `${target}\n\n---\n\n${i18n.t('targetPrompt.userTask')}\n${userMessage}`;
}

export function targetRetrievalContext(wf: Workflow, extra = ''): string {
  return [formatTargetForPrompt(wf), extra].filter(Boolean).join('\n\n');
}

export function createTargetReview(wf: Workflow): WorkflowTargetReview | undefined {
  if (!wf.target?.enabled || !targetHasContent(wf.target)) return undefined;
  const progress = targetProgress(wf.target);
  return {
    at: Date.now(),
    status: wf.target.status,
    checklistDone: progress.done,
    checklistTotal: progress.total,
    summary: i18n.t('target.reviewSummary', {
      status: targetStatusLabel(wf.target.status),
      done: progress.done,
      total: progress.total,
      percent: progress.percent,
    }),
  };
}

function normalizeItems(items: unknown): WorkflowTargetItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return createTargetItem(item);
      if (!item || typeof item !== 'object') return null;
      const i = item as Partial<WorkflowTargetItem>;
      return {
        id: typeof i.id === 'string' && i.id ? i.id : nanoid(),
        text: typeof i.text === 'string' ? i.text : '',
        done: Boolean(i.done),
        note: typeof i.note === 'string' ? i.note : undefined,
        updatedAt: typeof i.updatedAt === 'number' ? i.updatedAt : Date.now(),
      };
    })
    .filter((item): item is WorkflowTargetItem => Boolean(item));
}

function normalizeReview(review: unknown): WorkflowTargetReview | undefined {
  if (!review || typeof review !== 'object') return undefined;
  const r = review as Partial<WorkflowTargetReview>;
  if (typeof r.at !== 'number' || typeof r.summary !== 'string') return undefined;
  return {
    at: r.at,
    status: isTargetStatus(r.status) ? r.status : 'draft',
    checklistDone: typeof r.checklistDone === 'number' ? r.checklistDone : 0,
    checklistTotal: typeof r.checklistTotal === 'number' ? r.checklistTotal : 0,
    summary: r.summary,
  };
}

function isTargetStatus(status: unknown): status is TargetStatus {
  return (
    status === 'draft' ||
    status === 'active' ||
    status === 'blocked' ||
    status === 'complete'
  );
}

function listSection(
  title: string,
  items: WorkflowTargetItem[],
  showDone = false
): string {
  const visible = items.filter((i) => i.text.trim());
  if (visible.length === 0) return '';
  const body = visible
    .map((i) => {
      const prefix = showDone ? (i.done ? '[x]' : '[ ]') : '-';
      const note = i.note?.trim() ? ` (${i.note.trim()})` : '';
      return `${prefix} ${i.text.trim()}${note}`;
    })
    .join('\n');
  return `## ${title}\n${body}`;
}
