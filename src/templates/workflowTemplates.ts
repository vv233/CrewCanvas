import type { AnyNodeData, Workflow } from '../types';
import { nanoid } from 'nanoid';
import { SOUL_PRESETS } from './soulPresets';
import { defaultNodeData } from '../lib/nodeFactory';
import { MEMORY_TRADING_TEMPLATES } from './tradingMemory';

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
    name: '产品三人组（线性流）',
    description:
      'PM 收到需求 → 工程师评估技术 → 设计师设计 UI → 输出综合方案',
    build(): Workflow {
      const trig = nanoid();
      const pm = nanoid();
      const eng = nanoid();
      const dsg = nanoid();
      const out = nanoid();
      return {
        id: nanoid(),
        name: '产品三人组',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        variables: {},
        nodes: [
          {
            id: trig,
            type: 'trigger',
            position: { x: 40, y: 220 },
            data: {
              ...defaultNodeData('trigger'),
              input: '我想做一个可以让独立开发者快速搭建落地页的工具，目标用户是 indie hacker。',
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
    id: 'debate-room',
    name: '辩论会议室（群聊）',
    description: '乐观派 vs 批评家在主持人引导下辩论，主持人最后总结结论',
    build(): Workflow {
      const trig = nanoid();
      const room = nanoid();
      const optimist = nanoid();
      const critic = nanoid();
      const moderator = nanoid();
      const out = nanoid();
      return {
        id: nanoid(),
        name: '辩论会议室',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        variables: {},
        nodes: [
          {
            id: trig,
            type: 'trigger',
            position: { x: 20, y: 240 },
            data: {
              ...defaultNodeData('trigger'),
              input: '辩论话题：远程办公是否应该成为科技公司的默认选项？',
            } as AnyNodeData,
          },
          {
            id: room,
            type: 'room',
            position: { x: 280, y: 140 },
            data: {
              ...defaultNodeData('room'),
              name: '辩论会议室',
              mode: 'moderator',
              moderatorId: moderator,
              maxRounds: 6,
            } as AnyNodeData,
            style: { width: 380, height: 320 },
          },
          {
            id: optimist,
            type: 'agent',
            position: { x: 20, y: 60 },
            parentId: room,
            extent: 'parent',
            data: presetAgent('optimist'),
          },
          {
            id: critic,
            type: 'agent',
            position: { x: 20, y: 150 },
            parentId: room,
            extent: 'parent',
            data: presetAgent('critic'),
          },
          {
            id: moderator,
            type: 'agent',
            position: { x: 20, y: 240 },
            parentId: room,
            extent: 'parent',
            data: presetAgent('moderator'),
          },
          {
            id: out,
            type: 'output',
            position: { x: 720, y: 240 },
            data: defaultNodeData('output'),
          },
        ],
        edges: [
          { id: nanoid(), source: trig, target: room, type: 'pipe', data: { type: 'pipe' } },
          { id: nanoid(), source: room, target: out, type: 'pipe', data: { type: 'pipe' } },
        ],
      };
    },
  },
  ...MEMORY_TRADING_TEMPLATES,
];
