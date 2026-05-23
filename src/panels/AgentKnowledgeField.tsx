import { BookOpen } from 'lucide-react';
import type { AgentKnowledge } from '../types';
import { RagSourcesPanel } from './RagSourcesPanel';

interface Props {
  value: AgentKnowledge | undefined;
  onChange: (next: AgentKnowledge) => void;
  workflowId: string;
  agentNodeId: string;
}

/** Agent-private knowledge editor. Inline text stays in the prompt; uploaded
 * files now go into the local RAG index and are retrieved automatically. */
export function AgentKnowledgeField({
  value,
  onChange,
  workflowId,
  agentNodeId,
}: Props) {
  const inline = value?.inline ?? '';
  const legacyFiles = value?.files ?? [];

  const setInline = (text: string) =>
    onChange({ inline: text, files: legacyFiles });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <BookOpen size={11} className="text-muted" />
        <span className="label">知识库</span>
      </div>

      <div>
        <div className="mb-0.5 text-[10px] uppercase tracking-wider text-muted">
          内联背景（拼到 system prompt，每次都看得到）
        </div>
        <textarea
          className="input min-h-[60px] resize-y text-[11px]"
          placeholder="例：你是 ACME 公司的内部助理。公司刚发布新版本 v3.2，重要变更：..."
          value={inline}
          onChange={(e) => setInline(e.target.value)}
        />
      </div>

      <RagSourcesPanel
        workflowId={workflowId}
        scope="agent"
        agentNodeId={agentNodeId}
        title="私有资料库"
        compact
      />

      <div className="text-[10px] leading-relaxed text-muted">
        <strong className="text-ink/70">内联</strong>：短的、必看的信息。
        <strong className="text-ink/70">私有资料库</strong>：长资料会自动索引，并在运行时按任务检索。
      </div>
    </div>
  );
}
