import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Plus,
  Save,
  Target as TargetIcon,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createTargetItem, emptyTarget, normalizeTarget, targetProgress } from '../lib/target';
import { useWorkflowStore } from '../state/workflowStore';
import type { TargetStatus, WorkflowTarget, WorkflowTargetItem } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

type ItemKey = 'acceptanceCriteria' | 'constraints' | 'checklist';

export function TargetDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const workflowTarget = useWorkflowStore((s) => s.workflow.target);
  const setTarget = useWorkflowStore((s) => s.setTarget);
  const [draft, setDraft] = useState<WorkflowTarget>(() => normalizeTarget(workflowTarget));

  useEffect(() => {
    if (open) setDraft(normalizeTarget(workflowTarget));
  }, [open, workflowTarget]);

  const progress = useMemo(() => targetProgress(draft), [draft]);

  if (!open) return null;

  const patch = (partial: Partial<WorkflowTarget>) => {
    setDraft((prev) => normalizeTarget({ ...prev, ...partial }));
  };

  const save = () => {
    setTarget(draft);
    onClose();
  };

  const clear = () => {
    if (!confirm(t('target.clearConfirm'))) return;
    setTarget(emptyTarget());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card flex h-full max-h-none w-full max-w-5xl flex-col rounded-none sm:h-auto sm:max-h-[90vh] sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-ink">
              <TargetIcon size={17} className="text-accent" />
              {t('target.title')}
            </div>
            <div className="mt-1 text-[11px] text-muted">
              {progress.total
                ? t('target.progress', {
                    done: progress.done,
                    total: progress.total,
                    percent: progress.percent,
                  })
                : t('target.noChecklist')}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button className="btn-ghost" onClick={clear}>
              <Trash2 size={14} /> {t('target.clear')}
            </button>
            <button className="btn-primary" onClick={save}>
              <Save size={14} /> {t('common.save')}
            </button>
            <button className="btn-ghost" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
            <div className="space-y-4">
              <div className="card space-y-3 px-3 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => patch({ enabled: e.target.checked })}
                  />
                  {t('target.enabled')}
                </label>

                <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                  <Field label={t('target.nameLabel')}>
                    <input
                      className="input"
                      value={draft.title}
                      placeholder={t('target.namePlaceholder')}
                      onChange={(e) => patch({ title: e.target.value })}
                    />
                  </Field>
                  <Field label={t('target.statusLabel')}>
                    <select
                      className="input"
                      value={draft.status}
                      onChange={(e) => patch({ status: e.target.value as TargetStatus })}
                    >
                      {(['draft', 'active', 'blocked', 'complete'] as TargetStatus[]).map(
                        (status) => (
                          <option key={status} value={status}>
                            {t(`target.status.${status}`)}
                          </option>
                        )
                      )}
                    </select>
                  </Field>
                </div>

                <Field label={t('target.objectiveLabel')}>
                  <textarea
                    className="input min-h-[120px] resize-y text-[13px]"
                    value={draft.objective}
                    placeholder={t('target.objectivePlaceholder')}
                    onChange={(e) => patch({ objective: e.target.value })}
                  />
                </Field>

                <Field label={t('target.contextLabel')}>
                  <textarea
                    className="input min-h-[96px] resize-y text-[13px]"
                    value={draft.context}
                    placeholder={t('target.contextPlaceholder')}
                    onChange={(e) => patch({ context: e.target.value })}
                  />
                </Field>

                <Field label={t('target.risksLabel')}>
                  <textarea
                    className="input min-h-[80px] resize-y text-[13px]"
                    value={draft.risks}
                    placeholder={t('target.risksPlaceholder')}
                    onChange={(e) => patch({ risks: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-4">
              <TargetList
                title={t('target.acceptanceTitle')}
                items={draft.acceptanceCriteria}
                placeholder={t('target.acceptancePlaceholder')}
                onChange={(items) => patch({ acceptanceCriteria: items })}
              />
              <TargetList
                title={t('target.constraintsTitle')}
                items={draft.constraints}
                placeholder={t('target.constraintsPlaceholder')}
                onChange={(items) => patch({ constraints: items })}
              />
              <TargetList
                title={t('target.checklistTitle')}
                items={draft.checklist}
                placeholder={t('target.checklistPlaceholder')}
                checklist
                onChange={(items) => patch({ checklist: items })}
              />

              {draft.lastReview ? (
                <div className="rounded-md border border-line bg-bg-soft p-3 text-[12px]">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-ink">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    {t('target.lastReview')}
                  </div>
                  <div className="text-muted">
                    {new Date(draft.lastReview.at).toLocaleString()}
                  </div>
                  <div className="mt-2 text-ink/90">{draft.lastReview.summary}</div>
                </div>
              ) : (
                <div className="rounded-md border border-line bg-bg-soft p-3 text-[12px] text-muted">
                  <AlertTriangle size={14} className="mr-1 inline text-amber-400" />
                  {t('target.noReview')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TargetList({
  title,
  items,
  placeholder,
  checklist = false,
  onChange,
}: {
  title: string;
  items: WorkflowTargetItem[];
  placeholder: string;
  checklist?: boolean;
  onChange: (items: WorkflowTargetItem[]) => void;
}) {
  const { t } = useTranslation();

  const update = (id: string, patch: Partial<WorkflowTargetItem>) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item
      )
    );
  };

  return (
    <div className="card space-y-2 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="label">{title}</div>
        <button
          className="btn-ghost h-7 px-2 text-[11px]"
          onClick={() => onChange([...items, createTargetItem()])}
        >
          <Plus size={12} /> {t('common.add')}
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <button
            className="w-full rounded-md border border-dashed border-line px-3 py-3 text-center text-[12px] text-muted hover:border-accent/60 hover:text-ink"
            onClick={() => onChange([createTargetItem()])}
          >
            {placeholder}
          </button>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              {checklist ? (
                <button
                  className="mt-1 rounded p-0.5 text-muted hover:bg-bg hover:text-ink"
                  onClick={() => update(item.id, { done: !item.done })}
                  title={item.done ? t('target.markOpen') : t('target.markDone')}
                >
                  {item.done ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : (
                    <Circle size={16} />
                  )}
                </button>
              ) : null}
              <textarea
                className="input min-h-10 min-w-0 flex-1 resize-y text-[12px]"
                value={item.text}
                placeholder={placeholder}
                onChange={(e) => update(item.id, { text: e.target.value })}
              />
              <button
                className="mt-0.5 rounded p-1 text-muted hover:bg-bg hover:text-accent-danger"
                onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                title={t('common.delete')}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      {children}
    </div>
  );
}
