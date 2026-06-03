import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const inline = value?.inline ?? '';
  const legacyFiles = value?.files ?? [];

  const setInline = (text: string) =>
    onChange({ inline: text, files: legacyFiles });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <BookOpen size={11} className="text-muted" />
        <span className="label">{t('knowledge.title')}</span>
      </div>

      <div>
        <div className="mb-0.5 text-[10px] uppercase tracking-wider text-muted">
          {t('knowledge.inlineLabel')}
        </div>
        <textarea
          className="input min-h-[60px] resize-y text-[11px]"
          placeholder={t('knowledge.inlinePlaceholder')}
          value={inline}
          onChange={(e) => setInline(e.target.value)}
        />
      </div>

      <RagSourcesPanel
        workflowId={workflowId}
        scope="agent"
        agentNodeId={agentNodeId}
        title={t('knowledge.privateLibrary')}
        compact
      />

      <div className="text-[10px] leading-relaxed text-muted">
        <strong className="text-ink/70">{t('knowledge.footerInline')}</strong>
        {t('knowledge.footerInlineDesc')}
        <strong className="text-ink/70">{t('knowledge.footerLibrary')}</strong>
        {t('knowledge.footerLibraryDesc')}
      </div>
    </div>
  );
}
