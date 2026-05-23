import { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useSettingsStore } from '../state/settingsStore';
import { getProvider } from '../providers/registry';
import type { ProviderId } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

type PingState = 'idle' | 'pinging' | 'ok' | 'fail';

export function SettingsDialog({ open, onClose }: Props) {
  const s = useSettingsStore();
  const [pingState, setPingState] = useState<Record<ProviderId, PingState>>({
    anthropic: 'idle',
    openai: 'idle',
    ollama: 'idle',
    openrouter: 'idle',
    lmstudio: 'idle',
  });
  const [pingMsg, setPingMsg] = useState<Record<ProviderId, string>>({
    anthropic: '',
    openai: '',
    ollama: '',
    openrouter: '',
    lmstudio: '',
  });

  const test = async (id: ProviderId) => {
    setPingState((p) => ({ ...p, [id]: 'pinging' }));
    setPingMsg((m) => ({ ...m, [id]: '' }));
    try {
      await getProvider(id).ping();
      setPingState((p) => ({ ...p, [id]: 'ok' }));
      setPingMsg((m) => ({ ...m, [id]: '连接成功' }));
    } catch (err) {
      setPingState((p) => ({ ...p, [id]: 'fail' }));
      setPingMsg((m) => ({
        ...m,
        [id]: err instanceof Error ? err.message : String(err),
      }));
    }
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[90vh] w-full max-w-2xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="text-base font-semibold text-ink">设置</div>
          <button className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="space-y-5 overflow-auto px-4 py-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-[12px] text-amber-200/90">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">关于浏览器直连 API</div>
              <p className="mt-1 text-amber-100/80">
                你的 API key 仅保存在本浏览器的 localStorage，所有请求由浏览器直接发往
                模型服务商。**请只在你自己的设备上使用**，不要在公共/共享电脑保存
                key。后续版本将提供主密码加密。
              </p>
            </div>
          </div>

          <Section
            title="Anthropic"
            test={
              <PingButton
                state={pingState.anthropic}
                msg={pingMsg.anthropic}
                onClick={() => test('anthropic')}
              />
            }
          >
            <Field label="API Key">
              <input
                className="input"
                type="password"
                placeholder="sk-ant-..."
                value={s.anthropicKey}
                onChange={(e) => s.update({ anthropicKey: e.target.value })}
              />
            </Field>
            <Field label="Base URL">
              <input
                className="input"
                value={s.anthropicBaseUrl}
                onChange={(e) => s.update({ anthropicBaseUrl: e.target.value })}
              />
            </Field>
          </Section>

          <Section
            title="OpenAI"
            test={
              <PingButton
                state={pingState.openai}
                msg={pingMsg.openai}
                onClick={() => test('openai')}
              />
            }
          >
            <Field label="API Key">
              <input
                className="input"
                type="password"
                placeholder="sk-..."
                value={s.openaiKey}
                onChange={(e) => s.update({ openaiKey: e.target.value })}
              />
            </Field>
            <Field label="Base URL（可填代理/兼容服务）">
              <input
                className="input"
                value={s.openaiBaseUrl}
                onChange={(e) => s.update({ openaiBaseUrl: e.target.value })}
              />
            </Field>
          </Section>

          <Section
            title="OpenRouter"
            test={
              <PingButton
                state={pingState.openrouter}
                msg={pingMsg.openrouter}
                onClick={() => test('openrouter')}
              />
            }
          >
            <Field label="API Key">
              <input
                className="input"
                type="password"
                placeholder="sk-or-..."
                value={s.openrouterKey}
                onChange={(e) => s.update({ openrouterKey: e.target.value })}
              />
            </Field>
            <Field label="Base URL">
              <input
                className="input"
                value={s.openrouterBaseUrl}
                onChange={(e) => s.update({ openrouterBaseUrl: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="HTTP-Referer（可选）">
                <input
                  className="input"
                  placeholder="留空自动用本站域名"
                  value={s.openrouterReferer}
                  onChange={(e) => s.update({ openrouterReferer: e.target.value })}
                />
              </Field>
              <Field label="X-Title（可选）">
                <input
                  className="input"
                  value={s.openrouterTitle}
                  onChange={(e) => s.update({ openrouterTitle: e.target.value })}
                />
              </Field>
            </div>
            <p className="text-[11px] text-muted">
              一个 key 调用所有模型，模型 id 形如{' '}
              <code>anthropic/claude-sonnet-4</code>。Referer / Title 会显示在
              OpenRouter dashboard。
            </p>
          </Section>

          <Section
            title="LM Studio (本地)"
            test={
              <PingButton
                state={pingState.lmstudio}
                msg={pingMsg.lmstudio}
                onClick={() => test('lmstudio')}
              />
            }
          >
            <Field label="Base URL">
              <input
                className="input"
                value={s.lmstudioBaseUrl}
                onChange={(e) => s.update({ lmstudioBaseUrl: e.target.value })}
              />
            </Field>
            <Field label="API Key（可选，部分代理需要）">
              <input
                className="input"
                type="password"
                placeholder="留空即可"
                value={s.lmstudioKey}
                onChange={(e) => s.update({ lmstudioKey: e.target.value })}
              />
            </Field>
            <p className="text-[11px] text-muted">
              LM Studio 启用 Local Server 后地址默认是{' '}
              <code>http://localhost:1234/v1</code>。模型 id 用 LM Studio 当前加载的
              模型名。
            </p>
          </Section>

          <Section
            title="Ollama (本地)"
            test={
              <PingButton
                state={pingState.ollama}
                msg={pingMsg.ollama}
                onClick={() => test('ollama')}
              />
            }
          >
            <Field label="Base URL">
              <input
                className="input"
                value={s.ollamaBaseUrl}
                onChange={(e) => s.update({ ollamaBaseUrl: e.target.value })}
              />
            </Field>
            <p className="text-[11px] text-muted">
              本地启动 <code>ollama serve</code> 后即可使用，无需 key。
            </p>
          </Section>

          <Section title="同步后端（可选）">
            <Field label="Endpoint">
              <input
                className="input"
                placeholder="https://my-sync.example.com"
                value={s.syncEndpoint}
                onChange={(e) => s.update({ syncEndpoint: e.target.value })}
              />
            </Field>
            <Field label="Token">
              <input
                className="input"
                type="password"
                value={s.syncToken}
                onChange={(e) => s.update({ syncToken: e.target.value })}
              />
            </Field>
            <p className="text-[11px] text-muted">
              留空则不开启同步，所有数据仅本地存储。同步协议在 M5 阶段接入。
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  test,
}: {
  title: string;
  children: React.ReactNode;
  test?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-ink">{title}</div>
        {test}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function PingButton({
  state,
  msg,
  onClick,
}: {
  state: PingState;
  msg: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {state === 'ok' ? (
        <span className="flex items-center gap-1 text-[11px] text-emerald-400" title={msg}>
          <CheckCircle2 size={12} /> 已连通
        </span>
      ) : state === 'fail' ? (
        <span
          className="flex max-w-[260px] items-center gap-1 truncate text-[11px] text-accent-danger"
          title={msg}
        >
          <AlertCircle size={12} /> {msg.slice(0, 50)}
        </span>
      ) : null}
      <button
        className="btn-ghost h-7 px-2 text-xs"
        onClick={onClick}
        disabled={state === 'pinging'}
      >
        {state === 'pinging' ? <Loader2 size={12} className="animate-spin" /> : null}
        测试连接
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
