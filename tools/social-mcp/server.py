"""
Social sentiment MCP server — Reddit-based ticker mentions / hot posts.

数据来源：Reddit 公开 JSON API（无需 OAuth，但需要 User-Agent；轻度 rate limit）。

Run:
    ./.venv/bin/python server.py
"""

from __future__ import annotations

import os
import re
import sys
from collections import Counter
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import quote

import httpx
import uvicorn
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.middleware.cors import CORSMiddleware

# Disable DNS rebinding protection so non-localhost Host headers (Tailscale IP,
# LAN IP, public domain) aren't rejected with HTTP 421. CORS is the real defense.
mcp = FastMCP(
    "social",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=False
    ),
)

UA = os.environ.get(
    "SOCIAL_MCP_UA",
    "ai-org-flow-social-mcp/0.1 (by /u/anon)",
)

# Simple bullish/bearish lexicons (rough but works for cheap baseline).
BULL = {
    "moon", "rocket", "🚀", "buy", "bought", "long", "calls", "yolo",
    "bullish", "rally", "pump", "breakout", "all in", "up", "green",
    "diamond hands", "💎", "tendies", "🎯", "to the moon",
}
BEAR = {
    "short", "puts", "bearish", "dump", "tank", "crash", "drop", "down",
    "sell", "sold", "bagholder", "rug", "rugpull", "rugged", "guh",
    "bear", "red", "💀", "🩸", "down bad",
}


# --------------------------------------------------------------------------- #


async def reddit_json(path: str, params: dict | None = None) -> dict:
    """GET a reddit JSON endpoint with proper UA."""
    url = f"https://www.reddit.com{path}"
    async with httpx.AsyncClient(headers={"User-Agent": UA}, timeout=15) as client:
        r = await client.get(url, params=params or {})
        if r.status_code == 429:
            raise RuntimeError("Reddit rate limited; 等几秒再试")
        r.raise_for_status()
        return r.json()


def post_age_days(created_utc: float | int) -> float:
    return (datetime.utcnow().timestamp() - created_utc) / 86400


def score_text(text: str) -> dict:
    lower = text.lower()
    bull = sum(1 for kw in BULL if kw in lower)
    bear = sum(1 for kw in BEAR if kw in lower)
    return {"bull_signals": bull, "bear_signals": bear}


def matches_ticker(text: str, ticker: str) -> bool:
    """Loose match: looks for $TICKER or whole-word TICKER."""
    pat = re.compile(rf"(\${ticker}\b|\b{ticker}\b)", re.IGNORECASE)
    return bool(pat.search(text))


# --------------------------------------------------------------------------- #
# Tools                                                                       #
# --------------------------------------------------------------------------- #


@mcp.tool()
async def get_reddit_mentions(
    ticker: str,
    subreddits: list[str] | None = None,
    limit: int = 25,
) -> dict:
    """搜索 ticker 在指定 subreddit 里的最近帖子。

    Args:
        ticker:     股票代码，例 "AAPL"
        subreddits: 子板块列表，默认 ['wallstreetbets','stocks','investing']
        limit:      每个子板块抓多少条（默认 25，最多 100）

    Returns:
        {ticker, hits: [{subreddit, title, score, num_comments, age_days, url, bull, bear}, ...],
         summary: {total, total_score, avg_age_days, bull_signals, bear_signals}}
    """
    limit = max(1, min(limit, 100))
    ticker = ticker.upper().strip()
    subs = subreddits or ["wallstreetbets", "stocks", "investing"]
    hits = []
    total_bull = 0
    total_bear = 0
    total_score = 0
    for sub in subs:
        try:
            data = await reddit_json(
                f"/r/{sub}/search.json",
                {"q": ticker, "restrict_sr": "1", "sort": "new", "limit": limit},
            )
        except Exception as e:
            hits.append({"subreddit": sub, "error": str(e)})
            continue
        for child in data.get("data", {}).get("children", []):
            d = child.get("data", {})
            title = d.get("title", "")
            selftext = d.get("selftext", "")[:400]
            combined = f"{title}\n{selftext}"
            if not matches_ticker(combined, ticker):
                continue
            sc = score_text(combined)
            total_bull += sc["bull_signals"]
            total_bear += sc["bear_signals"]
            score = int(d.get("score", 0))
            total_score += score
            hits.append({
                "subreddit": sub,
                "title": title[:180],
                "score": score,
                "num_comments": int(d.get("num_comments", 0)),
                "age_days": round(post_age_days(d.get("created_utc", 0)), 2),
                "url": f"https://reddit.com{d.get('permalink', '')}",
                "bull": sc["bull_signals"],
                "bear": sc["bear_signals"],
            })
    hits.sort(key=lambda x: x.get("score", 0), reverse=True)
    return {
        "ticker": ticker,
        "hits": hits[:limit],
        "summary": {
            "total": len(hits),
            "total_score": total_score,
            "bull_signals": total_bull,
            "bear_signals": total_bear,
            "net_signal": total_bull - total_bear,
        },
    }


