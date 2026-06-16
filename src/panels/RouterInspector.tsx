import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import type { FlowNode, RouterNodeData } from '../types';
import { ProviderModelSelector } from '../lib/ProviderModelSelector';

interface Props {
  node: FlowNode & { data: RouterNodeData };
}

export function RouterInspector({ node }: Props) {
  const { t } = useTranslation();
  const update = useWorkflowStore((s) => s.updateNodeData);
  const remove = useWorkflowStore((s) => s.removeNode);
  const d = node.data;
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
        <div className="label mb-1">{t('routerInspector.ruleLabel')}</div>
        <select
          className="input"
          value={d.rule}
          onChange={(e) =>
            update(node.id, { rule: e.target.value as RouterNodeData['rule'] })
          }
        >
          <option value="llm-judge">{t('routerInspector.ruleLlmJudge')}</option>
          <option value="regex">{t('routerInspector.ruleRegex')}</option>
        </select>
      </div>
      {d.rule === 'regex' ? (
        <div>
          <div className="label mb-1">{t('routerInspector.patternLabel')}</div>
          <input
            className="input font-mono"
            value={d.pattern}
            onChange={(e) => update(node.id, { pattern: e.target.value })}
            placeholder={t('routerInspector.patternPlaceholder')}
          />
        </div>
      ) : (
        <>
          <div>
            <div className="label mb-1">{t('routerInspector.judgePromptLabel')}</div>
            <textarea
              className="input min-h-[80px] resize-y text-[13px]"
              value={d.prompt ?? ''}
              placeholder={t('routerInspector.judgePromptPlaceholder')}
              onChange={(e) => update(node.id, { prompt: e.target.value })}
            />
            <div className="mt-1 text-[10px] text-muted">{t('routerInspector.judgeHint')}</div>
          </div>
          <ProviderModelSelector
            idPrefix="router-models"
            provider={d.provider ?? 'openrouter'}
            model={d.model ?? ''}
            onChange={(next) => update(node.id, next)}
          />
        </>
      )}
      <button className="btn-danger w-full" onClick={() => remove(node.id)}>
        <Trash2 size={14} /> {t('inspector.deleteNode')}
      </button>
    </div>
  );
}
