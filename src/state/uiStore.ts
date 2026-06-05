import { create } from 'zustand';
import { useWorkflowStore } from './workflowStore';
import type { AnyNodeData, NodeType } from '../types';

export type ClipNode = {
  type: NodeType;
  position: { x: number; y: number };
  data: AnyNodeData;
};

/** Touch canvas gesture mode: one-finger drag pans (default) or box-selects. */
export type InteractionMode = 'pan' | 'select';

interface UiStore {
  /** Node palette drawer (only used below the `lg` breakpoint). */
  paletteOpen: boolean;
  /** Inspector drawer (only used below the `lg` breakpoint). */
  inspectorOpen: boolean;
  interactionMode: InteractionMode;
  /** Copied nodes shared by the Ctrl+C/V handler and the touch toolbar. */
  clipboard: ClipNode[];
  pasteSeq: number;

  setPaletteOpen: (open: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setInteractionMode: (mode: InteractionMode) => void;

  /** Copy the current node selection. Returns true if anything was copied. */
  copySelection: () => boolean;
  /** Paste the clipboard, offset +32px per consecutive paste. */
  pasteClipboard: () => void;
  /** Copy + paste in one step (no clipboard mutation), offset +32px. */
  duplicateSelection: () => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  paletteOpen: false,
  inspectorOpen: false,
  interactionMode: 'pan',
  clipboard: [],
  pasteSeq: 0,

  setPaletteOpen: (paletteOpen) =>
    set((s) => ({
      paletteOpen,
      inspectorOpen: paletteOpen ? false : s.inspectorOpen,
    })),
  setInspectorOpen: (inspectorOpen) =>
    set((s) => ({
      inspectorOpen,
      paletteOpen: inspectorOpen ? false : s.paletteOpen,
    })),
  setInteractionMode: (interactionMode) => set({ interactionMode }),

  copySelection: () => {
    const sel = useWorkflowStore.getState().workflow.nodes.filter((n) => n.selected);
    if (sel.length === 0) return false;
    set({
      clipboard: sel.map((n) => ({
        type: n.type as NodeType,
        position: n.position,
        data: structuredClone(n.data),
      })),
      pasteSeq: 0,
    });
    return true;
  },

  pasteClipboard: () => {
    const { clipboard, pasteSeq } = get();
    if (clipboard.length === 0) return;
    const seq = pasteSeq + 1;
    const off = 32 * seq;
    useWorkflowStore.getState().duplicateNodes(
      clipboard.map((c) => ({
        type: c.type,
        position: { x: c.position.x + off, y: c.position.y + off },
        data: structuredClone(c.data),
      }))
    );
    set({ pasteSeq: seq });
  },

  duplicateSelection: () => {
    const sel = useWorkflowStore.getState().workflow.nodes.filter((n) => n.selected);
    if (sel.length === 0) return;
    useWorkflowStore.getState().duplicateNodes(
      sel.map((n) => ({
        type: n.type as NodeType,
        position: { x: n.position.x + 32, y: n.position.y + 32 },
        data: structuredClone(n.data),
      }))
    );
  },
}));
