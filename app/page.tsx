/**
 * Bloomberg Professional Terminal - Core Workstation
 * Coordinates real-time market data panels, greedy masonry layout distribution,
 * multi-token Bloomberg command routing, and interactive workspace state.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import CommandBar, { CommandResult } from "@/components/CommandBar";
import { parseCommand } from "@/lib/commands";
import IndicesPanel from "@/components/panels/IndicesPanel";
import MacroPanel from "@/components/panels/MacroPanel";
import NewsPanel from "@/components/panels/NewsPanel";
import EdgarPanel from "@/components/panels/EdgarPanel";
import FundamentalsPanel from "@/components/panels/FundamentalsPanel";
import ChartPanel from "@/components/panels/ChartPanel";
import OptionsPanel from "@/components/panels/OptionsPanel";
import EconomicCalendarPanel from "@/components/panels/EconomicCalendarPanel";
import OrderBookPanel from "@/components/panels/OrderBookPanel";
import SentimentPanel from "@/components/panels/SentimentPanel";
import YieldCurvePanel from "@/components/panels/YieldCurvePanel";
import CompanyDossierPanel from "@/components/panels/CompanyDossierPanel";
import AnalystRecommendationsPanel from "@/components/panels/AnalystRecommendationsPanel";
import EarningsPanel from "@/components/panels/EarningsPanel";
import MarketMoversPanel from "@/components/panels/MarketMoversPanel";
import FxCrossMatrixPanel from "@/components/panels/FxCrossMatrixPanel";
import CommoditiesPanel from "@/components/panels/CommoditiesPanel";
import DividendPanel from "@/components/panels/DividendPanel";
import RelativeValuationPanel from "@/components/panels/RelativeValuationPanel";
import FedRateProbabilitiesPanel from "@/components/panels/FedRateProbabilitiesPanel";
import WorldBondsPanel from "@/components/panels/WorldBondsPanel";
import CorrelationMatrixPanel from "@/components/panels/CorrelationMatrixPanel";
import VolatilityPanel from "@/components/panels/VolatilityPanel";
import InstitutionalHoldingsPanel from "@/components/panels/InstitutionalHoldingsPanel";
import TimeAndSalesPanel from "@/components/panels/TimeAndSalesPanel";
import SecurityFinderPanel from "@/components/panels/SecurityFinderPanel";
import { isEquitySymbol } from "@/lib/providers/alpaca";

import { PANEL_MAP, ALL_PANEL_IDS } from "@/config/panels";
import { useTerminalKeyboard } from "@/hooks/useTerminalKeyboard";
import { useWatchlist } from "@/hooks/useWatchlist";
import TerminalHeader from "@/components/layout/TerminalHeader";
import LayoutToolbar from "@/components/layout/LayoutToolbar";
import PanelManagerDrawer from "@/components/layout/PanelManagerDrawer";
import MobileCategoryBar, { MobileTab } from "@/components/layout/MobileCategoryBar";
import WatchlistColumn from "@/components/layout/WatchlistColumn";

const ESTIMATED_HEIGHTS: Record<string, number> = {
  dossier: 520,
  fundamentals: 500,
  edgar: 480,
  options: 460,
  movers: 420,
  analyst: 380,
  earnings: 380,
  holders: 380,
  indices: 360,
  yield: 360,
  calendar: 360,
  dividend: 350,
  valuation: 350,
  fxMatrix: 300,
  commodities: 300,
  wirp: 290,
  wbon: 290,
  corr: 300,
  vol: 300,
  qr: 300,
  sentiment: 280,
};

export default function Home() {
  const [commandNotice, setCommandNotice] = useState("READY");
  const [newsQuery, setNewsQuery] = useState("");
  const [macroQuery, setMacroQuery] = useState("");
  const [edgarTicker, setEdgarTicker] = useState("AAPL");
  const [edgarForm, setEdgarForm] = useState("ALL");
  const [fundamentalsTicker, setFundamentalsTicker] = useState("AAPL");
  const [chartSymbol, setChartSymbol] = useState("AAPL");
  const [optionsSymbol, setOptionsSymbol] = useState("AAPL");
  const [dossierTicker, setDossierTicker] = useState("AAPL");
  const [analystTicker, setAnalystTicker] = useState("AAPL");
  const [earningsTicker, setEarningsTicker] = useState("NVDA");
  const [commoditiesQuery, setCommoditiesQuery] = useState("");
  const [dividendTicker, setDividendTicker] = useState("AAPL");
  const [valuationTicker, setValuationTicker] = useState("AAPL");
  const [newsCategory, setNewsCategory] = useState("ALL");
  const [fxPair, setFxPair] = useState<{ from: string; to: string }>({ from: "USD", to: "" });
  const {
    symbols,
    setSymbols,
    symbolInput,
    setSymbolInput,
    tradableSymbols,
    addSymbol,
    removeSymbol,
  } = useWatchlist(setCommandNotice);

  const [holdersTicker, setHoldersTicker] = useState("AAPL");
  const [qrSymbol, setQrSymbol] = useState("BTCUSDT");
  const [secfQuery, setSecfQuery] = useState("");
  const [isSecfVisible, setIsSecfVisible] = useState(false);
  const [gridCols, setGridCols] = useState<1 | 2 | 3>(2);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("terminal_grid_cols");
      if (saved === "1" || saved === "2" || saved === "3") {
        setGridCols(parseInt(saved, 10) as 1 | 2 | 3);
      }
    } catch {}
  }, []);

  const [hiddenPanels, setHiddenPanels] = useState<Set<string>>(new Set());
  const [showPanelManager, setShowPanelManager] = useState(false);
  const [isWatchlistVisible, setIsWatchlistVisible] = useState(true);
  const [mobileTab, setMobileTab] = useState<'all' | 'market' | 'research' | 'macro'>('all');

  // Sequential Panel Focus Ring State (Tab / Shift+Tab)
  const [focusedPanelIndex, setFocusedPanelIndex] = useState<number | null>(null);

  // Refs for scroll-into-view and command bar auto-focus.
  const commandBarRef = useRef<HTMLInputElement>(null);
  const secfPanelRef = useRef<HTMLElement>(null);
  const chartPanelRef = useRef<HTMLElement>(null);
  const fundamentalsPanelRef = useRef<HTMLElement>(null);
  const optionsPanelRef = useRef<HTMLElement>(null);
  const calendarPanelRef = useRef<HTMLElement>(null);
  const edgarPanelRef = useRef<HTMLElement>(null);
  const newsPanelRef = useRef<HTMLElement>(null);
  const macroPanelRef = useRef<HTMLElement>(null);
  const indicesPanelRef = useRef<HTMLElement>(null);
  const yieldPanelRef = useRef<HTMLElement>(null);
  const sentimentPanelRef = useRef<HTMLElement>(null);
  const dossierPanelRef = useRef<HTMLElement>(null);
  const analystPanelRef = useRef<HTMLElement>(null);
  const earningsPanelRef = useRef<HTMLElement>(null);
  const moversPanelRef = useRef<HTMLElement>(null);
  const fxMatrixPanelRef = useRef<HTMLElement>(null);
  const commoditiesPanelRef = useRef<HTMLElement>(null);
  const dividendPanelRef = useRef<HTMLElement>(null);
  const valuationPanelRef = useRef<HTMLElement>(null);
  const wirpPanelRef = useRef<HTMLElement>(null);
  const wbonPanelRef = useRef<HTMLElement>(null);
  const corrPanelRef = useRef<HTMLElement>(null);
  const volPanelRef = useRef<HTMLElement>(null);
  const holdersPanelRef = useRef<HTMLElement>(null);
  const qrPanelRef = useRef<HTMLElement>(null);

  const ALL_PANEL_REFS = [
    secfPanelRef,
    chartPanelRef,
    dossierPanelRef,
    analystPanelRef,
    earningsPanelRef,
    moversPanelRef,
    fxMatrixPanelRef,
    commoditiesPanelRef,
    dividendPanelRef,
    valuationPanelRef,
    holdersPanelRef,
    fundamentalsPanelRef,
    optionsPanelRef,
    calendarPanelRef,
    edgarPanelRef,
    indicesPanelRef,
    yieldPanelRef,
    wirpPanelRef,
    wbonPanelRef,
    corrPanelRef,
    volPanelRef,
    qrPanelRef,
    sentimentPanelRef,
    macroPanelRef,
    newsPanelRef,
  ];

  // Auto-focus the command bar on mount — Bloomberg paradigm.
  useEffect(() => {
    commandBarRef.current?.focus({ preventScroll: true });
  }, []);

  // Global Bloomberg Hotkeys & Sequential Panel Focus Ring (Tab / Shift+Tab)
  useTerminalKeyboard({
    allPanelRefs: ALL_PANEL_REFS,
    commandBarRef,
    indicesPanelRef,
    moversPanelRef,
    fxMatrixPanelRef,
    commoditiesPanelRef,
    calendarPanelRef,
    setFocusedPanelIndex,
    setCommandNotice,
    scrollToPanel,
  });

  function scrollToPanel(ref: React.RefObject<HTMLElement | null>) {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }

  function handleCommand(result: CommandResult) {
    if (result.command === "HELP") {
      setCommandNotice("HELP: SECF [QUERY] | CHART [SYM] | DES [TICKER] | FA [TICKER] | ANR [TICKER] | EARN [TICKER] | MOST | FXC | COMM | OMON [SYM] | ECO | EDGAR [TICKER] | WEI");
      return;
    }

    if (result.command === "UNKNOWN") {
      setCommandNotice(`UNKNOWN COMMAND: ${result.input || "EMPTY"}`);
      return;
    }

    if (result.command === "SECF") {
      setSecfQuery(result.query || "");
      setIsSecfVisible(true);
      scrollToPanel(secfPanelRef);
      setCommandNotice(`SECF ROUTED: ${result.query ? `"${result.query}" ` : ""}UNIVERSAL SECURITY FINDER`);
      return;
    }

    if (result.command === "CHART") {
      setChartSymbol(result.symbol);
      scrollToPanel(chartPanelRef);
      setCommandNotice(`CHART ROUTED: ${result.symbol}`);
      return;
    }

    if (result.command === "DES") {
      setDossierTicker(result.ticker);
      scrollToPanel(dossierPanelRef);
      setCommandNotice(`DES ROUTED: ${result.ticker} COMPANY DOSSIER`);
      return;
    }

    if (result.command === "FA") {
      setFundamentalsTicker(result.ticker);
      scrollToPanel(fundamentalsPanelRef);
      setCommandNotice(`FA ROUTED: ${result.ticker} FINANCIAL STATEMENTS`);
      return;
    }

    if (result.command === "ANR") {
      setAnalystTicker(result.ticker);
      scrollToPanel(analystPanelRef);
      setCommandNotice(`ANR ROUTED: ${result.ticker} ANALYST RECOMMENDATIONS`);
      return;
    }

    if (result.command === "EARN") {
      setEarningsTicker(result.ticker);
      scrollToPanel(earningsPanelRef);
      setCommandNotice(`EARN ROUTED: ${result.ticker} EARNINGS SURPRISES`);
      return;
    }

    if (result.command === "MOST") {
      scrollToPanel(moversPanelRef);
      setCommandNotice("MOST ROUTED: MARKET MOVERS & VOLUME LEADERS");
      return;
    }

    if (result.command === "FXC") {
      scrollToPanel(fxMatrixPanelRef);
      setCommandNotice("FXC ROUTED: 8x8 FOREIGN EXCHANGE CROSS MATRIX");
      return;
    }

    if (result.command === "COMM") {
      if (result.query) setCommoditiesQuery(result.query);
      scrollToPanel(commoditiesPanelRef);
      setCommandNotice(`COMM ROUTED: ${result.query ? result.query + " " : ""}GLOBAL COMMODITIES & BENCHMARKS`);
      return;
    }

    if (result.command === "DVD") {
      setDividendTicker(result.ticker);
      scrollToPanel(dividendPanelRef);
      setCommandNotice(`DVD ROUTED: ${result.ticker} DIVIDEND INTELLIGENCE`);
      return;
    }

    if (result.command === "RV") {
      setValuationTicker(result.ticker);
      scrollToPanel(valuationPanelRef);
      setCommandNotice(`RV ROUTED: ${result.ticker} RELATIVE VALUATION`);
      return;
    }

    if (result.command === "WIRP") {
      scrollToPanel(wirpPanelRef);
      setCommandNotice("WIRP ROUTED: WORLD INTEREST RATE PROBABILITIES");
      return;
    }

    if (result.command === "WBON") {
      scrollToPanel(wbonPanelRef);
      setCommandNotice("WBON ROUTED: WORLD SOVEREIGN BOND BENCHMARKS");
      return;
    }

    if (result.command === "CORR") {
      scrollToPanel(corrPanelRef);
      setCommandNotice("CORR ROUTED: CROSS-ASSET CORRELATION MATRIX");
      return;
    }

    if (result.command === "VOL") {
      scrollToPanel(volPanelRef);
      setCommandNotice("VOL ROUTED: VOLATILITY SURFACE & VIX TERM STRUCTURE");
      return;
    }

    if (result.command === "HDS") {
      setHoldersTicker(result.ticker);
      scrollToPanel(holdersPanelRef);
      setCommandNotice(`HDS ROUTED: ${result.ticker} INSTITUTIONAL HOLDERS`);
      return;
    }

    if (result.command === "QR") {
      setQrSymbol(result.symbol);
      scrollToPanel(qrPanelRef);
      setCommandNotice(`QR ROUTED: ${result.symbol} TIME & SALES TRADE TAPE`);
      return;
    }

    if (result.command === "OMON") {
      setOptionsSymbol(result.symbol);
      scrollToPanel(optionsPanelRef);
      setCommandNotice(`OMON ROUTED: ${result.symbol} OPTIONS CHAIN`);
      return;
    }

    if (result.command === "ECO") {
      scrollToPanel(calendarPanelRef);
      setCommandNotice("ECO ROUTED: FRED ECONOMIC CALENDAR");
      return;
    }

    if (result.command === "EDGAR") {
      setEdgarTicker(result.ticker);
      if (result.form) setEdgarForm(result.form);
      scrollToPanel(edgarPanelRef);
      setCommandNotice(`EDGAR ROUTED: ${result.ticker} (${result.form || "ALL"})`);
      return;
    }

    if (result.command === "STOCK" || result.command === "BOOK") {
      addSymbol(result.symbol);
      return;
    }

    if (result.command === "NEWS") {
      setNewsQuery(result.query);
      setNewsCategory("ALL");
      scrollToPanel(newsPanelRef);
      setCommandNotice(`NEWS FILTERED: "${result.query}"`);
      return;
    }

    if (result.command === "TOP") {
      const channel = result.channel?.toUpperCase() || "ALL";
      setNewsCategory(channel);
      setNewsQuery("");
      scrollToPanel(newsPanelRef);
      setCommandNotice(`TOP NEWS CHANNEL ROUTED: ${channel}`);
      return;
    }

    if (result.command === "ECON") {
      setMacroQuery(result.query);
      scrollToPanel(macroPanelRef);
      setCommandNotice(`FRED MACRO SEARCH: "${result.query}"`);
      return;
    }

    if (result.command === "WEI") {
      if (result.from && result.to) {
        setFxPair({ from: result.from, to: result.to });
        setCommandNotice(`FX CROSS: ${result.from} / ${result.to}`);
      } else {
        setCommandNotice("WEI // WORLD INDICES ROUTED");
      }
      scrollToPanel(indicesPanelRef);
      return;
    }

    if (result.command === "FX") {
      setFxPair({ from: result.from, to: result.to });
      scrollToPanel(indicesPanelRef);
      setCommandNotice(`FX CONVERTER: ${result.from} -> ${result.to}`);
      return;
    }

    if (result.command === "YIELD") {
      scrollToPanel(yieldPanelRef);
      setCommandNotice("US TREASURY YIELD CURVE ROUTED");
      return;
    }

    if (result.command === "FNG") {
      scrollToPanel(sentimentPanelRef);
      setCommandNotice("CRYPTO FEAR & GREED INDEX ROUTED");
      return;
    }
  }

  function togglePanel(panelId: string) {
    setHiddenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(panelId)) next.delete(panelId);
      else next.add(panelId);
      return next;
    });
  }

  function isPanelVisible(panelId: string): boolean {
    if (hiddenPanels.has(panelId)) return false;
    if (mobileTab === "all") return true;
    const meta = PANEL_MAP[panelId];
    if (!meta) return true;
    return meta.category === mobileTab;
  }

  function changeLayout(cols: 1 | 2 | 3) {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("terminal_grid_cols", String(cols));
      } catch {}
    }
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as any).startViewTransition(() => {
        flushSync(() => {
          setGridCols(cols);
        });
      });
    } else {
      setGridCols(cols);
    }
  }

  const middlePanels = useMemo(
    () => [
      {
        id: "dossier",
        index: 2,
        tier: "secondary",
        render: () => (
          <CompanyDossierPanel initialTicker={dossierTicker} panelRef={dossierPanelRef} />
        ),
      },
      {
        id: "analyst",
        index: 3,
        tier: "secondary",
        render: () => (
          <AnalystRecommendationsPanel initialTicker={analystTicker} panelRef={analystPanelRef} />
        ),
      },
      {
        id: "earnings",
        index: 4,
        tier: "secondary",
        render: () => (
          <EarningsPanel initialTicker={earningsTicker} panelRef={earningsPanelRef} />
        ),
      },
      {
        id: "movers",
        index: 5,
        tier: "primary",
        render: () => (
          <MarketMoversPanel
            panelRef={moversPanelRef}
            onSelectSymbol={(sym, cat) => {
              if (cat === "CRYPTO") {
                handleCommand({ command: "CHART", symbol: sym });
              } else {
                handleCommand({ command: "DES", ticker: sym });
              }
            }}
          />
        ),
      },
      {
        id: "fxMatrix",
        index: 6,
        tier: "tertiary",
        render: () => (
          <FxCrossMatrixPanel
            panelRef={fxMatrixPanelRef}
            onSelectPair={(from, to) => {
              handleCommand({ command: "FX", from, to });
            }}
          />
        ),
      },
      {
        id: "commodities",
        index: 7,
        tier: "tertiary",
        render: () => (
          <CommoditiesPanel initialQuery={commoditiesQuery} panelRef={commoditiesPanelRef} />
        ),
      },
      {
        id: "dividend",
        index: 8,
        tier: "tertiary",
        render: () => (
          <DividendPanel initialTicker={dividendTicker} panelRef={dividendPanelRef} />
        ),
      },
      {
        id: "valuation",
        index: 9,
        tier: "tertiary",
        render: () => (
          <RelativeValuationPanel
            initialTicker={valuationTicker}
            panelRef={valuationPanelRef}
            onSelectPeer={(p) => handleCommand({ command: "DES", ticker: p })}
          />
        ),
      },
      {
        id: "holders",
        index: 10,
        tier: "tertiary",
        render: () => (
          <InstitutionalHoldingsPanel initialTicker={holdersTicker} panelRef={holdersPanelRef} />
        ),
      },
      {
        id: "fundamentals",
        index: 11,
        tier: "secondary",
        render: () => (
          <FundamentalsPanel initialTicker={fundamentalsTicker} panelRef={fundamentalsPanelRef} />
        ),
      },
      {
        id: "options",
        index: 12,
        tier: "secondary",
        render: () => (
          <OptionsPanel initialSymbol={optionsSymbol} panelRef={optionsPanelRef} />
        ),
      },
      {
        id: "calendar",
        index: 13,
        tier: "tertiary",
        render: () => (
          <EconomicCalendarPanel panelRef={calendarPanelRef} />
        ),
      },
      {
        id: "edgar",
        index: 14,
        tier: "tertiary",
        render: () => (
          <EdgarPanel
            initialTicker={edgarTicker}
            initialForm={edgarForm}
            panelRef={edgarPanelRef}
          />
        ),
      },
      {
        id: "indices",
        index: 15,
        tier: "secondary",
        render: () => (
          <IndicesPanel panelRef={indicesPanelRef} fxPair={fxPair} />
        ),
      },
      {
        id: "yield",
        index: 16,
        tier: "secondary",
        render: () => (
          <YieldCurvePanel panelRef={yieldPanelRef} />
        ),
      },
      {
        id: "wirp",
        index: 17,
        tier: "tertiary",
        render: () => (
          <FedRateProbabilitiesPanel panelRef={wirpPanelRef} />
        ),
      },
      {
        id: "wbon",
        index: 18,
        tier: "tertiary",
        render: () => (
          <WorldBondsPanel panelRef={wbonPanelRef} />
        ),
      },
      {
        id: "corr",
        index: 19,
        tier: "tertiary",
        render: () => (
          <CorrelationMatrixPanel panelRef={corrPanelRef} />
        ),
      },
      {
        id: "vol",
        index: 20,
        tier: "tertiary",
        render: () => (
          <VolatilityPanel panelRef={volPanelRef} />
        ),
      },
      {
        id: "qr",
        index: 21,
        tier: "tertiary",
        render: () => (
          <TimeAndSalesPanel initialSymbol={qrSymbol} panelRef={qrPanelRef} />
        ),
      },
      {
        id: "sentiment",
        index: 22,
        tier: "tertiary",
        render: () => (
          <SentimentPanel panelRef={sentimentPanelRef} />
        ),
      },
    ],
    [
      dossierTicker,
      analystTicker,
      earningsTicker,
      commoditiesQuery,
      dividendTicker,
      valuationTicker,
      holdersTicker,
      fundamentalsTicker,
      optionsSymbol,
      edgarTicker,
      edgarForm,
      fxPair,
      qrSymbol,
    ]
  );

  const visibleMiddlePanels = useMemo(
    () => middlePanels.filter((p) => isPanelVisible(p.id)),
    [middlePanels, hiddenPanels, mobileTab]
  );

  const columns = useMemo(() => {
    const cols = Array.from({ length: gridCols }, () => ({
      panels: [] as typeof visibleMiddlePanels,
      totalHeight: 0,
    }));

    visibleMiddlePanels.forEach((panel) => {
      let minCol = cols[0];
      for (let i = 1; i < cols.length; i++) {
        if (cols[i].totalHeight < minCol.totalHeight) {
          minCol = cols[i];
        }
      }
      minCol.panels.push(panel);
      minCol.totalHeight += ESTIMATED_HEIGHTS[panel.id] || 350;
    });

    return cols.map((c) => c.panels);
  }, [visibleMiddlePanels, gridCols]);

  const showWatchlist = isWatchlistVisible && (mobileTab === 'all' || mobileTab === 'market');

  return (
    <main style={{ padding: 24 }}>
      <TerminalHeader />

      <CommandBar ref={commandBarRef} onCommand={handleCommand} />
      <p className="command-notice" role="status">
        {commandNotice}
      </p>

      <LayoutToolbar
        gridCols={gridCols}
        onChangeLayout={changeLayout}
        showPanelManager={showPanelManager}
        onTogglePanelManager={() => setShowPanelManager(!showPanelManager)}
        isWatchlistVisible={isWatchlistVisible}
        onToggleWatchlist={() => setIsWatchlistVisible(!isWatchlistVisible)}
      />

      {showPanelManager && (
        <PanelManagerDrawer
          hiddenPanels={hiddenPanels}
          onTogglePanel={togglePanel}
          onShowAll={() => setHiddenPanels(new Set())}
          onHideAll={() => setHiddenPanels(new Set(ALL_PANEL_IDS))}
        />
      )}

      <MobileCategoryBar mobileTab={mobileTab} onSelectTab={setMobileTab} />

      <div className="dashboard-grid" style={!showWatchlist ? { gridTemplateColumns: '1fr' } : undefined}>
        {/* Market Data & Analytics Column */}
        <div
          className={`data-panels data-panels-${gridCols}col`}
          data-layout={`${gridCols}col`}
        >
          {/* SECF Universal Security & Series Finder Panel */}
          {isPanelVisible('secf') && (
            <div className={`terminal-window panel-span-full panel-tier-primary${focusedPanelIndex === 0 ? " panel-focused" : ""}`}>
              <SecurityFinderPanel
                initialQuery={secfQuery}
                panelRef={secfPanelRef}
                onSelectCommand={(cmd) => {
                  handleCommand(parseCommand(cmd));
                }}
              />
            </div>
          )}

          {isPanelVisible('chart') && (
            <div className={`terminal-window panel-span-full panel-tier-primary${focusedPanelIndex === 1 ? " panel-focused" : ""}`}>
              <ChartPanel initialSymbol={chartSymbol} panelRef={chartPanelRef} />
            </div>
          )}

          {/* Pinterest / Masonry Multi-Column Flow Container */}
          <div className={`data-panels-flow data-panels-flow-${gridCols}col`}>
            {columns.map((colPanels, colIdx) => (
              <div key={colIdx} className="data-panels-col">
                {colPanels.map((panel) => (
                  <div
                    key={panel.id}
                    className={`terminal-window panel-tier-${panel.tier}${focusedPanelIndex === panel.index ? " panel-focused" : ""}`}
                  >
                    {panel.render()}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* FRED Macro Surveillance Panel */}
          {isPanelVisible('macro') && (
            <div className={`terminal-window panel-span-full panel-tier-primary${focusedPanelIndex === 23 ? " panel-focused" : ""}`}>
              <MacroPanel query={macroQuery} panelRef={macroPanelRef} />
            </div>
          )}

          {/* Bottom Full-Width Panel */}
          {isPanelVisible('news') && (
            <div className={`terminal-window panel-span-full panel-tier-primary${focusedPanelIndex === 24 ? " panel-focused" : ""}`}>
              <NewsPanel query={newsQuery} initialCategory={newsCategory} panelRef={newsPanelRef} />
            </div>
          )}
        </div>

        {/* Order Book Watchlist Column */}
        {showWatchlist && (
          <WatchlistColumn
            symbols={symbols}
            symbolInput={symbolInput}
            onSymbolInputChange={setSymbolInput}
            onAddSymbol={addSymbol}
            onRemoveSymbol={removeSymbol}
            tradableSymbols={tradableSymbols}
          />
        )}
      </div>
    </main>
  );
}
