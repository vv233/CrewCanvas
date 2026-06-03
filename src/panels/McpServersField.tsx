import { useState } from 'react';
import {
  Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle,
  Activity, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import type { McpServerConfig, ProviderId } from '../types';
import { McpHttpClient } from '../mcp/client';

interface Props {
  value: McpServerConfig[];
  onChange: (next: McpServerConfig[]) => void;
  provider: ProviderId;
}

interface TestResult {
  state: 'idle' | 'testing' | 'ok' | 'fail';
  message?: string;
  toolCount?: number;
  toolNames?: string[];
}

export function McpServersField({ value, onChange, provider }: Props) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult>>({});

  const test = async (s: McpServerConfig) => {
    setTests((p) => ({ ...p, [s.id]: { state: 'testing' } }));

    // remote MCP 是给 Anthropic 服务器去连的，浏览器从 anthropic.com 跨域 fetch
    // 必然被 CORS 拒；这里直接告诉用户测不了，建议切 local 或运行工作流验证
    if ((s.transport ?? 'remote') === 'remote') {
      setTests((p) => ({
        ...p,
        [s.id]: {
          state: 'fail',
          message: t('mcp.testRemoteUnsupported'),
        },
      }));
      return;
    }

    if (!s.url) {
      setTests((p) => ({
        ...p,
        [s.id]: { state: 'fail', message: t('mcp.urlEmpty') },
      }));
      return;
    }

    const client = new McpHttpClient({
      url: s.url,
      authorizationToken: s.authorizationToken,
      timeoutMs: 8000,
    });
    try {
      const tools = await client.listTools();
      const filtered =
        s.allowedTools && s.allowedTools.length > 0
          ? tools.filter((t) => s.allowedTools!.includes(t.name))
          : tools;
      setTests((p) => ({
        ...p,
        [s.id]: {
          state: 'ok',
          toolCount: filtered.length,
          toolNames: filtered.map((t) => t.name),
        },
      }));
    } catch (err) {
      setTests((p) => ({
        ...p,
        [s.id]: {
          state: 'fail',
          message: err instanceof Error ? err.message : String(err),
        },
      }));
    } finally {
      client.close().catch(() => {});
    }
  };

  const add = () => {
    const id = nanoid();
    // Default to 'local' when the agent runs on a non-Anthropic provider
    // (remote MCP is only honored by Anthropic).
    const defaultTransport: McpServerConfig['transport'] =
      provider === 'anthropic' ? 'remote' : 'local';
    onChange([
      ...value,
      {
        id,
        enabled: true,
        name: 'my-mcp',
        url:
          defaultTransport === 'local'
            ? 'http://localhost:3000/mcp'
            : 'https://example.com/mcp',
        transport: defaultTransport,
        authorizationToken: '',
        allowedTools: [],
      },
    ]);
    setOpenId(id);
  };

  const update = (id: string, patch: Partial<McpServerConfig>) => {
    onChange(value.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const remove = (id: string) => {
    onChange(value.filter((s) => s.id !== id));
  };

  const hasUnsupportedRemote =
    provider !== 'anthropic' &&
    value.some((s) => s.enabled && (s.transport ?? 'remote') === 'remote');
  const hasUnsupportedLocal =
    provider === 'ollama' &&
    value.some((s) => s.enabled && s.transport === 'local');

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="label">{t('mcp.title')}</span>
        <button
          className="rounded p-1 text-muted hover:bg-panel hover:text-ink"
          onClick={add}
          title={t('mcp.addTitle')}
        >
          <Plus size={12} />
        </button>
      </div>

      {hasUnsupportedRemote ? (
        <div className="mb-2 flex items-start gap-1.5 rounded border border-amber-400/30 bg-amber-400/5 p-2 text-[10px] text-amber-200/90">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>{t('mcp.remoteOnlyAnthropic', { provider })}</span>
        </div>
      ) : null}
      {hasUnsupportedLocal ? (
        <div className="mb-2 flex items-start gap-1.5 rounded border border-amber-400/30 bg-amber-400/5 p-2 text-[10px] text-amber-200/90">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>{t('mcp.ollamaNoTools')}</span>
        </div>
      ) : null}

      {value.length === 0 ? (
        <div className="rounded border border-dashed border-line p-2 text-center text-[10px] text-muted">
          {t('mcp.emptyHint')}
          <br />
          {t('mcp.emptyHint2')}
        </div>
      ) : (
        <ul className="space-y-1">
          {value.map((s) => {
            const open = openId === s.id;
            return (
              <li key={s.id} className="rounded border border-line bg-bg-soft">
                <div
                  className="flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-[12px]"
                  onClick={() => setOpenId(open ? null : s.id)}
                >
                  {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={s.enabled}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => update(s.id, { enabled: e.target.checked })}
                  />
                  <span
                    className={`flex-1 truncate font-medium ${
                      s.enabled ? 'text-ink' : 'text-muted line-through'
                    }`}
                  >
                    {s.name || t('mcp.unnamed')}
                  </span>
                  <TestBadge result={tests[s.id]} />
                  <button
                    className="rounded p-0.5 text-muted hover:bg-bg hover:text-accent-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(s.id);
                    }}
                    title={t('common.delete')}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                {open ? (
                  <div className="space-y-2 border-t border-line px-2 py-2 text-[11px]">
                    <Field label={t('mcp.transport')}>
                      <div className="flex gap-1">
                        <button
                          className={`flex-1 rounded px-2 py-1 text-[11px] ${
                            (s.transport ?? 'remote') === 'local'
                              ? 'bg-accent text-white'
                              : 'bg-bg text-muted hover:text-ink'
                          }`}
                          onClick={() => update(s.id, { transport: 'local' })}
                        >
                          {t('mcp.transportLocal')}
                        </button>
                        <button
                          className={`flex-1 rounded px-2 py-1 text-[11px] ${
                            (s.transport ?? 'remote') === 'remote'
                              ? 'bg-accent text-white'
                              : 'bg-bg text-muted hover:text-ink'
                          }`}
                          onClick={() => update(s.id, { transport: 'remote' })}
                        >
                          {t('mcp.transportRemote')}
                        </button>
                      </div>
                    </Field>
                    <Field label={t('mcp.name')}>
                      <input
                        className="input h-7 text-[11px]"
                        value={s.name}
                        onChange={(e) => update(s.id, { name: e.target.value })}
                      />
                    </Field>
                    <Field label={t('mcp.url')}>
                      <input
                        className="input h-7 text-[11px] font-mono"
                        value={s.url}
                        placeholder={t('mcp.urlPlaceholder')}
                        onChange={(e) => update(s.id, { url: e.target.value })}
                      />
                    </Field>
                    <Field label={t('mcp.authToken')}>
                      <input
                        className="input h-7 text-[11px] font-mono"
                        type="password"
                        value={s.authorizationToken ?? ''}
                        onChange={(e) =>
                          update(s.id, { authorizationToken: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={t('mcp.allowedTools')}>
                      <input
                        className="input h-7 text-[11px] font-mono"
                        value={(s.allowedTools ?? []).join(',')}
                        placeholder={t('mcp.allowedToolsPlaceholder')}
                        onChange={(e) => {
                          const arr = e.target.value
                            .split(',')
                            .map((x) => x.trim())
                            .filter(Boolean);
                          update(s.id, { allowedTools: arr });
                        }}
                      />
                    </Field>
                    <TestPanel result={tests[s.id]} onTest={() => test(s)} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-1 text-[10px] leading-relaxed text-muted">
        <strong className="text-ink/70">{t('mcp.footerLocal')}</strong>
        {t('mcp.footerLocalDesc')}
        <br />
        <strong className="text-ink/70">{t('mcp.footerRemote')}</strong>
        {t('mcp.footerRemoteDesc')}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

function TestBadge({ result }: { result?: TestResult }) {
  const { t } = useTranslation();
  if (!result || result.state === 'idle') return null;
  if (result.state === 'testing') {
    return <Loader2 size={11} className="shrink-0 animate-spin text-muted" />;
  }
  if (result.state === 'ok') {
    return (
      <span
        className="flex shrink-0 items-center gap-0.5 text-[10px] text-emerald-400"
        title={t('mcp.connectedBadge', { count: result.toolCount })}
      >
        <CheckCircle2 size={11} /> {result.toolCount}
      </span>
    );
  }
  return (
    <AlertCircle
      size={11}
      className="shrink-0 text-accent-danger"
      aria-label={result.message}
    />
  );
}

function TestPanel({
  result,
  onTest,
}: {
  result?: TestResult;
  onTest: () => void;
}) {
  const { t } = useTranslation();
  const r = result ?? { state: 'idle' as const };
  return (
    <div className="border-t border-line/60 pt-2">
      <button
        className="btn-ghost h-7 w-full text-[11px]"
        onClick={onTest}
        disabled={r.state === 'testing'}
      >
        {r.state === 'testing' ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <Activity size={11} />
        )}
        {t('mcp.testConnection')}
      </button>
      {r.state === 'ok' ? (
        <div className="mt-1.5 rounded bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-200/90">
          <div className="flex items-center gap-1 font-semibold">
            <CheckCircle2 size={10} /> {t('mcp.connected', { count: r.toolCount })}
          </div>
          {r.toolNames && r.toolNames.length > 0 ? (
            <div className="mt-1 font-mono text-emerald-200/70 break-words">
              {r.toolNames.join(', ')}
            </div>
          ) : null}
        </div>
      ) : null}
      {r.state === 'fail' ? (
        <div className="mt-1.5 rounded bg-accent-danger/10 px-2 py-1 text-[10px] text-accent-danger">
          <div className="flex items-center gap-1 font-semibold">
            <AlertCircle size={10} /> {t('mcp.connectFailed')}
          </div>
          <div className="mt-1 break-words">{r.message}</div>
        </div>
      ) : null}
    </div>
  );
}
