import { Panel } from '@xyflow/react';
import { Copy, ClipboardPaste, CopyPlus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import { useUiStore } from '../state/uiStore';

/** Floating touch toolbar replacing the Ctrl+C/V/Delete shortcuts. Shown on
 *  coarse-pointer devices whenever there is a selection or a non-empty
 *  clipboard (so paste stays reachable after deselecting). */
export function SelectionToolbar() {
  const { t } = useTranslation();
  const nodeSelCount = useWorkflowStore(
    (s) => s.workflow.nodes.filter((n) => n.selected).length
  );
  const edgeSelCount = useWorkflowStore(
    (s) => s.workflow.edges.filter((e) => e.selected).length
  );
  const removeSelected = useWorkflowStore((s) => s.removeSelected);
  const clipboardCount = useUiStore((s) => s.clipboard.length);
  const copySelection = useUiStore((s) => s.copySelection);
  const pasteClipboard = useUiStore((s) => s.pasteClipboard);
  const duplicateSelection = useUiStore((s) => s.duplicateSelection);

  const selCount = nodeSelCount + edgeSelCount;
  if (selCount === 0 && clipboardCount === 0) return null;

  const btn =
    'flex h-11 w-11 items-center justify-center rounded-md text-ink/80 hover:bg-bg hover:text-ink disabled:opacity-30';

  return (
    <Panel position="bottom-center" className="pb-safe">
      <div className="flex items-center gap-0.5 rounded-lg border border-line bg-panel/95 p-1 shadow-lg backdrop-blur">
        <button
          className={btn}
          onClick={copySelection}
          disabled={nodeSelCount === 0}
          title={t('toolbar.copy')}
          aria-label={t('toolbar.copy')}
        >
          <Copy size={18} />
        </button>
        <button
          className={btn}
          onClick={pasteClipboard}
          disabled={clipboardCount === 0}
          title={t('toolbar.paste')}
          aria-label={t('toolbar.paste')}
        >
          <ClipboardPaste size={18} />
        </button>
        <button
          className={btn}
          onClick={duplicateSelection}
          disabled={nodeSelCount === 0}
          title={t('toolbar.duplicate')}
          aria-label={t('toolbar.duplicate')}
        >
          <CopyPlus size={18} />
        </button>
        <button
          className={`${btn} hover:text-accent-danger`}
          onClick={removeSelected}
          disabled={selCount === 0}
          title={t('toolbar.delete')}
          aria-label={t('toolbar.delete')}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </Panel>
  );
}
