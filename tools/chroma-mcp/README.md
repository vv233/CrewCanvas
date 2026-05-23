# Chroma RAG MCP

让 agent 通过 MCP 工具调用 ChromaDB 做语义检索。Chroma in-process（嵌进 server 进程），数据持久化到磁盘。

跟现有的 agent 私人知识库（inline + 文件 + kb_*）互补：
- **agent kb**：小、私人、关键词搜索
- **chroma RAG**：大、共享（多 agent 同一 collection）、**语义**搜索

## 6 个工具

| 工具 | 作用 |
|---|---|
| `rag_list_collections()` | 列出所有 collection（含文档数） |
| `rag_create_collection(name, description?)` | 创建（已存在直接返回） |
| `rag_delete_collection(name)` | 删整个 collection |
| `rag_add_documents(collection, documents, ids?, metadatas?, chunk_size?)` | 批量加文档（自动 embed） |
| `rag_query(collection, query, n_results=3, where?)` | 语义检索 top-K（带可选元数据 where 过滤）|
| `rag_count(collection)` / `rag_peek(collection, n=3)` | 调试 / 查看 |

## 启动

```bash
cd tools/chroma-mcp
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python server.py
```

监听 `127.0.0.1:8003`。首次添加文档时 Chroma 自动下载 ONNX 嵌入模型 `all-MiniLM-L6-v2`（~80MB 到 `~/.cache/chroma/onnx_models/`），需要联网。下载完成后离线可用。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `CHROMA_MCP_HOST` | `127.0.0.1` | 监听地址（远程访问用 `0.0.0.0`）|
| `CHROMA_MCP_PORT` | `8003` | 端口 |
| `CHROMA_MCP_ORIGIN` | `*` | CORS 允许的源 |
| `CHROMA_MCP_DATA_DIR` | `./chroma_db` | 数据持久化目录 |
| `CHROMA_MCP_AUTO_CHUNK_SIZE` | `0`（不切）| 全局默认切块大小（字符）；agent 调用时也可单独传 `chunk_size` |

## 接到 AI Org Flow

Agent inspector → MCP 工具 → 添加：
- **Transport**: `local`
- **Name**: `rag`
- **URL**: `http://127.0.0.1:8003/mcp`

工具会以 `rag__rag_query` 等前缀出现给 agent（双 rag 是因为命名空间 + 工具名）。要简洁可以改 server name，或在 inspector 里给 MCP entry 取个短名（如 `db`）。

## 典型用法（让 agent 自己建库 + 查）

让一个"资料管理员" agent 用 soul.md 规定：

```markdown
# 角色
你是知识库管理员。

## 工作方式
1. 接到原始资料后：
   - rag_create_collection(name='product_docs', description='产品文档 v3.2')
   - 把长文档按章节拆好 → rag_add_documents(collection='product_docs',
     documents=[...章节1, 章节2, ...], metadatas=[{section:'auth'}, ...])
2. 接到查询时：
   - rag_query(collection='product_docs', query=问题, n_results=5)
   - 把命中的 documents 综合给出答案，引用 metadata 标注来源
```

或者**预先**用脚本把资料喂进去（不通过 agent），agent 只负责查询：

```bash
# 命令行喂数据（不通过 AI Org Flow，直接调 chroma-mcp）
curl -X POST http://127.0.0.1:8003/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Session-Id: <session>' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"rag_add_documents","arguments":{"collection":"...","documents":[...]}}}'
```

更简单：写一个 Python 脚本直接用 chromadb client：

```python
import chromadb
client = chromadb.PersistentClient(path="./chroma_db")
col = client.get_or_create_collection("product_docs")
col.upsert(
    documents=open("manual.md").read().split("\n## "),
    ids=[f"manual-{i}" for i in range(N)],
)
```

跑完 server 启动后 agent 就能 `rag_query` 到。

## RAG 跟 agent kb 该用哪个？

| 场景 | 推荐 |
|---|---|
| 几段固定的角色背景 / 缩写表 | agent kb inline |
| 单个 agent 私有的 5-10 篇短文档 | agent kb 文件 + `kb_search` |
| 长文档（> 50 章节）、PDF/wiki 全文 | **chroma RAG** |
| 多个 agent 共享同一份知识 | **chroma RAG**（一个 collection 所有 agent 都能查） |
| 需要按元数据过滤（"只查 2024 的"） | **chroma RAG** with `where` |
| 离线环境、不想下 ONNX 模型 | agent kb（纯关键词，零依赖） |

## 性能 / 容量

- ONNX MiniLM 在普通 CPU 上 ~5ms/句 embedding
- Chroma 默认存 SQLite，万级文档无压力，百万级建议换 collection 拆分
- 数据放 `./chroma_db/`，直接备份这个文件夹就是备份全部 vector store

## 排错

| 现象 | 原因 |
|---|---|
| 首次 add 卡住 | 在下 ONNX 模型（80MB）；看进程 IO，等下载完 |
| `Module not found: chromadb` | 没装依赖 / 没激活 venv |
| 浏览器侧 NetworkError | 同 finance-mcp：本机访问用 `127.0.0.1`，远程访问改 `CHROMA_MCP_HOST=0.0.0.0` + 模板 URL 自动用 `window.location.hostname` |
| 返回 `distance` 都接近 1.0 | embedding 没匹配；query 太短或 collection 内容不相关 |
