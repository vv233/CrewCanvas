"""
Finance MCP server — exposes market data tools to AI Org Flow agents.

Transport: Streamable HTTP, browser-friendly (CORS allowed).
Data source: yfinance (no API key needed) + small in-process pandas calcs.

Run:
    uv run server.py             # or: python server.py
Then in AI Org Flow:
    Agent inspector → MCP tools → Add server
        Transport: local
        Name:      finance
        URL:       http://localhost:8000/mcp
"""

from __future__ import annotations

import math
import os
import sys
from datetime import date, datetime, timedelta
from typing import Any

import pandas as pd
import uvicorn
import yfinance as yf
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.middleware.cors import CORSMiddleware

# FastMCP 默认 host=127.0.0.1 会自动开 DNS rebinding 防护，导致从其他 Host 头
# （如 Tailscale IP）访问被 421 拒绝。我们关掉该防护——CORS 已经能阻止跨域脚本
# 通过 DNS rebinding 攻击本机服务。
mcp = FastMCP(
    "finance",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=False
    ),
)

# --------------------------------------------------------------------------- #
# Helpers                                                                     #
# --------------------------------------------------------------------------- #


def _safe(v: Any) -> Any:
    """Make a value JSON-friendly (NaN/inf → None, numpy scalars → python)."""
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return float(v)
    if hasattr(v, "item"):
        try:
            return v.item()
        except Exception:
            return str(v)
    if isinstance(v, (datetime, date, pd.Timestamp)):
        return v.isoformat()
    if isinstance(v, dict):
        return {k: _safe(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_safe(x) for x in v]
    return v


def _normalize_ticker(t: str) -> str:
    return t.strip().upper()


def _last_n_history(ticker: str, days: int) -> pd.DataFrame:
    end = datetime.utcnow() + timedelta(days=1)
    start = end - timedelta(days=days + 14)  # buffer for weekends/holidays
    df = yf.Ticker(ticker).history(start=start, end=end, auto_adjust=False)
    return df.tail(days)


# --------------------------------------------------------------------------- #
# Tools                                                                       #
# --------------------------------------------------------------------------- #


@mcp.tool()
def get_quote(ticker: str, date: str | None = None) -> dict:
    """获取股票当日（或指定日期）的 OHLCV 报价。

    Args:
        ticker: 股票代码，如 "AAPL"
        date:   ISO 日期字符串 (YYYY-MM-DD)。留空 = 最近的交易日

    Returns: {date, open, high, low, close, volume, currency, change_pct}
    """
    t = _normalize_ticker(ticker)
    if date:
        target = pd.Timestamp(date)
        df = yf.Ticker(t).history(
            start=target - pd.Timedelta(days=7),
            end=target + pd.Timedelta(days=1),
            auto_adjust=False,
        )
        if df.empty:
            return {"error": f"无 {t} 在 {date} 附近的数据"}
        row = df.iloc[-1]
        actual = df.index[-1].date().isoformat()
    else:
        df = _last_n_history(t, 5)
        if df.empty:
            return {"error": f"无 {t} 数据"}
        row = df.iloc[-1]
        actual = df.index[-1].date().isoformat()

    prev_close = float(df.iloc[-2]["Close"]) if len(df) >= 2 else float(row["Close"])
    change_pct = ((float(row["Close"]) - prev_close) / prev_close) * 100 if prev_close else None

    info = yf.Ticker(t).fast_info
    currency = getattr(info, "currency", None) or "USD"

    return _safe({
        "ticker": t,
        "date": actual,
        "open": float(row["Open"]),
        "high": float(row["High"]),
        "low": float(row["Low"]),
        "close": float(row["Close"]),
        "volume": int(row["Volume"]),
        "currency": currency,
        "change_pct_vs_prev_close": change_pct,
    })


@mcp.tool()
def get_history(ticker: str, days: int = 60) -> dict:
    """获取最近 N 天的 OHLCV 历史。

    Args:
        ticker: 股票代码
        days:   返回多少个交易日（默认 60，最大 250）

    Returns: {ticker, bars: [{date, open, high, low, close, volume}, ...]}
    """
    days = max(1, min(days, 250))
    t = _normalize_ticker(ticker)
    df = _last_n_history(t, days)
    if df.empty:
        return {"error": f"无 {t} 数据"}
    bars = []
    for ts, row in df.iterrows():
        bars.append({
            "date": ts.date().isoformat(),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "volume": int(row["Volume"]),
        })
    return _safe({"ticker": t, "bars": bars})


@mcp.tool()
def get_financials(ticker: str) -> dict:
    """获取公司核心财务/估值指标。

    Returns: market_cap, pe, forward_pe, pb, ps, dividend_yield,
             profit_margin, operating_margin, revenue_growth, debt_to_equity,
             return_on_equity, free_cash_flow, beta, 52w_high, 52w_low ...
    """
    t = _normalize_ticker(ticker)
    info = yf.Ticker(t).info or {}
    picked = {
        "ticker": t,
        "long_name": info.get("longName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "market_cap": info.get("marketCap"),
        "enterprise_value": info.get("enterpriseValue"),
        "pe_trailing": info.get("trailingPE"),
        "pe_forward": info.get("forwardPE"),
        "pb": info.get("priceToBook"),
        "ps": info.get("priceToSalesTrailing12Months"),
        "ev_to_ebitda": info.get("enterpriseToEbitda"),
        "dividend_yield": info.get("dividendYield"),
        "profit_margin": info.get("profitMargins"),
        "operating_margin": info.get("operatingMargins"),
        "gross_margin": info.get("grossMargins"),
        "revenue_growth_yoy": info.get("revenueGrowth"),
        "earnings_growth_yoy": info.get("earningsGrowth"),
        "debt_to_equity": info.get("debtToEquity"),
        "current_ratio": info.get("currentRatio"),
        "return_on_equity": info.get("returnOnEquity"),
        "return_on_assets": info.get("returnOnAssets"),
        "free_cash_flow": info.get("freeCashflow"),
        "beta": info.get("beta"),
        "52w_high": info.get("fiftyTwoWeekHigh"),
        "52w_low": info.get("fiftyTwoWeekLow"),
        "200d_avg": info.get("twoHundredDayAverage"),
        "50d_avg": info.get("fiftyDayAverage"),
    }
    return _safe(picked)


@mcp.tool()
def get_company_info(ticker: str) -> dict:
    """公司业务概况、行业、员工数等基本信息。"""
    t = _normalize_ticker(ticker)
    info = yf.Ticker(t).info or {}
    return _safe({
        "ticker": t,
        "long_name": info.get("longName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "country": info.get("country"),
        "website": info.get("website"),
        "employees": info.get("fullTimeEmployees"),
        "summary": (info.get("longBusinessSummary") or "")[:1200],
    })


@mcp.tool()
def get_news(ticker: str, limit: int = 10) -> dict:
    """最近的相关新闻（来自 yfinance 聚合源）。

    Args:
        ticker: 股票代码
        limit:  最多返回多少条（默认 10，最大 30）

    Returns: {ticker, news: [{title, publisher, link, published, summary?}, ...]}
    """
    limit = max(1, min(limit, 30))
    t = _normalize_ticker(ticker)
    raw = yf.Ticker(t).news or []
    out = []
    for item in raw[:limit]:
        # yfinance changes shape across versions; handle both flat and nested.
        content = item.get("content") if isinstance(item.get("content"), dict) else item
        title = content.get("title") or item.get("title")
        publisher = (
            (content.get("provider") or {}).get("displayName")
            if isinstance(content.get("provider"), dict)
            else content.get("publisher") or item.get("publisher")
        )
        link = (
            (content.get("canonicalUrl") or {}).get("url")
            if isinstance(content.get("canonicalUrl"), dict)
            else content.get("link") or item.get("link")
        )
        published = (
            content.get("pubDate")
            or item.get("providerPublishTime")
        )
        if isinstance(published, (int, float)):
            published = datetime.utcfromtimestamp(published).isoformat()
        summary = (content.get("summary") or "")[:400]
        out.append({
            "title": title,
            "publisher": publisher,
            "link": link,
            "published": published,
            "summary": summary,
        })
    return _safe({"ticker": t, "news": out})


@mcp.tool()
def get_recommendations(ticker: str) -> dict:
    """分析师评级分布及历史趋势（最近 4 个季度）。"""
    t = _normalize_ticker(ticker)
    try:
        df = yf.Ticker(t).recommendations
    except Exception as e:
        return {"error": f"无评级数据: {e}"}
    if df is None or df.empty:
        return {"ticker": t, "buckets": None, "note": "无评级数据"}
    df = df.tail(4)
    buckets = []
    for _, row in df.iterrows():
        buckets.append({
            "period": str(row.get("period", "")),
            "strong_buy": int(row.get("strongBuy", 0)),
            "buy": int(row.get("buy", 0)),
            "hold": int(row.get("hold", 0)),
            "sell": int(row.get("sell", 0)),
            "strong_sell": int(row.get("strongSell", 0)),
        })
    return _safe({"ticker": t, "buckets": buckets})


@mcp.tool()
def get_technical(ticker: str, indicators: list[str] | None = None) -> dict:
    """计算常用技术指标（基于最近 250 个交易日）。

    Args:
        ticker:     股票代码
        indicators: 子集，默认全部计算。可选项:
                    sma20, sma50, sma200, ema12, ema26,
                    rsi14, macd, bollinger, vol_avg30

    Returns: 每个指标的最新值 + 趋势方向（last vs prev）
    """
    t = _normalize_ticker(ticker)
    df = _last_n_history(t, 250)
    if df.empty or len(df) < 30:
        return {"error": f"{t} 数据不足"}
    close = df["Close"]
    vol = df["Volume"]
    wanted = set(indicators or [
        "sma20", "sma50", "sma200",
        "ema12", "ema26",
        "rsi14", "macd", "bollinger", "vol_avg30",
    ])
    out: dict[str, Any] = {"ticker": t, "as_of": df.index[-1].date().isoformat()}

    def trend(series: pd.Series) -> str:
        if len(series) < 2:
            return "flat"
        a, b = float(series.iloc[-1]), float(series.iloc[-2])
        if a > b: return "up"
        if a < b: return "down"
        return "flat"

    if "sma20" in wanted and len(close) >= 20:
        s = close.rolling(20).mean()
        out["sma20"] = {"value": float(s.iloc[-1]), "trend": trend(s)}
    if "sma50" in wanted and len(close) >= 50:
        s = close.rolling(50).mean()
        out["sma50"] = {"value": float(s.iloc[-1]), "trend": trend(s)}
    if "sma200" in wanted and len(close) >= 200:
        s = close.rolling(200).mean()
        out["sma200"] = {"value": float(s.iloc[-1]), "trend": trend(s)}
    if "ema12" in wanted:
        s = close.ewm(span=12, adjust=False).mean()
        out["ema12"] = {"value": float(s.iloc[-1]), "trend": trend(s)}
    if "ema26" in wanted:
        s = close.ewm(span=26, adjust=False).mean()
        out["ema26"] = {"value": float(s.iloc[-1]), "trend": trend(s)}
    if "rsi14" in wanted and len(close) >= 15:
        delta = close.diff()
        up = delta.clip(lower=0).rolling(14).mean()
        down = (-delta.clip(upper=0)).rolling(14).mean()
        rs = up / down.replace(0, 1e-10)
        rsi = 100 - (100 / (1 + rs))
        rsi_v = float(rsi.iloc[-1])
        zone = "neutral"
        if rsi_v >= 70: zone = "overbought"
        elif rsi_v <= 30: zone = "oversold"
        out["rsi14"] = {"value": rsi_v, "zone": zone}
    if "macd" in wanted:
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd = ema12 - ema26
        signal = macd.ewm(span=9, adjust=False).mean()
        hist = macd - signal
        out["macd"] = {
            "macd": float(macd.iloc[-1]),
            "signal": float(signal.iloc[-1]),
            "histogram": float(hist.iloc[-1]),
            "cross": "bullish" if hist.iloc[-1] > 0 and hist.iloc[-2] <= 0
                     else "bearish" if hist.iloc[-1] < 0 and hist.iloc[-2] >= 0
                     else "none",
        }
    if "bollinger" in wanted and len(close) >= 20:
        ma = close.rolling(20).mean()
        std = close.rolling(20).std()
        upper = ma + 2 * std
        lower = ma - 2 * std
        last = float(close.iloc[-1])
        out["bollinger"] = {
            "upper": float(upper.iloc[-1]),
            "middle": float(ma.iloc[-1]),
            "lower": float(lower.iloc[-1]),
            "price": last,
            "position": "above_upper" if last > upper.iloc[-1]
                        else "below_lower" if last < lower.iloc[-1]
                        else "in_band",
        }
    if "vol_avg30" in wanted and len(vol) >= 30:
        avg = vol.rolling(30).mean()
        out["vol_avg30"] = {
            "value": float(avg.iloc[-1]),
            "last_volume": int(vol.iloc[-1]),
            "ratio": float(vol.iloc[-1] / avg.iloc[-1]) if avg.iloc[-1] else None,
        }

    out["last_close"] = float(close.iloc[-1])
    return _safe(out)


# --------------------------------------------------------------------------- #
# HTTP entrypoint with CORS                                                   #
# --------------------------------------------------------------------------- #


def make_app():
    """Return the FastMCP Starlette app wrapped in CORS middleware.

    CORS is permissive by default (any origin) — fine for personal/local use.
    Set FINANCE_MCP_ORIGIN=https://your-site.example to restrict.
    """
    app = mcp.streamable_http_app()
    origin = os.environ.get("FINANCE_MCP_ORIGIN", "*")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin] if origin != "*" else ["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Mcp-Session-Id"],
        allow_credentials=False,
    )
    return app


if __name__ == "__main__":
    host = os.environ.get("FINANCE_MCP_HOST", "127.0.0.1")
    port = int(os.environ.get("FINANCE_MCP_PORT", "8000"))
    print(f"Finance MCP server starting on http://{host}:{port}/mcp", file=sys.stderr)
    uvicorn.run(make_app(), host=host, port=port, log_level="info")
