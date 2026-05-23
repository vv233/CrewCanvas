"""
Broker MCP server — Alpaca paper trading.

强制使用 paper trading endpoint，绝不连真实账户（避免误操作）。
需要 Alpaca paper trading API key：https://app.alpaca.markets/paper/dashboard/overview

环境变量：
    ALPACA_API_KEY      paper trading API key id
    ALPACA_API_SECRET   paper trading secret
    BROKER_MCP_HOST     默认 127.0.0.1
    BROKER_MCP_PORT     默认 8002
    BROKER_MCP_ORIGIN   默认 *
    BROKER_MCP_ALLOW_LIVE  设为 "1" 才允许使用 live endpoint（默认禁止）

Run:
    ./.venv/bin/python server.py
"""

from __future__ import annotations

import os
import sys
from typing import Any

import uvicorn
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.middleware.cors import CORSMiddleware


PAPER_BASE = "https://paper-api.alpaca.markets"
LIVE_BASE = "https://api.alpaca.markets"
ALLOW_LIVE = os.environ.get("BROKER_MCP_ALLOW_LIVE") == "1"

KEY = os.environ.get("ALPACA_API_KEY", "")
SECRET = os.environ.get("ALPACA_API_SECRET", "")

if not KEY or not SECRET:
    print(
        "WARN: ALPACA_API_KEY / ALPACA_API_SECRET 未设置，工具调用会失败。\n"
        "      从 https://app.alpaca.markets/paper/dashboard/overview 申请 paper key",
        file=sys.stderr,
    )

mcp = FastMCP(
    "broker",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=False
    ),
)


def _client():
    """Build the Alpaca trading client. Always paper unless explicitly opted in."""
    from alpaca.trading.client import TradingClient

    paper = not ALLOW_LIVE
    return TradingClient(KEY, SECRET, paper=paper)


