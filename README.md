# AI Org Flow — 拖拽式 AI 工作流网站

一个纯前端的可视化 AI 编排工具。把 AI 想象成员工，画一张组织图，让它们协作完成任务。

## 特性

- **6 种节点**：任务入口 / AI 员工 / 群聊室 / 汇总 / 分流 / 输出
- **5 种连线**：管道 / 指派 / 汇报 / 广播 / 话题，连线类型决定上下游沟通语义
- **3 家模型**：Anthropic Claude / OpenAI / Ollama（本地），浏览器直连
- **soul.md**：每个 AI 用 Markdown 定义自己的角色、性格、职责，支持变量插值
- **群聊室**：多个 AI 在同一房间内多轮讨论，支持轮询 / 主持人 / 抢答三种模式
- **零后端**：所有数据存浏览器（localStorage + IndexedDB），托管为静态资源即可

## 本地开发

```bash
npm install
npm run dev
```

打开 http://127.0.0.1:5173/。

## 部署

构建：

```bash
npm run build
```

把 `dist/` 推到任何静态托管：

- **Vercel**：`vercel deploy --prod` 或连 GitHub 自动部署
- **Cloudflare Pages**：拖 `dist/` 文件夹到 dashboard
- **GitHub Pages**：把 `dist/*` 推到 `gh-pages` 分支
- **Nginx / Caddy**：把 `dist/` 配置为根目录即可

由于使用 SPA 路由（实际上 M1-M5 还没有路由，单页），无需额外重写规则。

## 使用流程

1. 顶栏「设置」录入你的 Anthropic 或 OpenAI key（或启动本地 Ollama），点「测试连接」确认
2. 顶栏「模板」选一个示例工作流，或从左侧拖节点自己搭
3. 点击 AI 节点，在右侧 inspector 用 Monaco 编辑 soul.md
4. 点击连线，在右侧切换沟通方式（管道 / 指派 / 广播 …）
5. 编辑「任务入口」节点的输入
6. 顶栏「运行」，节点上实时显示流式输出
7. 顶栏「历史」回看任意一次运行的全部细节

## 安全提示

API key 明文保存在浏览器 localStorage，请只在自己的设备上使用。后续版本会加入主密码 + AES-GCM 加密。

## 架构

```
src/
├── canvas/          React Flow 画布 + 节点 + 连线
├── panels/          Inspector / 顶栏 / 控制台 / 弹窗
├── engine/          DAG 调度、群聊调度、变量插值
├── providers/       Anthropic / OpenAI / Ollama 适配
├── storage/         IndexedDB (Dexie) + 导入导出
├── state/           Zustand stores
├── templates/       内置 soul 与工作流模板
└── lib/             工具
```

## 待办（M6 之后）

- 主密码加密 API key（Web Crypto + PBKDF2 + AES-GCM）
- i18n（中英）
- Undo / Redo
- 节点搜索
- 大图虚拟化
- 可选同步后端（多设备同步）
- LLM-judge 路由真正调用模型
- 群聊 race 模式的取消未完成请求
- Aggregator summarize 策略绑定 agent
