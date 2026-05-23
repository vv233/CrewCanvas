"""
ChromaDB RAG MCP server.

Runs Chroma in-process (PersistentClient, data dir configurable). Exposes
6 tools to agents for collection management and semantic search.

Default embedding: Chroma's built-in ONNX MiniLM-L6-v2 (downloads ~80MB to
~/.cache/chroma/onnx_models the first time it's used). No API key needed.

Env:
    CHROMA_MCP_HOST       default 127.0.0.1
    CHROMA_MCP_PORT       default 8003
    CHROMA_MCP_ORIGIN     default *  (CORS)
    CHROMA_MCP_DATA_DIR   default ./chroma_db  (persisted vector store)
    CHROMA_MCP_AUTO_CHUNK_SIZE  default 0 (disabled). If >0, server auto-splits
                                long docs into char-sized chunks on add.
"""

from __future__ import annotations

import os
import sys
from typing import Any
from uuid import uuid4

import chromadb
import uvicorn
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.middleware.cors import CORSMiddleware


DATA_DIR = os.environ.get("CHROMA_MCP_DATA_DIR", "./chroma_db")
AUTO_CHUNK = int(os.environ.get("CHROMA_MCP_AUTO_CHUNK_SIZE", "0"))

# Singleton client — Chroma is process-local, persistent on disk.
client = chromadb.PersistentClient(path=DATA_DIR)


mcp = FastMCP(
    "chroma",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=False
    ),
)


# --------------------------------------------------------------------------- #
# Helpers                                                                     #
# --------------------------------------------------------------------------- #


def _chunk(text: str, size: int, overlap: int = 100) -> list[str]:
    if size <= 0 or len(text) <= size:
        return [text]
    out = []
    i = 0
    step = max(1, size - overlap)
    while i < len(text):
        out.append(text[i : i + size])
        i += step
    return out


def _get(collection: str):
    return client.get_or_create_collection(name=collection)


# --------------------------------------------------------------------------- #
# Tools                                                                       #
# --------------------------------------------------------------------------- #


@mcp.tool()
def rag_list_collections() -> dict:
    """列出所有已有的 RAG collection。"""
    cols = client.list_collections()
    return {
        "collections": [
            {"name": c.name, "count": c.count(), "metadata": c.metadata}
            for c in cols
        ]
    }


@mcp.tool()
def rag_create_collection(name: str, description: str = "") -> dict:
    """创建一个 collection（已存在则直接返回）。

    Args:
        name:        collection 名（建议小写下划线，例 'product_docs'）
        description: 可选说明，存到 metadata
    """
    col = client.get_or_create_collection(
        name=name,
        metadata={"description": description} if description else None,
    )
    return {
        "name": col.name,
        "count": col.count(),
        "metadata": col.metadata,
    }


@mcp.tool()
def rag_delete_collection(name: str) -> dict:
    """删除整个 collection 及其全部文档（不可逆）。"""
    try:
        client.delete_collection(name=name)
        return {"name": name, "deleted": True}
    except Exception as e:
        return {"name": name, "deleted": False, "error": str(e)}


@mcp.tool()
def rag_add_documents(
    collection: str,
    documents: list[str],
    ids: list[str] | None = None,
    metadatas: list[dict[str, Any]] | None = None,
    chunk_size: int = 0,
) -> dict:
    """添加文档到 collection。会自动 embed + 索引。

    Args:
        collection: collection 名（不存在会自动创建）
        documents:  文本列表
        ids:        每篇文档的 id（缺省自动生成 uuid）
        metadatas:  每篇文档的可选元数据（如 {"source":"a.pdf","page":3}）
                    后续可用 where 过滤检索
        chunk_size: 0 = 不切；>0 时把每篇文档按字符切，每块独立索引
                    （overlap 固定 100 字符）

    Returns: {added, collection, total_after}
    """
    col = _get(collection)
    effective_chunk = chunk_size if chunk_size > 0 else AUTO_CHUNK

    docs_out: list[str] = []
    ids_out: list[str] = []
    metas_out: list[dict[str, Any]] = []

    for i, doc in enumerate(documents):
        chunks = _chunk(doc, effective_chunk) if effective_chunk else [doc]
        base_id = ids[i] if ids and i < len(ids) else f"doc-{uuid4().hex[:10]}"
        base_meta = metadatas[i] if metadatas and i < len(metadatas) else {}
        for j, ch in enumerate(chunks):
            docs_out.append(ch)
            ids_out.append(base_id if len(chunks) == 1 else f"{base_id}#{j}")
            m = dict(base_meta)
            if len(chunks) > 1:
                m["chunk_index"] = j
                m["chunk_count"] = len(chunks)
            metas_out.append(m)

    # Chroma rejects empty metadata list — only pass if non-empty.
    kwargs: dict[str, Any] = {"documents": docs_out, "ids": ids_out}
    if any(metas_out):
        kwargs["metadatas"] = metas_out
    col.upsert(**kwargs)

    return {
        "added": len(docs_out),
        "collection": collection,
        "total_after": col.count(),
    }