@mcp.tool()
async def get_subreddit_hot(subreddit: str, limit: int = 15) -> dict:
    """获取某 subreddit 的热门帖（看大盘情绪有用）。

    Args:
        subreddit: 例 "wallstreetbets"
        limit:     1-50
    """
    limit = max(1, min(limit, 50))
    data = await reddit_json(f"/r/{subreddit}/hot.json", {"limit": limit})
    posts = []
    for child in data.get("data", {}).get("children", []):
        d = child.get("data", {})
        title = d.get("title", "")
        sc = score_text(title)
        posts.append({
            "title": title[:200],
            "score": int(d.get("score", 0)),
            "num_comments": int(d.get("num_comments", 0)),
            "flair": d.get("link_flair_text"),
            "age_days": round(post_age_days(d.get("created_utc", 0)), 2),
            "bull": sc["bull_signals"],
            "bear": sc["bear_signals"],
            "url": f"https://reddit.com{d.get('permalink', '')}",
        })
    return {"subreddit": subreddit, "posts": posts}


@mcp.tool()
async def get_ticker_sentiment(ticker: str, days: int = 7) -> dict:
    """综合多个子板块给出 ticker 的情绪信号。

    比 get_reddit_mentions 更精炼：只返回打分汇总，不返回逐条帖子。

    Returns:
        {ticker, window_days, mention_count, total_score, bull_count, bear_count,
         net_signal_norm: -1..+1, top_phrases: [...], verdict: 'bullish'|'bearish'|'mixed'|'no_data'}
    """
    days = max(1, min(days, 30))
    data = await get_reddit_mentions(
        ticker,
        subreddits=["wallstreetbets", "stocks", "investing", "StockMarket"],
        limit=50,
    )
    recent = [h for h in data["hits"] if h.get("age_days", 999) <= days]
    if not recent:
        return {"ticker": ticker.upper(), "verdict": "no_data", "window_days": days}
    bull = sum(h["bull"] for h in recent)
    bear = sum(h["bear"] for h in recent)
    total = bull + bear
    norm = (bull - bear) / total if total > 0 else 0
    # collect top phrases (simple noun-ish guess: 2-3 word capitalized chunks)
    titles = " ".join(h["title"] for h in recent)
    chunks = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b", titles)
    top = [w for w, _ in Counter(chunks).most_common(5)]
    verdict = (
        "bullish" if norm > 0.2
        else "bearish" if norm < -0.2
        else "mixed"
    )
    return {
        "ticker": ticker.upper(),
        "window_days": days,
        "mention_count": len(recent),
        "total_score": sum(h["score"] for h in recent),
        "bull_signals": bull,
        "bear_signals": bear,
        "net_signal_norm": round(norm, 3),
        "top_phrases": top,
        "verdict": verdict,
    }


# --------------------------------------------------------------------------- #


def make_app():
    app = mcp.streamable_http_app()
    origin = os.environ.get("SOCIAL_MCP_ORIGIN", "*")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin] if origin != "*" else ["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Mcp-Session-Id"],
    )
    return app


if __name__ == "__main__":
    host = os.environ.get("SOCIAL_MCP_HOST", "127.0.0.1")
    port = int(os.environ.get("SOCIAL_MCP_PORT", "8001"))
    print(f"Social MCP server starting on http://{host}:{port}/mcp", file=sys.stderr)
    uvicorn.run(make_app(), host=host, port=port, log_level="info")
