import { useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MessageSquare, Send, CheckCheck, Loader2 } from 'lucide-react';
import type { DiscussNodeData } from '../../types';
import { useRunStore } from '../../state/runStore';
import { StatusDot } from './StatusDot';

export function DiscussNode({
  data,
  selected,
  id,
}: NodeProps & { data: DiscussNodeData }) {
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
      style={{ background: 'rgba(34, 211, 238, 0.03)' }}
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
            与用户讨论 · {data.provider}/{data.model}
          </div>
        </div>
      </div>

      {!discussion ? (
        <div className="px-3 py-4 text-center text-[11px] text-muted">
          运行到此节点时会暂停，等你和 AI 讨论
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="nodrag nowheel max-h-[280px] min-h-[120px] space-y-2 overflow-auto px-3 py-2 text-[12px]"
          >
            {messages.length === 0 && phase === 'thinking' ? (
              <div className="flex items-center gap-1.5 text-muted">
                <Loader2 size={11} className="animate-spin" /> AI 正在准备开场…
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
                  {m.role === 'user' ? '你' : 'AI'}
                </div>
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
              </div>
            ))}
            {phase === 'thinking' && messages[messages.length - 1]?.role === 'user' ? (
              <div className="flex items-center gap-1.5 text-muted">
                <Loader2 size={11} className="animate-spin" /> AI 思考中…
              </div>
            ) : null}
          </div>

          {phase === 'done' ? (
            <div className="border-t border-line/60 bg-emerald-400/5 px-3 py-2 text-[11px] text-emerald-300">
              <CheckCheck size={12} className="mr-1 inline" /> 讨论已完成，结果已传给下游
            </div>
          ) : !isLive ? (
            <div className="border-t border-line/60 px-3 py-2 text-[11px] text-muted">
              未在运行中
            </div>
          ) : finishMode ? (
            <div className="space-y-2 border-t border-line/60 px-3 py-2">
              <textarea
                className="nodrag input min-h-[60px] resize-y text-[12px]"
                placeholder="可选：写一段最终方案作为下游输入。留空则用最后一条 AI 回复。"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <div className="flex gap-1">
                <button
                  className="btn-ghost h-7 flex-1 text-[12px]"
                  onClick={() => setFinishMode(false)}
                >
                  取消
                </button>
                <button
                  className="btn-primary h-7 flex-1 text-[12px]"
                  onClick={handleFinish}
                >
                  <CheckCheck size={12} /> 完成
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-line/60 px-3 py-2">
              <div className="flex gap-1">
                <textarea
                  className="nodrag input min-h-[36px] resize-y text-[12px]"
                  placeholder={
                    phase === 'thinking' ? 'AI 回复中…' : '回复 AI（Enter 发送，Shift+Enter 换行）'
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
                  <CheckCheck size={11} /> 完成讨论
                </button>
                <button
                  className="btn-primary h-6 flex-1 text-[11px]"
                  onClick={handleSend}
                  disabled={phase === 'thinking' || !draft.trim()}
                >
                  <Send size={11} /> 发送
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
