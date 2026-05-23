import type { AnyNodeData, NodeType } from '../types';

const DEFAULT_SOUL = `# 角色

你是一名 AI 员工。请基于自身职责，认真完成上级派发的任务。

## 职责

- 用专业、可执行的方式回答问题
- 必要时主动提出澄清问题

## 风格

- 简洁、直接、不啰嗦
`;

export function defaultNodeData(type: NodeType): AnyNodeData {
  switch (type) {
    case 'agent':
      return {
        kind: 'agent',
        name: '新员工',
        avatar: '🧑‍💻',
        soul: DEFAULT_SOUL,
        provider: 'openrouter',
        model: 'openai/gpt-oss-120b:free',
        temperature: 0.7,
        maxTokens: 2048,
        memory: 'session',
      };
    case 'trigger':
      return {
        kind: 'trigger',
        name: '任务入口',
        input: '请帮我写一段产品介绍',
      };
    case 'room':
      return {
        kind: 'room',
        name: '会议室',
        mode: 'round-robin',
        maxRounds: 4,
        minTurnsPerSpeaker: 2,
        moderatorPrompt:
          '你是讨论主持人。任务：在已有讨论的基础上推进。\n\n候选成员：{{members}}\n讨论历史：\n{{history}}\n\n规则：\n1) 只有当讨论已经充分（每个观点至少被双方各回应过一轮、且没有明显新信息可挖）时，才返回 stop\n2) 否则选一个最能推进讨论的成员发言（优先让上轮被反驳但未回应的人）\n3) 严格输出一行 JSON，没有其他字符：\n   - 继续：{"next":"成员名"}\n   - 结束：{"stop":true,"summary":"一句话结论"}',
        stopKeyword: '【讨论结束】',
      };
    case 'aggregator':
      return {
        kind: 'aggregator',
        name: '汇总',
        strategy: 'concat',
      };
    case 'router':
      return {
        kind: 'router',
        name: '分流',
        rule: 'llm-judge',
        pattern: '',
      };
    case 'output':
      return {
        kind: 'output',
        name: '输出',
      };
    case 'discuss':
      return {
        kind: 'discuss',
        name: '与用户讨论',
        avatar: '💬',
        soul: `# 角色
你是用户的协作伙伴。用户会在此节点和你来回讨论一个方案，直到方案足够清晰、可以交给下游的执行者。

## 工作方式
- 看到上游传来的初步任务/方案后，先用 1-2 句确认你的理解，然后提 1-3 个最关键的澄清问题
- 收到用户回复后，迭代方案：补充细节、提出取舍、指出风险
- 不要急着给最终答案；以"帮用户把方案磨清楚"为目标
- 当用户表示满意或要求收尾时，输出一段结构化的「最终方案」供下游执行

## 风格
- 简洁、聚焦关键问题
- 一次只问最重要的 1-3 个问题，避免一次抛 10 个`,
        provider: 'openrouter',
        model: 'openai/gpt-oss-120b:free',
        temperature: 0.7,
        maxTokens: 2048,
        openingPrompt:
          '下面是从上游传来的初始任务/方案：\n\n{{input}}\n\n请你和我（用户）一起讨论它。先用 1-2 句确认你的理解，然后提 1-3 个最关键的澄清问题。',
      };
  }
}
