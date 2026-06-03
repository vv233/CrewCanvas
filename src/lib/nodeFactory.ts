import type { AnyNodeData, NodeType } from '../types';
import i18n from '../i18n';

export function defaultNodeData(type: NodeType): AnyNodeData {
  switch (type) {
    case 'agent':
      return {
        kind: 'agent',
        name: i18n.t('defaults.agentName'),
        avatar: '🧑‍💻',
        soul: i18n.t('defaults.agentSoul'),
        provider: 'openrouter',
        model: 'openai/gpt-oss-120b:free',
        temperature: 0.7,
        maxTokens: 2048,
        memory: 'session',
      };
    case 'trigger':
      return {
        kind: 'trigger',
        name: i18n.t('defaults.triggerName'),
        input: i18n.t('defaults.triggerInput'),
      };
    case 'room':
      return {
        kind: 'room',
        name: i18n.t('defaults.roomName'),
        mode: 'round-robin',
        maxRounds: 4,
        minTurnsPerSpeaker: 2,
        // {{members}} / {{history}} are resolved later by the soul interpolator,
        // so pass them through as literal tokens here.
        moderatorPrompt: i18n.t('defaults.moderatorPrompt', {
          members: '{{members}}',
          history: '{{history}}',
        }),
        stopKeyword: i18n.t('defaults.stopKeyword'),
      };
    case 'aggregator':
      return {
        kind: 'aggregator',
        name: i18n.t('defaults.aggregatorName'),
        strategy: 'concat',
      };
    case 'router':
      return {
        kind: 'router',
        name: i18n.t('defaults.routerName'),
        rule: 'llm-judge',
        pattern: '',
        prompt: '',
        provider: 'openrouter',
        model: 'openai/gpt-oss-120b:free',
      };
    case 'output':
      return {
        kind: 'output',
        name: i18n.t('defaults.outputName'),
      };
    case 'discuss':
      return {
        kind: 'discuss',
        name: i18n.t('defaults.discussName'),
        avatar: '💬',
        soul: i18n.t('defaults.discussSoul'),
        provider: 'openrouter',
        model: 'openai/gpt-oss-120b:free',
        temperature: 0.7,
        maxTokens: 2048,
        // {{input}} is resolved later by the soul interpolator.
        openingPrompt: i18n.t('defaults.discussOpening', { input: '{{input}}' }),
      };
  }
}
