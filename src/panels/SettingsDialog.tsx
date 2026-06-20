import { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { nanoid } from 'nanoid';
import { useSettingsStore } from '../state/settingsStore';
import { useWorkflowStore } from '../state/workflowStore';
import { getProvider } from '../providers/registry';
import type { AgentNodeData, McpServerConfig, ProviderId } from '../types';
import { Field } from '../lib/Field';
import { ProviderModelSelector } from '../lib/ProviderModelSelector';
import { McpServersField } from './McpServersField';

/** Default URL the local Companion prints on startup. */
const COMPANION_URL = 'http://127.0.0.1:8787/mcp';

interface Props {
  open: boolean;
  onClose: () => void;
}

type PingState = 'idle' | 'pinging' | 'ok' | 'fail';

export function SettingsDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
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

  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);
  const applyDefaultToAll = () => {
    const wf = useWorkflowStore.getState().workflow;
    const ids = wf.nodes
      .filter((n) => n.data.kind === 'agent' || n.data.kind === 'discuss')
      .map((n) => n.id);
    if (ids.length === 0) {
      setAppliedMsg(t('settings.applyNone'));
      return;
    }
    useWorkflowStore.getState().updateNodesData(ids, {
      provider: s.defaultProvider,
      model: s.defaultModel,
    } as Partial<AgentNodeData>);
    setAppliedMsg(t('settings.appliedToAll', { count: ids.length }));
  };

  const [companionMsg, setCompanionMsg] = useState<string | null>(null);
  const connectCompanion = () => {
    const list = s.globalMcpServers ?? [];
    if (list.some((srv) => srv.url === COMPANION_URL)) {
      setCompanionMsg(t('settings.companionExists'));
      return;
    }
    const entry: McpServerConfig = {
      id: nanoid(),
      enabled: true,
      name: 'Companion',
      url: COMPANION_URL,
      transport: 'local',
      authorizationToken: '',
    };
    s.update({ globalMcpServers: [...list, entry] });
    setCompanionMsg(t('settings.companionAdded'));
  };

  const test = async (id: ProviderId) => {
    setPingState((p) => ({ ...p, [id]: 'pinging' }));
    setPingMsg((m) => ({ ...m, [id]: '' }));
    try {
      await getProvider(id).ping();
      setPingState((p) => ({ ...p, [id]: 'ok' }));
      setPingMsg((m) => ({ ...m, [id]: t('settings.pingOk') }));
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
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card flex h-full max-h-none w-full max-w-2xl flex-col rounded-none sm:h-auto sm:max-h-[90vh] sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="text-base font-semibold text-ink">{t('settings.title')}</div>
          <button className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="space-y-5 overflow-auto px-4 py-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-[12px] text-amber-200/90">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">{t('settings.warningTitle')}</div>
              <p className="mt-1 text-amber-100/80">{t('settings.warningBody')}</p>
            </div>
          </div>

          <Section title={t('settings.defaultModelTitle')}>
            <p className="text-[11px] text-muted">{t('settings.defaultModelNote')}</p>
            <ProviderModelSelector
              idPrefix="default-models"
              provider={s.defaultProvider}
              model={s.defaultModel}
              onChange={(next) =>
                s.update({ defaultProvider: next.provider, defaultModel: next.model })
              }
            />
            <button className="btn-ghost h-8 w-full text-xs" onClick={applyDefaultToAll}>
              {t('settings.applyToAll')}
            </button>
            {appliedMsg ? (
              <p className="text-[11px] text-emerald-400">{appliedMsg}</p>
            ) : null}
          </Section>

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
            <Field label={t('settings.apiKey')}>
              <input
                className="input"
                type="password"
                placeholder="sk-ant-..."
                value={s.anthropicKey}
                onChange={(e) => s.update({ anthropicKey: e.target.value })}
              />
            </Field>
            <Field label={t('settings.baseUrl')}>
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
            <Field label={t('settings.apiKey')}>
              <input
                className="input"
                type="password"
                placeholder="sk-..."
                value={s.openaiKey}
                onChange={(e) => s.update({ openaiKey: e.target.value })}
              />
            </Field>
            <Field label={t('settings.openaiBaseUrl')}>
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
            <Field label={t('settings.apiKey')}>
              <input
                className="input"
                type="password"
                placeholder="sk-or-..."
                value={s.openrouterKey}
                onChange={(e) => s.update({ openrouterKey: e.target.value })}
              />
            </Field>
            <Field label={t('settings.baseUrl')}>
              <input
                className="input"
                value={s.openrouterBaseUrl}
                onChange={(e) => s.update({ openrouterBaseUrl: e.target.value })}
              />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t('settings.referer')}>
                <input
                  className="input"
                  placeholder={t('settings.refererPlaceholder')}
                  value={s.openrouterReferer}
                  onChange={(e) => s.update({ openrouterReferer: e.target.value })}
                />
              </Field>
              <Field label={t('settings.xTitle')}>
                <input
                  className="input"
                  value={s.openrouterTitle}
                  onChange={(e) => s.update({ openrouterTitle: e.target.value })}
                />
              </Field>
            </div>
            <p className="text-[11px] text-muted">
              {t('settings.openrouterNotePre')}{' '}
              <code>anthropic/claude-sonnet-4</code>
              {t('settings.openrouterNotePost')}
            </p>
          </Section>

          <Section
            title={t('settings.lmstudioTitle')}
            test={
              <PingButton
                state={pingState.lmstudio}
                msg={pingMsg.lmstudio}
                onClick={() => test('lmstudio')}
              />
            }
          >
            <Field label={t('settings.baseUrl')}>
              <input
                className="input"
                value={s.lmstudioBaseUrl}
                onChange={(e) => s.update({ lmstudioBaseUrl: e.target.value })}
              />
            </Field>
            <Field label={t('settings.lmstudioKeyOptional')}>
              <input
                className="input"
                type="password"
                placeholder={t('settings.leaveEmpty')}
                value={s.lmstudioKey}
                onChange={(e) => s.update({ lmstudioKey: e.target.value })}
              />
            </Field>
            <p className="text-[11px] text-muted">
              {t('settings.lmstudioNotePre')}{' '}
              <code>http://localhost:1234/v1</code>
              {t('settings.lmstudioNotePost')}
            </p>
          </Section>

          <Section
            title={t('settings.ollamaTitle')}
            test={
              <PingButton
                state={pingState.ollama}
                msg={pingMsg.ollama}
                onClick={() => test('ollama')}
              />
            }
          >
            <Field label={t('settings.baseUrl')}>
              <input
                className="input"
                value={s.ollamaBaseUrl}
                onChange={(e) => s.update({ ollamaBaseUrl: e.target.value })}
              />
            </Field>
            <p className="text-[11px] text-muted">
              {t('settings.ollamaNotePre')} <code>ollama serve</code>{' '}
              {t('settings.ollamaNotePost')}
            </p>
          </Section>

          <Section title={t('settings.syncTitle')}>
            <Field label={t('settings.endpoint')}>
              <input
                className="input"
                placeholder="https://my-sync.example.com"
                value={s.syncEndpoint}
                onChange={(e) => s.update({ syncEndpoint: e.target.value })}
              />
            </Field>
            <Field label={t('settings.token')}>
              <input
                className="input"
                type="password"
                value={s.syncToken}
                onChange={(e) => s.update({ syncToken: e.target.value })}
              />
            </Field>
            <p className="text-[11px] text-muted">{t('settings.syncNote')}</p>
          </Section>

          <Section title={t('settings.companionTitle')}>
            <p className="text-[11px] text-muted">{t('settings.companionNote')}</p>
            <button className="btn-ghost h-8 w-full text-xs" onClick={connectCompanion}>
              {t('settings.connectCompanion')}
            </button>
            {companionMsg ? (
              <p className="text-[11px] text-emerald-400">{companionMsg}</p>
            ) : null}
            <McpServersField
              value={s.globalMcpServers}
              onChange={(globalMcpServers) => s.update({ globalMcpServers })}
              provider="openrouter"
            />
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
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
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      {state === 'ok' ? (
        <span className="flex items-center gap-1 text-[11px] text-emerald-400" title={msg}>
          <CheckCircle2 size={12} /> {t('settings.connectedBadge')}
        </span>
      ) : state === 'fail' ? (
        <span
          className="flex max-w-[11rem] items-center gap-1 truncate text-[11px] text-accent-danger sm:max-w-[260px]"
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
        {t('mcp.testConnection')}
      </button>
    </div>
  );
}