def _serialize(obj) -> Any:
    """Make Alpaca SDK objects JSON-friendly."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    if hasattr(obj, "_raw"):
        return obj._raw
    if hasattr(obj, "__dict__"):
        return {k: _serialize(v) for k, v in obj.__dict__.items() if not k.startswith("_")}
    if isinstance(obj, list):
        return [_serialize(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    return obj


# --------------------------------------------------------------------------- #
# Tools                                                                       #
# --------------------------------------------------------------------------- #


@mcp.tool()
def get_account() -> dict:
    """账户概览：现金、buying power、组合价值、当前盈亏。"""
    c = _client()
    a = c.get_account()
    return {
        "mode": "paper" if not ALLOW_LIVE else "live",
        "status": str(a.status),
        "cash": float(a.cash),
        "buying_power": float(a.buying_power),
        "portfolio_value": float(a.portfolio_value),
        "equity": float(a.equity),
        "last_equity": float(a.last_equity),
        "daytrade_count": int(a.daytrade_count or 0),
        "pattern_day_trader": bool(a.pattern_day_trader),
    }


@mcp.tool()
def get_positions() -> dict:
    """当前所有持仓。"""
    c = _client()
    pos = c.get_all_positions()
    out = []
    for p in pos:
        out.append({
            "symbol": p.symbol,
            "qty": float(p.qty),
            "avg_entry_price": float(p.avg_entry_price),
            "current_price": float(p.current_price) if p.current_price else None,
            "market_value": float(p.market_value) if p.market_value else None,
            "unrealized_pl": float(p.unrealized_pl) if p.unrealized_pl else None,
            "unrealized_plpc": float(p.unrealized_plpc) if p.unrealized_plpc else None,
            "side": str(p.side),
        })
    return {"positions": out, "total": len(out)}


@mcp.tool()
def get_position(symbol: str) -> dict:
    """单个 ticker 的持仓详情。"""
    c = _client()
    try:
        p = c.get_open_position(symbol.upper())
    except Exception as e:
        return {"symbol": symbol.upper(), "qty": 0, "note": f"无持仓 ({e.__class__.__name__})"}
    return {
        "symbol": p.symbol,
        "qty": float(p.qty),
        "avg_entry_price": float(p.avg_entry_price),
        "current_price": float(p.current_price) if p.current_price else None,
        "market_value": float(p.market_value) if p.market_value else None,
        "unrealized_pl": float(p.unrealized_pl) if p.unrealized_pl else None,
        "unrealized_plpc": float(p.unrealized_plpc) if p.unrealized_plpc else None,
    }


@mcp.tool()
def place_order(
    symbol: str,
    qty: float,
    side: str,
    type: str = "market",
    limit_price: float | None = None,
    stop_price: float | None = None,
    time_in_force: str = "day",
) -> dict:
    """下单。

    Args:
        symbol:        股票代码 (e.g. AAPL)
        qty:           股数（支持小数股；负数会被转正）
        side:          "buy" or "sell"
        type:          "market" | "limit" | "stop" | "stop_limit"
        limit_price:   limit / stop_limit 必填
        stop_price:    stop / stop_limit 必填
        time_in_force: "day" | "gtc" | "ioc" | "fok"

    Returns: {order_id, status, filled_qty, ...}
    """
    from alpaca.trading.requests import (
        LimitOrderRequest, MarketOrderRequest, StopLimitOrderRequest, StopOrderRequest,
    )
    from alpaca.trading.enums import OrderSide, TimeInForce

    side_norm = side.lower()
    if side_norm not in ("buy", "sell"):
        return {"error": "side 必须是 buy 或 sell"}
    side_enum = OrderSide.BUY if side_norm == "buy" else OrderSide.SELL
    tif_map = {
        "day": TimeInForce.DAY,
        "gtc": TimeInForce.GTC,
        "ioc": TimeInForce.IOC,
        "fok": TimeInForce.FOK,
    }
    tif = tif_map.get(time_in_force.lower(), TimeInForce.DAY)
    qty_abs = abs(float(qty))
    sym = symbol.upper()

    t = type.lower()
    try:
        if t == "market":
            req = MarketOrderRequest(symbol=sym, qty=qty_abs, side=side_enum, time_in_force=tif)
        elif t == "limit":
            if limit_price is None:
                return {"error": "limit 单必须填 limit_price"}
            req = LimitOrderRequest(symbol=sym, qty=qty_abs, side=side_enum,
                                    time_in_force=tif, limit_price=limit_price)
        elif t == "stop":
            if stop_price is None:
                return {"error": "stop 单必须填 stop_price"}
            req = StopOrderRequest(symbol=sym, qty=qty_abs, side=side_enum,
                                   time_in_force=tif, stop_price=stop_price)
        elif t == "stop_limit":
            if limit_price is None or stop_price is None:
                return {"error": "stop_limit 单必须填 limit_price 和 stop_price"}
            req = StopLimitOrderRequest(symbol=sym, qty=qty_abs, side=side_enum,
                                        time_in_force=tif, limit_price=limit_price,
                                        stop_price=stop_price)
        else:
            return {"error": f"未知 order type: {type}"}

        order = _client().submit_order(req)
        return {
            "mode": "paper" if not ALLOW_LIVE else "live",
            "order_id": str(order.id),
            "client_order_id": str(order.client_order_id),
            "symbol": order.symbol,
            "qty": float(order.qty) if order.qty else None,
            "side": str(order.side),
            "type": str(order.order_type),
            "status": str(order.status),
            "submitted_at": str(order.submitted_at) if order.submitted_at else None,
            "filled_qty": float(order.filled_qty) if order.filled_qty else 0,
            "filled_avg_price": float(order.filled_avg_price) if order.filled_avg_price else None,
        }
    except Exception as e:
        return {"error": f"下单失败: {e.__class__.__name__}: {e}"}


@mcp.tool()
def cancel_order(order_id: str) -> dict:
    """按 order_id 撤单。"""
    try:
        _client().cancel_order_by_id(order_id)
        return {"order_id": order_id, "status": "cancel_requested"}
    except Exception as e:
        return {"error": f"撤单失败: {e}"}


@mcp.tool()
def list_orders(status: str = "open", limit: int = 25) -> dict:
    """列出订单。

    Args:
        status: "open" | "closed" | "all"
        limit:  1-100
    """
    from alpaca.trading.requests import GetOrdersRequest
    from alpaca.trading.enums import QueryOrderStatus

    smap = {
        "open": QueryOrderStatus.OPEN,
        "closed": QueryOrderStatus.CLOSED,
        "all": QueryOrderStatus.ALL,
    }
    qstatus = smap.get(status.lower(), QueryOrderStatus.OPEN)
    limit = max(1, min(limit, 100))
    req = GetOrdersRequest(status=qstatus, limit=limit)
    orders = _client().get_orders(req)
    out = []
    for o in orders:
        out.append({
            "order_id": str(o.id),
            "symbol": o.symbol,
            "qty": float(o.qty) if o.qty else None,
            "side": str(o.side),
            "type": str(o.order_type),
            "status": str(o.status),
            "filled_qty": float(o.filled_qty) if o.filled_qty else 0,
            "filled_avg_price": float(o.filled_avg_price) if o.filled_avg_price else None,
            "submitted_at": str(o.submitted_at) if o.submitted_at else None,
            "limit_price": float(o.limit_price) if o.limit_price else None,
            "stop_price": float(o.stop_price) if o.stop_price else None,
        })
    return {"orders": out, "count": len(out), "filter_status": status}


@mcp.tool()
def get_clock() -> dict:
    """市场是否开盘 + 下次开/关盘时间。"""
    c = _client().get_clock()
    return {
        "is_open": bool(c.is_open),
        "timestamp": str(c.timestamp),
        "next_open": str(c.next_open),
        "next_close": str(c.next_close),
    }


# --------------------------------------------------------------------------- #


def make_app():
    app = mcp.streamable_http_app()
    origin = os.environ.get("BROKER_MCP_ORIGIN", "*")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin] if origin != "*" else ["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Mcp-Session-Id"],
    )
    return app


if __name__ == "__main__":
    host = os.environ.get("BROKER_MCP_HOST", "127.0.0.1")
    port = int(os.environ.get("BROKER_MCP_PORT", "8002"))
    mode = "LIVE ⚠️" if ALLOW_LIVE else "paper"
    print(f"Broker MCP ({mode}) starting on http://{host}:{port}/mcp", file=sys.stderr)
    uvicorn.run(make_app(), host=host, port=port, log_level="info")
