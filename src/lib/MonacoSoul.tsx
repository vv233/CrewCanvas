import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

const Monaco = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.default }))
);

interface Props {
  value: string;
  onChange: (v: string) => void;
  minHeight?: number;
}

export function MonacoSoul({ value, onChange, minHeight = 280 }: Props) {
  const { t } = useTranslation();
  return (
    <div
      className="overflow-hidden rounded-md border border-line bg-bg"
      style={{ height: minHeight }}
    >
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-[11px] text-muted">
            {t('common.loadingEditor')}
          </div>
        }
      >
        <Monaco
          height="100%"
          defaultLanguage="markdown"
          theme="vs-dark"
          value={value}
          onChange={(v) => onChange(v ?? '')}
          options={{
            minimap: { enabled: false },
            lineNumbers: 'off',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            fontSize: 12,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            renderLineHighlight: 'none',
            scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
            padding: { top: 8, bottom: 8 },
          }}
        />
      </Suspense>
    </div>
  );
}
