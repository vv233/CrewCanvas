import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MessageSquare, Send, CheckCheck, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DiscussNodeData } from '../../types';
import { useRunStore } from '../../state/runStore';
import { StatusDot } from './StatusDot';

const DISCUSS_STYLE = { background: 'rgba(34, 211, 238, 0.03)' };

export const DiscussNode = memo(function DiscussNode({
  data,
  selected,
  id,
}: NodeProps & { data: DiscussNodeData }) {
  const { t } = useTranslation();
  const state = useRunStore((s) => s.nodeStates[id]);
  const discussion = useRunStore((s) => s.discussions[id]);
  const send = useRunStore((s) => s.sendDiscussionMessage);
  const finish = useRunStore((s) => s.finishDiscussion);

  const [draft, setDraft] = useState('');
  const [summary, setSummary] = useState('');
  const [finishMode, setFinishMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [discussion?.messages, discussion?.phase]);

  const phase = discussion?.phase ?? 'idle';
  const messages = discussion?.messages ?? [];
  const isLive = !!discussion && phase !== 'done' && state?.status === 'running';

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    send(id, text);
    setDraft('');
  };

  const handleFinish = () => {
    finish(id, summary.trim() || undefined);
    setFinishMode(false);
    setSummary('');
  };

  return (
    <div
      className={`card flex w-[380px] flex-col overflow-hidden transition-all ${
        selected
          ? 'border-accent-cool shadow-[0_0_0_2px_rgba(34,211,238,0.2)]'
          : 'border-accent-cool/40'
      }`}
      style={DISCUSS_STYLE}
    >
      <Handle type="target" position={Position.Left} />

      <div className="flex items-center gap-2 border-b border-line/60 px-3 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-cool/15 text-accent-cool">
          <MessageSquare size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">
              {data.avatar} {data.name}
            </span>
            <StatusDot status={state?.status ?? 'idle'} />
          </div>
          <div className="truncate text-[11px] text-muted">
            {t('nodes.discuss.subtitle')} · {data.provider}/{data.model}
          </div>
        </div>
      </div>

      {!discussion ? (
        <div className="px-3 py-4 text-center text-[11px] text-muted">
          {t('nodes.discuss.pauseHint')}
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="nodrag nowheel max-h-[280px] min-h-[120px] space-y-2 overflow-auto px-3 py-2 text-[12px]"
          >
            {messages.length === 0 && phase === 'thinking' ? (
              <div className="flex items-center gap-1.5 text-muted">
                <Loader2 size={11} className="animate-spin" /> {t('nodes.discuss.preparing')}
              </div>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === 'user'
                    ? 'ml-6 rounded bg-accent/15 px-2 py-1.5 text-ink/90'
                    : 'mr-6 rounded bg-bg-soft px-2 py-1.5 text-ink/90'
                }
              >
                <div className="mb-0.5 text-[10px] font-semibold text-muted">
                  {m.role === 'user' ? t('nodes.discuss.you') : t('nodes.discuss.ai')}
                </div>
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
              </div>
            ))}
            {phase === 'thinking' && messages[messages.length - 1]?.role === 'user' ? (
              <div className="flex items-center gap-1.5 text-muted">
                <Loader2 size={11} className="animate-spin" /> {t('nodes.discuss.thinking')}
              </div>
            ) : null}
          </div>

          {phase === 'done' ? (
            <div className="border-t border-line/60 bg-emerald-400/5 px-3 py-2 text-[11px] text-emerald-300">
              <CheckCheck size={12} className="mr-1 inline" /> {t('nodes.discuss.done')}
            </div>
          ) : !isLive ? (
            <div className="border-t border-line/60 px-3 py-2 text-[11px] text-muted">
              {t('nodes.discuss.notRunning')}
            </div>
          ) : finishMode ? (
            <div className="space-y-2 border-t border-line/60 px-3 py-2">
              <textarea
                className="nodrag input min-h-[60px] resize-y text-[12px]"
                placeholder={t('nodes.discuss.summaryPlaceholder')}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <div className="flex gap-1">
                <button
                  className="btn-ghost h-7 flex-1 text-[12px]"
                  onClick={() => setFinishMode(false)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="btn-primary h-7 flex-1 text-[12px]"
                  onClick={handleFinish}
                >
                  <CheckCheck size={12} /> {t('nodes.discuss.finish')}
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-line/60 px-3 py-2">
              <div className="flex gap-1">
                <textarea
                  className="nodrag input min-h-[36px] resize-y text-[12px]"
                  placeholder={
                    phase === 'thinking'
                      ? t('nodes.discuss.replyingPlaceholder')
                      : t('nodes.discuss.replyPlaceholder')
                  }
                  value={draft}
                  disabled={phase === 'thinking'}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
              </div>
              <div className="mt-1 flex gap-1">
                <button
                  className="btn-ghost h-6 flex-1 text-[11px]"
                  onClick={() => setFinishMode(true)}
                  disabled={messages.length === 0}
                >
                  <CheckCheck size={11} /> {t('nodes.discuss.finishDiscussion')}
                </button>
                <button
                  className="btn-primary h-6 flex-1 text-[11px]"
                  onClick={handleSend}
                  disabled={phase === 'thinking' || !draft.trim()}
                >
                  <Send size={11} /> {t('nodes.discuss.send')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
});
