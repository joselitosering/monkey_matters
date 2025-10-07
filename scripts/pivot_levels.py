"""Utilities for fetching previous trading day's OHLC data and computing pivot levels.

This module queries Yahoo Finance's chart API to obtain the most recent
end-of-day price data for a ticker symbol, identifies the previous trading
session, and computes classic floor trader pivot levels for that session.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from typing import Dict
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


YA_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
USER_AGENT = "Mozilla/5.0 (compatible; MonkeyMattersBot/1.0)"


@dataclass
class OHLC:
    """Container for open, high, low, close values."""

    open: float
    high: float
    low: float
    close: float

    def to_dict(self) -> Dict[str, float]:
        """Return a dictionary representation of the OHLC values."""

        return {"open": self.open, "high": self.high, "low": self.low, "close": self.close}


@dataclass
class PivotLevels:
    """Classic floor trader pivot levels."""

    pivot: float
    resistance_1: float
    support_1: float
    resistance_2: float
    support_2: float
    resistance_3: float
    support_3: float

    def to_dict(self) -> Dict[str, float]:
        """Return a dictionary representation of the pivot levels."""

        return {
            "pivot": self.pivot,
            "resistance_1": self.resistance_1,
            "support_1": self.support_1,
            "resistance_2": self.resistance_2,
            "support_2": self.support_2,
            "resistance_3": self.resistance_3,
            "support_3": self.support_3,
        }


class YahooFinanceError(RuntimeError):
    """Raised when Yahoo Finance's API returns an unexpected response."""


def _resolve_timezone(meta: Dict[str, object]) -> ZoneInfo:
    tz_name = meta.get("timezone") if isinstance(meta, dict) else None
    if isinstance(tz_name, str):
        try:
            return ZoneInfo(tz_name)
        except Exception:  # pragma: no cover - fallback path
            pass
    return ZoneInfo("UTC")


def _extract_previous_trading_day(result: Dict[str, object]) -> tuple[datetime, OHLC]:
    timestamps = result.get("timestamp") or []
    if not timestamps:
        raise YahooFinanceError("No timestamps returned from Yahoo Finance")

    indicators = result.get("indicators") or {}
    quotes = (indicators.get("quote") or [{}])[0]
    adjclose = (indicators.get("adjclose") or [{}])[0]
    if not quotes:
        raise YahooFinanceError("No price quotes returned from Yahoo Finance")

    tz = _resolve_timezone(result.get("meta") or {})
    prices: list[tuple[datetime, OHLC]] = []
    for idx, ts in enumerate(timestamps):
        try:
            dt = datetime.fromtimestamp(int(ts), tz=timezone.utc).astimezone(tz)
        except Exception as exc:  # pragma: no cover - invalid timestamp
            raise YahooFinanceError("Invalid timestamp received from Yahoo Finance") from exc

        o = quotes.get("open", [None])[idx] if isinstance(quotes.get("open"), list) else quotes.get("open")
        h = quotes.get("high", [None])[idx] if isinstance(quotes.get("high"), list) else quotes.get("high")
        l = quotes.get("low", [None])[idx] if isinstance(quotes.get("low"), list) else quotes.get("low")
        c = quotes.get("close", [None])[idx] if isinstance(quotes.get("close"), list) else quotes.get("close")

        if c is None and adjclose:
            ac = adjclose.get("adjclose")
            c = ac[idx] if isinstance(ac, list) else ac

        if None in (o, h, l, c):
            continue

        prices.append((dt, OHLC(float(o), float(h), float(l), float(c))))

    if not prices:
        raise YahooFinanceError("No complete OHLC data points returned from Yahoo Finance")

    today = datetime.now(tz).date()
    # Identify the latest session that is strictly before today. If none, fall back to the latest session.
    for dt, ohlc in reversed(prices):
        if dt.date() < today:
            return dt, ohlc

    # If we reach here, the only available data is for today (e.g., called after market close).
    return prices[-1]


def _fetch_json(url: str, params: Dict[str, str]) -> Dict[str, object]:
    query = urlencode(params)
    request = Request(f"{url}?{query}", headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(request, timeout=10) as response:
            payload = response.read()
    except HTTPError as exc:
        raise YahooFinanceError(f"Yahoo Finance request failed with status {exc.code}") from exc
    except URLError as exc:
        raise YahooFinanceError("Unable to reach Yahoo Finance") from exc

    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive
        raise YahooFinanceError("Yahoo Finance returned invalid JSON") from exc


def get_previous_trading_day_ohlc(symbol: str) -> tuple[datetime, OHLC]:
    """Fetch the previous trading day's OHLC data for ``symbol`` using Yahoo Finance."""

    if not symbol:
        raise ValueError("symbol must be a non-empty string")

    payload = _fetch_json(
        YA_CHART_URL.format(symbol=symbol),
        {"interval": "1d", "range": "7d", "includePrePost": "false"},
    )

    chart = payload.get("chart") or {}
    error = chart.get("error")
    if error:
        description = error.get("description") if isinstance(error, dict) else str(error)
        raise YahooFinanceError(description or "Yahoo Finance returned an error")

    results = chart.get("result")
    if not results:
        raise YahooFinanceError("Yahoo Finance response did not contain any results")

    return _extract_previous_trading_day(results[0])


def calculate_pivot_levels(ohlc: OHLC) -> PivotLevels:
    """Calculate classic floor trader pivot levels from OHLC data."""

    pivot = (ohlc.high + ohlc.low + ohlc.close) / 3
    range_ = ohlc.high - ohlc.low

    resistance_1 = 2 * pivot - ohlc.low
    support_1 = 2 * pivot - ohlc.high
    resistance_2 = pivot + range_
    support_2 = pivot - range_
    resistance_3 = ohlc.high + 2 * (pivot - ohlc.low)
    support_3 = ohlc.low - 2 * (ohlc.high - pivot)

    return PivotLevels(
        pivot=pivot,
        resistance_1=resistance_1,
        support_1=support_1,
        resistance_2=resistance_2,
        support_2=support_2,
        resistance_3=resistance_3,
        support_3=support_3,
    )


def format_levels(levels: PivotLevels) -> str:
    """Return a formatted string for displaying pivot levels."""

    lines = ["Pivot Levels:"]
    for key, value in levels.to_dict().items():
        lines.append(f"  {key.replace('_', ' ').title()}: {value:.2f}")
    return "\n".join(lines)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("symbol", help="Ticker symbol to fetch (e.g. AAPL, MSFT, ES=F)")
    args = parser.parse_args()

    dt, ohlc = get_previous_trading_day_ohlc(args.symbol)
    levels = calculate_pivot_levels(ohlc)

    print(f"Previous trading day ({dt.date()}) OHLC for {args.symbol.upper()}:")
    for key, value in ohlc.to_dict().items():
        print(f"  {key.title()}: {value:.2f}")
    print()
    print(format_levels(levels))


if __name__ == "__main__":
    main()