@mcp.tool()
def rag_query(
    collection: str,
    query: str,
    n_results: int = 3,
    where: dict[str, Any] | None = None,
) -> dict:
    """语义检索：找跟 query 最相似的 top-N 个文档。

    Args:
        collection: collection 名
        query:      查询文本
        n_results:  返回多少条（默认 3，最多 20）
        where:      元数据过滤（如 {"source": "a.pdf"}）

    Returns: {results: [{id, document, metadata, distance}, ...]}
        distance 越小越相似（cosine 距离 0~2）
    """
    n_results = max(1, min(n_results, 20))
    try:
        col = client.get_collection(name=collection)
    except Exception:
        return {"error": f"collection '{collection}' 不存在", "results": []}
    if col.count() == 0:
        return {"results": [], "note": "collection 是空的"}

    kwargs: dict[str, Any] = {
        "query_texts": [query],
        "n_results": min(n_results, col.count()),
    }
    if where:
        kwargs["where"] = where
    raw = col.query(**kwargs)

    ids = raw.get("ids", [[]])[0]
    docs = raw.get("documents", [[]])[0] or [None] * len(ids)
    metas = raw.get("metadatas", [[]])[0] or [None] * len(ids)
    dists = raw.get("distances", [[]])[0] or [None] * len(ids)

    results = [
        {
            "id": ids[i],
            "document": docs[i],
            "metadata": metas[i] or {},
            "distance": dists[i],
        }
        for i in range(len(ids))
    ]
    return {"collection": collection, "query": query, "results": results}


@mcp.tool()
def rag_count(collection: str) -> dict:
    """返回 collection 里的文档（块）数。"""
    try:
        col = client.get_collection(name=collection)
        return {"name": collection, "count": col.count()}
    except Exception as e:
        return {"name": collection, "count": 0, "error": str(e)}


@mcp.tool()
def rag_peek(collection: str, n: int = 3) -> dict:
    """看 collection 里前 N 个文档（用于调试 / 确认内容）。"""
    n = max(1, min(n, 20))
    try:
        col = client.get_collection(name=collection)
    except Exception as e:
        return {"name": collection, "error": str(e)}
    raw = col.peek(limit=n)
    ids = raw.get("ids", [])
    docs = raw.get("documents", []) or [None] * len(ids)
    metas = raw.get("metadatas", []) or [None] * len(ids)
    return {
        "collection": collection,
        "samples": [
            {
                "id": ids[i],
                "document": (docs[i] or "")[:400],
                "metadata": metas[i] or {},
            }
            for i in range(len(ids))
        ],
    }


# --------------------------------------------------------------------------- #


def make_app():
    app = mcp.streamable_http_app()
    origin = os.environ.get("CHROMA_MCP_ORIGIN", "*")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin] if origin != "*" else ["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Mcp-Session-Id"],
    )
    return app


if __name__ == "__main__":
    host = os.environ.get("CHROMA_MCP_HOST", "127.0.0.1")
    port = int(os.environ.get("CHROMA_MCP_PORT", "8003"))
    print(
        f"Chroma MCP server starting on http://{host}:{port}/mcp "
        f"(data: {os.path.abspath(DATA_DIR)})",
        file=sys.stderr,
    )
    uvicorn.run(make_app(), host=host, port=port, log_level="info")
