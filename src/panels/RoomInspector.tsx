import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import type { AgentNodeData, FlowNode, RoomNodeData } from '../types';

interface Props {
  node: FlowNode & { data: RoomNodeData };
}

export function RoomInspector({ node }: Props) {
  const { t } = useTranslation();
  const update = useWorkflowStore((s) => s.updateNodeData);
  const remove = useWorkflowStore((s) => s.removeNode);
  const workflow = useWorkflowStore((s) => s.workflow);
  const d = node.data;

  const members = workflow.nodes.filter(
    (n) =>
      (n as FlowNode & { parentId?: string }).parentId === node.id &&
      n.type === 'agent'
  ) as (FlowNode & { data: AgentNodeData })[];

  return (
    <div className="space-y-3">
      <div>
        <div className="label mb-1">{t('inspector.name')}</div>
        <input
          className="input"
          value={d.name}
          onChange={(e) => update(node.id, { name: e.target.value })}
        />
      </div>
      <div>
        <div className="label mb-1">{t('roomInspector.modeLabel')}</div>
        <select
          className="input"
          value={d.mode}
          onChange={(e) =>
            update(node.id, { mode: e.target.value as RoomNodeData['mode'] })
          }
        >
          <option value="round-robin">{t('roomInspector.modeRoundRobin')}</option>
          <option value="moderator">{t('roomInspector.modeModerator')}</option>
          <option value="race">{t('roomInspector.modeRace')}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="label mb-1">{t('roomInspector.maxRounds')}</div>
          <input
            type="number"
            min={1}
            max={20}
            className="input"
            value={d.maxRounds}
            onChange={(e) =>
              update(node.id, { maxRounds: parseInt(e.target.value) || 1 })
            }
          />
        </div>
        {d.mode === 'moderator' ? (
          <div>
            <div className="label mb-1">{t('roomInspector.minTurns')}</div>
            <input
              type="number"
              min={1}
              max={10}
              className="input"
              value={d.minTurnsPerSpeaker ?? 2}
              onChange={(e) =>
                update(node.id, {
                  minTurnsPerSpeaker: parseInt(e.target.value) || 1,
                })
              }
            />
          </div>
        ) : null}
      </div>
      {d.mode === 'moderator' ? (
        <>
          <div>
            <div className="label mb-1">{t('roomInspector.moderatorLabel')}</div>
            <select
              className="input"
              value={d.moderatorId ?? ''}
              onChange={(e) => update(node.id, { moderatorId: e.target.value })}
            >
              <option value="">{t('roomInspector.moderatorAuto')}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.data.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="label mb-1">{t('roomInspector.moderatorPromptLabel')}</div>
            <textarea
              className="input min-h-[120px] resize-y font-mono text-[11px]"
              value={d.moderatorPrompt ?? ''}
              onChange={(e) => update(node.id, { moderatorPrompt: e.target.value })}
            />
            <div className="mt-1 text-[10px] text-muted">
              {t('roomInspector.moderatorVars')} <code>{'{{var.members}}'}</code>、
              <code>{'{{var.history}}'}</code>。 {t('roomInspector.moderatorReturns')}{' '}
              <code>{'{"next":"name"}'}</code> {t('roomInspector.or')}{' '}
              <code>{'{"stop":true,"summary":"..."}'}</code>
            </div>
          </div>
        </>
      ) : null}
      <div>
        <div className="label mb-1">{t('roomInspector.stopKeywordLabel')}</div>
        <input
          className="input"
          value={d.stopKeyword ?? ''}
          placeholder={t('roomInspector.stopKeywordPlaceholder')}
          onChange={(e) => update(node.id, { stopKeyword: e.target.value })}
        />
      </div>

      <div className="rounded-md bg-bg-soft p-2 text-[11px]">
        <div className="mb-1 font-semibold text-ink">
          {t('roomInspector.membersTitle', { count: members.length })}
        </div>
        {members.length === 0 ? (
          <div className="text-muted">{t('roomInspector.membersEmpty')}</div>
        ) : (
          <ul className="space-y-1">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-1 text-ink/90">
                <span>{m.data.avatar}</span>
                <span>{m.data.name}</span>
                <span className="text-muted">({m.data.model})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button className="btn-danger w-full" onClick={() => remove(node.id)}>
        <Trash2 size={14} /> {t('roomInspector.deleteRoom')}
      </button>
    </div>
  );
}
