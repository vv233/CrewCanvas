import { Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../state/workflowStore';
import type { AgentNodeData, FlowNode, ProviderId } from '../types';
import { MODEL_OPTIONS } from '../providers/models';
import { MonacoSoul } from '../lib/MonacoSoul';
import { SOUL_PRESETS } from '../templates/soulPresets';
import { McpServersField } from './McpServersField';
import { AgentKnowledgeField } from './AgentKnowledgeField';

interface Props {
  node: FlowNode & { data: AgentNodeData };
}

export function AgentInspector({ node }: Props) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const remove = useWorkflowStore((s) => s.removeNode);
  const workflowId = useWorkflowStore((s) => s.workflow.id);
  const d = node.data;

  return (
    <div className="space-y-3">
      <Field label="头像 (emoji)">
        <input
          className="input"
          value={d.avatar}
          maxLength={4}
          onChange={(e) => update(node.id, { avatar: e.target.value })}
        />
      </Field>
      <Field label="名字">
        <input
          className="input"
          value={d.name}
          onChange={(e) => update(node.id, { name: e.target.value })}
        />
      </Field>

      <Field label="供应商">
        <select
          className="input"
          value={d.provider}
          onChange={(e) => {
            const provider = e.target.value as ProviderId;
            const firstModel = MODEL_OPTIONS[provider][0]?.id ?? '';
            update(node.id, { provider, model: firstModel });
          }}
        >
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="openrouter">OpenRouter</option>
          <option value="ollama">Ollama (本地)</option>
          <option value="lmstudio">LM Studio (本地)</option>
        </select>
      </Field>
      <Field label="模型">
        <input
          className="input font-mono text-[12px]"
          list={`models-${d.provider}`}
          value={d.model}
          onChange={(e) => update(node.id, { model: e.target.value })}
          placeholder="选一个或输入模型 id"
        />
        <datalist id={`models-${d.provider}`}>
          {MODEL_OPTIONS[d.provider].map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </datalist>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Temperature">
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            className="input"
            value={d.temperature}
            onChange={(e) =>
              update(node.id, { temperature: parseFloat(e.target.value) || 0 })
            }
          />
        </Field>
        <Field label="Max tokens">
          <input
            type="number"
            step="128"
            min="64"
            className="input"
            value={d.maxTokens}
            onChange={(e) =>
              update(node.id, { maxTokens: parseInt(e.target.value) || 1024 })
            }
          />
        </Field>
      </div>

      <Field label="记忆">
        <select
          className="input"
          value={d.memory}
          onChange={(e) =>
            update(node.id, { memory: e.target.value as 'none' | 'session' })
          }
        >
          <option value="session">本次运行内记忆</option>
          <option value="none">无记忆（每次清空）</option>
        </select>
      </Field>

      <Field label="soul.md（角色/性格/职责）">
        <div className="mb-1 flex gap-1">
          <select
            className="input h-7 text-[11px]"
            value=""
            onChange={(e) => {
              const preset = SOUL_PRESETS.find((p) => p.id === e.target.value);
              if (preset) {
                if (
                  d.soul.trim() &&
                  !confirm('当前 soul.md 已有内容，确定用模板覆盖？')
                )
                  return;
                update(node.id, { name: preset.name, avatar: preset.avatar, soul: preset.soul });
              }
            }}
          >
            <option value="">从模板填充…</option>
            {SOUL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.avatar} {p.name}
              </option>
            ))}
          </select>
        </div>
        <MonacoSoul
          value={d.soul}
          onChange={(v) => update(node.id, { soul: v })}
          minHeight={280}
        />
        <div className="mt-1 text-[10px] text-muted">
          支持变量：<code>{'{{input}}'}</code>、<code>{'{{upstream.节点名}}'}</code>、
          <code>{'{{var.X}}'}</code>
        </div>
      </Field>

      <McpServersField
        value={d.mcpServers ?? []}
        provider={d.provider}
        onChange={(mcpServers) => update(node.id, { mcpServers })}
      />

      <AgentKnowledgeField
        value={d.knowledge}
        workflowId={workflowId}
        agentNodeId={node.id}
        onChange={(knowledge) => update(node.id, { knowledge })}
      />

      <button
        className="btn-danger w-full"
        onClick={() => remove(node.id)}
      >
        <Trash2 size={14} /> 删除节点
      </button>
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
