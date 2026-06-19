import type { AnyNodeData, Workflow } from '../types';
import { nanoid } from 'nanoid';
import { SOUL_PRESETS } from './soulPresets';
import { defaultNodeData } from '../lib/nodeFactory';
import { emptyTarget } from '../lib/target';
import i18n from '../i18n';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  build(): Workflow;
}

function presetAgent(presetId: string): AnyNodeData {
  const preset = SOUL_PRESETS.find((p) => p.id === presetId)!;
  const base = defaultNodeData('agent') as Extract<AnyNodeData, { kind: 'agent' }>;
  return {
    ...base,
    name: preset.name,
    avatar: preset.avatar,
    soul: preset.soul,
  };
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'pm-eng-designer',
    get name() {
      return i18n.t('templatesData.pmName');
    },
    get description() {
      return i18n.t('templatesData.pmDesc');
    },
    build(): Workflow {
      const trig = nanoid();
      const pm = nanoid();
      const eng = nanoid();
      const dsg = nanoid();
      const out = nanoid();
      return {
        id: nanoid(),
        name: i18n.t('templatesData.pmWorkflowName'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        variables: {},
        target: emptyTarget(),
        nodes: [
          {
            id: trig,
            type: 'trigger',
            position: { x: 40, y: 220 },
            data: {
              ...defaultNodeData('trigger'),
              input: i18n.t('templatesData.pmTriggerInput'),
            } as AnyNodeData,
          },
          { id: pm, type: 'agent', position: { x: 320, y: 80 }, data: presetAgent('pm') },
          { id: eng, type: 'agent', position: { x: 320, y: 240 }, data: presetAgent('engineer') },
          { id: dsg, type: 'agent', position: { x: 320, y: 400 }, data: presetAgent('designer') },
          { id: out, type: 'output', position: { x: 660, y: 240 }, data: defaultNodeData('output') },
        ],
        edges: [
          { id: nanoid(), source: trig, target: pm, type: 'broadcast', data: { type: 'broadcast' } },
          { id: nanoid(), source: trig, target: eng, type: 'broadcast', data: { type: 'broadcast' } },
          { id: nanoid(), source: trig, target: dsg, type: 'broadcast', data: { type: 'broadcast' } },
          { id: nanoid(), source: pm, target: out, type: 'pipe', data: { type: 'pipe' } },
          { id: nanoid(), source: eng, target: out, type: 'pipe', data: { type: 'pipe' } },
          { id: nanoid(), source: dsg, target: out, type: 'pipe', data: { type: 'pipe' } },
        ],
      };
    },
  },
  {
    id: 'code-runner',
    get name() {
      return i18n.t('templatesData.codeName');
    },
    get description() {
      return i18n.t('templatesData.codeDesc');
    },
    build(): Workflow {
      const trig = nanoid();
      const eng = nanoid();
      const out = nanoid();
      return {
        id: nanoid(),
        name: i18n.t('templatesData.codeWorkflowName'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        variables: {},
        target: emptyTarget(),
        nodes: [
          {
            id: trig,
            type: 'trigger',
            position: { x: 40, y: 160 },
            data: {
              ...defaultNodeData('trigger'),
              input: i18n.t('templatesData.codeTriggerInput'),
            } as AnyNodeData,
          },
          {
            id: eng,
            type: 'agent',
            position: { x: 340, y: 160 },
            // Engineer persona, but tell it to actually run code via run_js.
            data: { ...presetAgent('engineer'), soul: i18n.t('templatesData.codeSoul') },
          },
          { id: out, type: 'output', position: { x: 660, y: 160 }, data: defaultNodeData('output') },
        ],
        edges: [
          { id: nanoid(), source: trig, target: eng, type: 'pipe', data: { type: 'pipe' } },
          { id: nanoid(), source: eng, target: out, type: 'pipe', data: { type: 'pipe' } },
        ],
      };
    },
  },
];
