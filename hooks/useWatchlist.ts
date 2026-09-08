"use client";

import { useEffect, useState } from "react";
import { isEquitySymbol } from "@/lib/providers/alpaca";

const DEFAULT_SYMBOLS = ["btcusdt", "ethusdt", "solusdt", "AAPL", "NVDA", "MSFT"];

export function useWatchlist(setCommandNotice: (notice: string) => void) {
  const [symbols, setSymbols] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("terminal_watchlist");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_SYMBOLS;
  });

  const [symbolInput, setSymbolInput] = useState("");
  const [tradableSymbols, setTradableSymbols] = useState<Set<string>>(new Set());

  // Fetch valid Binance exchange trading pairs
  useEffect(() => {
    fetch("https://api.binance.com/api/v3/exchangeInfo")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.symbols)) {
          const valid = new Set<string>(
            data.symbols
              .filter((s: any) => s.status === "TRADING")
              .map((s: any) => s.symbol.toLowerCase())
          );
          setTradableSymbols(valid);
        }
      })
      .catch(() => {});
  }, []);

  // Persist watchlist changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("terminal_watchlist", JSON.stringify(symbols));
      } catch {}
    }
  }, [symbols]);

  function addSymbol(rawSym?: string) {
    const symToAdd = (rawSym || symbolInput).trim();
    if (!symToAdd) return;

    const isEq = isEquitySymbol(symToAdd);
    const normalized = isEq ? symToAdd.toUpperCase() : symToAdd.toLowerCase();

    if (symbols.includes(normalized)) {
      setCommandNotice(`WATCHLIST: ${normalized} already present`);
      setSymbolInput("");
      return;
    }

    if (!isEq && tradableSymbols.size > 0 && !tradableSymbols.has(normalized)) {
      setCommandNotice(`WATCHLIST REJECT: ${normalized} is not a valid active trading pair`);
      return;
    }

    setSymbols((prev) => [...prev, normalized]);
    setSymbolInput("");
    setCommandNotice(`WATCHLIST: added ${normalized}`);
  }

  function removeSymbol(sym: string) {
    setSymbols((prev) => prev.filter((s) => s !== sym));
    setCommandNotice(`WATCHLIST: removed ${sym}`);
  }

  return {
    symbols,
    setSymbols,
    symbolInput,
    setSymbolInput,
    tradableSymbols,
    addSymbol,
    removeSymbol,
  };
}

