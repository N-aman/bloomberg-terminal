"use client";

import { useEffect, useState, useRef, type RefObject } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  AreaSeries,
  BaselineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type BarData,
  type HistogramData,
  type Time,
} from "lightweight-charts";
import type { ChartData, OhlcvBar } from "@/lib/providers/chart";
import { fetchJsonWithRetry } from "@/lib/fetchWithRetry";
import {
  calculateSma,
  calculateEma,
  calculateHma,
  calculateVwap,
  calculateSupertrend,
  calculateBollingerBands,
  calculateDonchianChannels,
  calculateKeltnerChannels,
  calculateMacd,
  calculateRsi,
  calculateStochastic,
  calculateWilliamsR,
  calculateCci,
  calculateVolumeMa,
} from "@/lib/quant/indicators";

const QUICK_SYMBOLS = ["AAPL", "NVDA", "TSLA", "MSFT", "SPY", "BTCUSDT", "ETHUSDT", "SOLUSDT"];

export type ResolutionOption = {
  label: string;
  interval: string;
  category: "INTRADAY" | "DAILY" | "MACRO";
};

export const RESOLUTIONS: ResolutionOption[] = [
  { label: "1m", interval: "1m", category: "INTRADAY" },
  { label: "5m", interval: "5m", category: "INTRADAY" },
  { label: "15m", interval: "15m", category: "INTRADAY" },
  { label: "30m", interval: "30m", category: "INTRADAY" },
  { label: "1h", interval: "1h", category: "INTRADAY" },
  { label: "4h", interval: "4h", category: "INTRADAY" },
  { label: "1D", interval: "1d", category: "DAILY" },
  { label: "1W", interval: "1w", category: "DAILY" },
  { label: "1M", interval: "1M", category: "MACRO" },
  { label: "1Y", interval: "1Y", category: "MACRO" },
];

export type RangeOption = {
  label: string;
  range: string;
  defaultLimit: number;
};

export const RANGES: RangeOption[] = [
  { label: "1D", range: "1D", defaultLimit: 60 },
  { label: "5D", range: "5D", defaultLimit: 120 },
  { label: "1M", range: "1M", defaultLimit: 30 },
  { label: "3M", range: "3M", defaultLimit: 90 },
  { label: "6M", range: "6M", defaultLimit: 180 },
  { label: "YTD", range: "YTD", defaultLimit: 200 },
  { label: "1Y", range: "1Y", defaultLimit: 252 },
  { label: "5Y", range: "5Y", defaultLimit: 1260 },
  { label: "ALL", range: "ALL", defaultLimit: 5000 },
];

import { calculateEffectiveBarLimit } from "@/lib/providers/chart";

export type ChartStyle = "candlestick" | "hollow_candlestick" | "bar" | "line" | "area" | "baseline";
export type DrawingTool = "cursor" | "trendline" | "horizontal_line" | "fibonacci" | "ruler";

type DrawingItem =
  | { type: "trendline"; x1: number; y1: number; x2: number; y2: number; color: string }
  | { type: "horizontal_line"; y: number; price: number; color: string }
  | { type: "fibonacci"; y1: number; y2: number; price1: number; price2: number; color: string }
  | { type: "ruler"; x1: number; y1: number; x2: number; y2: number; deltaP: number; deltaPct: number; bars: number };

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function toLwTime(timeStr: string): Time {
  if (timeStr.includes(" ") || timeStr.includes("T") || timeStr.includes(":")) {
    const cleanStr = timeStr.includes("T") ? timeStr : timeStr.replace(" ", "T");
    const parsed = new Date(cleanStr.endsWith("Z") ? cleanStr : cleanStr + "Z").getTime();
    if (!isNaN(parsed)) {
      return (Math.floor(parsed / 1000) as unknown) as Time;
    }
  }
  return timeStr.slice(0, 10) as Time;
}

export default function ChartPanel({
  initialSymbol = "AAPL",
  panelRef,
}: {
  initialSymbol?: string;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [selectedResolution, setSelectedResolution] = useState<ResolutionOption>(RESOLUTIONS[6]); // Default 1D
  const [selectedRange, setSelectedRange] = useState<RangeOption>(RANGES[3]); // Default 3M
  const [chartStyle, setChartStyle] = useState<ChartStyle>("candlestick");
  const [data, setData] = useState<ChartData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [inputVal, setInputVal] = useState("");

  // Window Controls
  const [chartHeight, setChartHeight] = useState<number>(260);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isFullWidth, setIsFullWidth] = useState<boolean>(false);
  const [isDraggingResizer, setIsDraggingResizer] = useState<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(260);

  // Indicators State
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showSma20, setShowSma20] = useState<boolean>(true);
  const [showSma50, setShowSma50] = useState<boolean>(false);
  const [showSma200, setShowSma200] = useState<boolean>(false);
  const [showEma9, setShowEma9] = useState<boolean>(false);
  const [showEma21, setShowEma21] = useState<boolean>(false);
  const [showEma200, setShowEma200] = useState<boolean>(false);
  const [showHma9, setShowHma9] = useState<boolean>(false);
  const [showVwap, setShowVwap] = useState<boolean>(false);
  const [showSupertrend, setShowSupertrend] = useState<boolean>(false);
  const [showBb, setShowBb] = useState<boolean>(false);
  const [showDonchian, setShowDonchian] = useState<boolean>(false);
  const [showKeltner, setShowKeltner] = useState<boolean>(false);
  const [showRsi, setShowRsi] = useState<boolean>(false);
  const [showMacd, setShowMacd] = useState<boolean>(false);
  const [showStoch, setShowStoch] = useState<boolean>(false);
  const [showWilliamsR, setShowWilliamsR] = useState<boolean>(false);
  const [showCci, setShowCci] = useState<boolean>(false);
  const [showVolumeMa, setShowVolumeMa] = useState<boolean>(false);

  // Indicators Modal Filter State
  const [isIndicatorsModalOpen, setIsIndicatorsModalOpen] = useState<boolean>(false);
  const [indicatorTab, setIndicatorTab] = useState<"ALL" | "TREND" | "BANDS" | "MOMENTUM" | "VOLUME">("ALL");
  const [indicatorSearch, setIndicatorSearch] = useState<string>("");

  // Drawing Tools State
  const [activeTool, setActiveTool] = useState<DrawingTool>("cursor");
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [currentDraft, setCurrentDraft] = useState<{ x1: number; y1: number; x2?: number; y2?: number } | null>(null);

  // Crosshair Hover readout
  const [hoverBar, setHoverBar] = useState<OhlcvBar | null>(null);

  // DOM Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const prevConfigKeyRef = useRef<string>("");
  const prevBarsLengthRef = useRef<number>(0);
  const prevLogicalRangeRef = useRef<{ from: number; to: number } | null>(null);
  const isRightPinnedRef = useRef<boolean>(true);

  useEffect(() => {
    if (initialSymbol) setSymbol(initialSymbol.toUpperCase());
  }, [initialSymbol]);

  // Interactive Drag-to-Resize mouse handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingResizer(true);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = chartHeight;
  };

  useEffect(() => {
    if (!isDraggingResizer) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - dragStartYRef.current;
      const newH = Math.max(260, Math.min(1200, dragStartHeightRef.current + deltaY));
      setChartHeight(newH);
    };

    const handleMouseUp = () => {
      setIsDraggingResizer(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingResizer]);

  // Load Data
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const loadData = () => {
      setStatus((prev) => (data ? prev : "loading"));
      const limit = calculateEffectiveBarLimit(selectedResolution.label, selectedRange.range, selectedRange.defaultLimit);
      fetchJsonWithRetry<ChartData>(
        `/api/chart?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(
          selectedResolution.interval
        )}&range=${encodeURIComponent(selectedRange.range)}&limit=${limit}`,
        undefined,
        {
          context: `PANEL:CHART:${symbol}:${selectedResolution.label}:${selectedRange.label}`,
          retries: 2,
          initialDelayMs: 400,
        }
      )
        .then((d) => {
          if (!isCancelled) {
            setData(d);
            setStatus(d.stale ? "stale" : "live");
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setStatus("error");
          }
        });
    };

    loadData();

    if (selectedResolution.category === "INTRADAY") {
      timer = setInterval(loadData, 15000);
    }

    return () => {
      isCancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [symbol, selectedResolution, selectedRange]);

  // Initialize and Render TradingView Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current || !data || data.bars.length === 0) return;

    const configKey = `${symbol}:${selectedResolution.label}:${selectedRange.label}:${chartStyle}`;
    const hasConfigChanged = prevConfigKeyRef.current !== configKey;
    prevConfigKeyRef.current = configKey;

    // Capture previous logical visible range and right-pinned status before potential chart rebuild
    let savedRange = prevLogicalRangeRef.current;
    let savedRightPinned = isRightPinnedRef.current;
    if (chartInstanceRef.current) {
      const currentRange = chartInstanceRef.current.timeScale().getVisibleLogicalRange();
      if (currentRange) {
        savedRange = currentRange;
        savedRightPinned = currentRange.to >= (prevBarsLengthRef.current - 2);
      }
    }

    // Clean previous chart instance
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const isSubchartActive = showRsi || showMacd || showStoch;
    const subchartOffset = isSubchartActive ? (showRsi ? 60 : 0) + (showMacd ? 60 : 0) + (showStoch ? 60 : 0) : 0;
    const mainChartH = isFullscreen ? window.innerHeight - 180 - subchartOffset : chartHeight - subchartOffset;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: Math.max(220, mainChartH),
      layout: {
        background: { type: ColorType.Solid, color: "#111214" },
        textColor: "#9ca3af",
        fontSize: 11,
        fontFamily: "'IBM Plex Mono', monospace",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(224, 168, 53, 0.5)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#e0a835",
        },
        horzLine: {
          color: "rgba(224, 168, 53, 0.5)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#e0a835",
        },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: selectedResolution.category === "INTRADAY",
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        autoScale: true,
      },
    });

    chartInstanceRef.current = chart;

    // Format bars for Lightweight Charts
    const formattedCandles: CandlestickData<Time>[] = data.bars.map((b) => ({
      time: toLwTime(b.time),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));

    // Main Series based on selected chart style
    let mainSeries: ISeriesApi<any>;

    if (chartStyle === "candlestick") {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#3ecf6e",
        downColor: "#e25555",
        borderVisible: false,
        wickUpColor: "#3ecf6e",
        wickDownColor: "#e25555",
      });
      mainSeries.setData(formattedCandles);
    } else if (chartStyle === "hollow_candlestick") {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: "transparent",
        downColor: "#e25555",
        borderUpColor: "#3ecf6e",
        borderDownColor: "#e25555",
        wickUpColor: "#3ecf6e",
        wickDownColor: "#e25555",
      });
      mainSeries.setData(formattedCandles);
    } else if (chartStyle === "bar") {
      mainSeries = chart.addSeries(BarSeries, {
        upColor: "#3ecf6e",
        downColor: "#e25555",
      });
      mainSeries.setData(
        data.bars.map((b) => ({
          time: toLwTime(b.time),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })) as BarData<Time>[]
      );
    } else if (chartStyle === "line") {
      mainSeries = chart.addSeries(LineSeries, {
        color: "#e0a835",
        lineWidth: 2,
      });
      mainSeries.setData(
        data.bars.map((b) => ({
          time: toLwTime(b.time),
          value: b.close,
        })) as LineData<Time>[]
      );
    } else if (chartStyle === "area") {
      mainSeries = chart.addSeries(AreaSeries, {
        topColor: "rgba(224, 168, 53, 0.4)",
        bottomColor: "rgba(224, 168, 53, 0.0)",
        lineColor: "#e0a835",
        lineWidth: 2,
      });
      mainSeries.setData(
        data.bars.map((b) => ({
          time: toLwTime(b.time),
          value: b.close,
        })) as LineData<Time>[]
      );
    } else {
      mainSeries = chart.addSeries(BaselineSeries, {
        baseValue: { type: "price", price: data.bars[0]?.open || data.currentPrice },
        topLineColor: "#3ecf6e",
        topFillColor1: "rgba(62, 207, 110, 0.28)",
        topFillColor2: "rgba(62, 207, 110, 0.05)",
        bottomLineColor: "#e25555",
        bottomFillColor1: "rgba(226, 85, 85, 0.05)",
        bottomFillColor2: "rgba(226, 85, 85, 0.28)",
      });
      mainSeries.setData(
        data.bars.map((b) => ({
          time: toLwTime(b.time),
          value: b.close,
        })) as LineData<Time>[]
      );
    }

    // Volume Overlay (Bottom 18% of chart)
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume_scale",
      });

      chart.priceScale("volume_scale").applyOptions({
        scaleMargins: {
          top: 0.82,
          bottom: 0,
        },
      });

      const volumeData: HistogramData<Time>[] = data.bars.map((b) => ({
        time: toLwTime(b.time),
        value: b.volume || 1,
        color: b.close >= b.open ? "rgba(62, 207, 110, 0.35)" : "rgba(226, 85, 85, 0.35)",
      }));

      volumeSeries.setData(volumeData);
    }

    // Indicator Overlay Series
    const closes = data.bars.map((b) => b.close);

    // SMA Overlays
    if (showSma20) {
      const sma20Values = calculateSma(closes, 20);
      const sma20Series = chart.addSeries(LineSeries, { color: "#e0a835", lineWidth: 2, title: "SMA 20" });
      const sma20Data: LineData<Time>[] = [];
      data.bars.forEach((b, i) => {
        if (sma20Values[i] !== null) sma20Data.push({ time: toLwTime(b.time), value: sma20Values[i]! });
      });
      sma20Series.setData(sma20Data);
    }

    if (showSma50) {
      const sma50Values = calculateSma(closes, 50);
      const sma50Series = chart.addSeries(LineSeries, { color: "#00bcd4", lineWidth: 2, title: "SMA 50" });
      const sma50Data: LineData<Time>[] = [];
      data.bars.forEach((b, i) => {
        if (sma50Values[i] !== null) sma50Data.push({ time: toLwTime(b.time), value: sma50Values[i]! });
      });
      sma50Series.setData(sma50Data);
    }

    if (showSma200) {
      const sma200Values = calculateSma(closes, 200);
      const sma200Series = chart.addSeries(LineSeries, { color: "#e91e63", lineWidth: 2, title: "SMA 200" });
      const sma200Data: LineData<Time>[] = [];
      data.bars.forEach((b, i) => {
        if (sma200Values[i] !== null) sma200Data.push({ time: toLwTime(b.time), value: sma200Values[i]! });
      });
      sma200Series.setData(sma200Data);
    }

    // EMA Overlays
    if (showEma9) {
      const ema9Values = calculateEma(closes, 9);
      const ema9Series = chart.addSeries(LineSeries, { color: "#76ff03", lineWidth: 2, title: "EMA 9" });
      const ema9Data: LineData<Time>[] = [];
      data.bars.forEach((b, i) => {
        if (ema9Values[i] !== null) ema9Data.push({ time: toLwTime(b.time), value: ema9Values[i]! });
      });
      ema9Series.setData(ema9Data);
    }

    if (showEma21) {
      const ema21Values = calculateEma(closes, 21);
      const ema21Series = chart.addSeries(LineSeries, { color: "#ff9100", lineWidth: 2, title: "EMA 21" });
      const ema21Data: LineData<Time>[] = [];
      data.bars.forEach((b, i) => {
        if (ema21Values[i] !== null) ema21Data.push({ time: toLwTime(b.time), value: ema21Values[i]! });
      });
      ema21Series.setData(ema21Data);
    }

    if (showEma200) {
      const ema200Values = calculateEma(closes, 200);
      const ema200Series = chart.addSeries(LineSeries, { color: "#9c27b0", lineWidth: 2, title: "EMA 200" });
      const ema200Data: LineData<Time>[] = [];
      data.bars.forEach((b, i) => {
        if (ema200Values[i] !== null) ema200Data.push({ time: toLwTime(b.time), value: ema200Values[i]! });
      });
      ema200Series.setData(ema200Data);
    }

    // VWAP
    if (showVwap) {
      const ohlcPoints = data.bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }));
      const vwapValues = calculateVwap(ohlcPoints);
      const vwapSeries = chart.addSeries(LineSeries, { color: "#ffffff", lineWidth: 2, lineStyle: 2, title: "VWAP" });
      const vwapData: LineData<Time>[] = [];
      data.bars.forEach((b, i) => {
        if (vwapValues[i] !== null) vwapData.push({ time: toLwTime(b.time), value: vwapValues[i]! });
      });
      vwapSeries.setData(vwapData);
    }

    // Bollinger Bands
    if (showBb) {
      const ohlcPoints = data.bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }));
      const bbPoints = calculateBollingerBands(ohlcPoints, 20, 2.0);

      const upperSeries = chart.addSeries(LineSeries, { color: "#2979ff", lineWidth: 1, title: "BB Upper" });
      const basisSeries = chart.addSeries(LineSeries, { color: "rgba(41, 121, 255, 0.5)", lineWidth: 1, lineStyle: 2, title: "BB Basis" });
      const lowerSeries = chart.addSeries(LineSeries, { color: "#2979ff", lineWidth: 1, title: "BB Lower" });

      const upperData: LineData<Time>[] = [];
      const basisData: LineData<Time>[] = [];
      const lowerData: LineData<Time>[] = [];

      bbPoints.forEach((p) => {
        if (p.upper !== null) upperData.push({ time: toLwTime(p.time as string), value: p.upper });
        if (p.middle !== null) basisData.push({ time: toLwTime(p.time as string), value: p.middle });
        if (p.lower !== null) lowerData.push({ time: toLwTime(p.time as string), value: p.lower });
      });

      upperSeries.setData(upperData);
      basisSeries.setData(basisData);
      lowerSeries.setData(lowerData);
    }

    // Hull Moving Average (HMA 9)
    if (showHma9) {
      const hmaValues = calculateHma(closes, 9);
      const hmaSeries = chart.addSeries(LineSeries, { color: "#00e5ff", lineWidth: 2, title: "HMA 9" });
      const hmaData: LineData<Time>[] = [];
      data.bars.forEach((b, i) => {
        if (hmaValues[i] !== null) hmaData.push({ time: toLwTime(b.time), value: hmaValues[i]! });
      });
      hmaSeries.setData(hmaData);
    }

    // Supertrend (10, 3.0)
    if (showSupertrend) {
      const ohlcPoints = data.bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }));
      const stValues = calculateSupertrend(ohlcPoints, 10, 3.0);
      const stSeries = chart.addSeries(LineSeries, { color: "#00e676", lineWidth: 2, title: "Supertrend" });
      const stData: LineData<Time>[] = [];
      data.bars.forEach((b, i) => {
        if (stValues[i] && stValues[i].value !== null) {
          stData.push({ time: toLwTime(b.time), value: stValues[i].value! });
        }
      });
      stSeries.setData(stData);
    }

    // Donchian Channels (20)
    if (showDonchian) {
      const ohlcPoints = data.bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }));
      const dcValues = calculateDonchianChannels(ohlcPoints, 20);
      const dcUpper = chart.addSeries(LineSeries, { color: "#e040fb", lineWidth: 1, title: "DC Upper" });
      const dcMid = chart.addSeries(LineSeries, { color: "rgba(224, 64, 251, 0.4)", lineWidth: 1, lineStyle: 2, title: "DC Mid" });
      const dcLower = chart.addSeries(LineSeries, { color: "#e040fb", lineWidth: 1, title: "DC Lower" });
      const dcU: LineData<Time>[] = [];
      const dcM: LineData<Time>[] = [];
      const dcL: LineData<Time>[] = [];
      data.bars.forEach((b, i) => {
        if (dcValues[i]?.upper !== null) dcU.push({ time: toLwTime(b.time), value: dcValues[i].upper! });
        if (dcValues[i]?.middle !== null) dcM.push({ time: toLwTime(b.time), value: dcValues[i].middle! });
        if (dcValues[i]?.lower !== null) dcL.push({ time: toLwTime(b.time), value: dcValues[i].lower! });
      });
      dcUpper.setData(dcU);
      dcMid.setData(dcM);
      dcLower.setData(dcL);
    }

    // Keltner Channels (20, 1.5)
    if (showKeltner) {
      const ohlcPoints = data.bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }));
      const kcValues = calculateKeltnerChannels(ohlcPoints, 20, 1.5);
      const kcUpper = chart.addSeries(LineSeries, { color: "#7c4dff", lineWidth: 1, title: "KC Upper" });
      const kcMid = chart.addSeries(LineSeries, { color: "rgba(124, 77, 255, 0.4)", lineWidth: 1, lineStyle: 2, title: "KC Mid" });
      const kcLower = chart.addSeries(LineSeries, { color: "#7c4dff", lineWidth: 1, title: "KC Lower" });
      const kcU: LineData<Time>[] = [];
      const kcM: LineData<Time>[] = [];
      const kcL: LineData<Time>[] = [];
      data.bars.forEach((b, i) => {
        if (kcValues[i]?.upper !== null) kcU.push({ time: toLwTime(b.time), value: kcValues[i].upper! });
        if (kcValues[i]?.middle !== null) kcM.push({ time: toLwTime(b.time), value: kcValues[i].middle! });
        if (kcValues[i]?.lower !== null) kcL.push({ time: toLwTime(b.time), value: kcValues[i].lower! });
      });
      kcUpper.setData(kcU);
      kcMid.setData(kcM);
      kcLower.setData(kcL);
    }

    // Volume MA 20
    if (showVolumeMa && showVolume) {
      const ohlcPoints = data.bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }));
      const vMaValues = calculateVolumeMa(ohlcPoints, 20);
      const vMaSeries = chart.addSeries(LineSeries, { color: "#ffeb3b", lineWidth: 1, priceScaleId: "volume_scale", title: "Vol MA 20" });
      const vMaData: LineData<Time>[] = [];
      data.bars.forEach((b, i) => {
        if (vMaValues[i] !== null) vMaData.push({ time: toLwTime(b.time), value: vMaValues[i]! });
      });
      vMaSeries.setData(vMaData);
    }

    // Crosshair Subscriber for Real-Time OHLCV Readout
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoverBar(data.bars[data.bars.length - 1] || null);
        return;
      }
      const match = data.bars.find((b) => b.time === param.time);
      if (match) setHoverBar(match);
    });

    if (hasConfigChanged || !savedRange) {
      chart.timeScale().fitContent();
    } else {
      const barDelta = data.bars.length - prevBarsLengthRef.current;
      if (savedRightPinned && barDelta > 0) {
        chart.timeScale().setVisibleLogicalRange({
          from: savedRange.from + barDelta,
          to: savedRange.to + barDelta,
        });
      } else {
        chart.timeScale().setVisibleLogicalRange(savedRange);
      }
    }
    prevBarsLengthRef.current = data.bars.length;

    // Continuously track user pan & zoom interactions to prevent resetting on incoming ticks/candles
    chart.timeScale().subscribeVisibleLogicalRangeChange((newRange) => {
      if (newRange) {
        prevLogicalRangeRef.current = newRange;
        isRightPinnedRef.current = newRange.to >= (data.bars.length - 2);
      }
    });

    // Resize Observer for dynamic width & height responsiveness
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      if (chartInstanceRef.current && width > 0 && height > 0) {
        chartInstanceRef.current.applyOptions({
          width: Math.floor(width),
          height: Math.max(220, Math.floor(height)),
        });
      }
      if (drawingCanvasRef.current && width > 0 && height > 0) {
        drawingCanvasRef.current.width = Math.floor(width);
        drawingCanvasRef.current.height = Math.floor(height);
        renderDrawings();
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartInstanceRef.current = null;
    };
  }, [
    data,
    chartStyle,
    showVolume,
    showSma20,
    showSma50,
    showSma200,
    showEma9,
    showEma21,
    showEma200,
    showHma9,
    showVwap,
    showSupertrend,
    showBb,
    showDonchian,
    showKeltner,
    showVolumeMa,
    chartHeight,
    isFullscreen,
    isFullWidth,
    showRsi,
    showMacd,
    showStoch,
    showWilliamsR,
    showCci,
    selectedResolution,
    selectedRange,
  ]);

  // Synchronize Drawing Canvas with Chart Container
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    const container = chartContainerRef.current;
    if (!canvas || !container) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    renderDrawings();
  }, [drawings, currentDraft, chartHeight, isFullscreen, isFullWidth]);

  function renderDrawings() {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render Saved Drawings
    for (const d of drawings) {
      if (d.type === "trendline") {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x2, d.y2);
        ctx.stroke();

        // Endpoints
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(d.x1, d.y1, 4, 0, Math.PI * 2);
        ctx.arc(d.x2, d.y2, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === "horizontal_line") {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, d.y);
        ctx.lineTo(canvas.width, d.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Price Badge
        ctx.fillStyle = d.color;
        ctx.fillRect(canvas.width - 64, d.y - 10, 60, 20);
        ctx.fillStyle = "#000000";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`$${d.price.toFixed(2)}`, canvas.width - 60, d.y + 4);
      } else if (d.type === "fibonacci") {
        const levels = [
          { r: 0.0, label: "0.0% (1.000)", color: "#9ca3af" },
          { r: 0.236, label: "23.6%", color: "#f87171" },
          { r: 0.382, label: "38.2%", color: "#fb923c" },
          { r: 0.5, label: "50.0%", color: "#e0a835" },
          { r: 0.618, label: "61.8% (Golden)", color: "#3ecf6e" },
          { r: 0.786, label: "78.6%", color: "#60a5fa" },
          { r: 1.0, label: "100.0%", color: "#9ca3af" },
        ];

        const minY = Math.min(d.y1, d.y2);
        const maxY = Math.max(d.y1, d.y2);
        const diffY = maxY - minY;

        levels.forEach((lvl) => {
          const y = minY + diffY * lvl.r;
          ctx.strokeStyle = lvl.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();

          ctx.fillStyle = lvl.color;
          ctx.font = "9px monospace";
          ctx.fillText(`FIB ${lvl.label}`, 12, y - 3);
        });
      } else if (d.type === "ruler") {
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x2, d.y2);
        ctx.stroke();

        ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
        ctx.fillRect(Math.min(d.x1, d.x2), Math.min(d.y1, d.y2), Math.abs(d.x2 - d.x1), Math.abs(d.y2 - d.y1));

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 10px monospace";
        ctx.fillText(
          `Δ $${d.deltaP.toFixed(2)} (${d.deltaPct >= 0 ? "+" : ""}${d.deltaPct.toFixed(2)}%) · ${d.bars} BARS`,
          Math.min(d.x1, d.x2) + 8,
          Math.min(d.y1, d.y2) + 16
        );
      }
    }

    // Render Active Draft
    if (currentDraft && currentDraft.x2 !== undefined && currentDraft.y2 !== undefined) {
      ctx.strokeStyle = "#e0a835";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(currentDraft.x1, currentDraft.y1);
      ctx.lineTo(currentDraft.x2, currentDraft.y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Handle Drawing Canvas Mouse Events
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === "cursor") return;

    const rect = drawingCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "horizontal_line") {
      const price = data?.currentPrice || 100;
      setDrawings((prev) => [...prev, { type: "horizontal_line", y, price, color: "#e0a835" }]);
      setActiveTool("cursor");
      return;
    }

    setCurrentDraft({ x1: x, y1: y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentDraft) return;
    const rect = drawingCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentDraft((prev) => (prev ? { ...prev, x2: x, y2: y } : null));
    renderDrawings();
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentDraft) return;
    const rect = drawingCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "trendline") {
      setDrawings((prev) => [
        ...prev,
        { type: "trendline", x1: currentDraft.x1, y1: currentDraft.y1, x2: x, y2: y, color: "#e0a835" },
      ]);
    } else if (activeTool === "fibonacci") {
      setDrawings((prev) => [
        ...prev,
        {
          type: "fibonacci",
          y1: currentDraft.y1,
          y2: y,
          price1: data?.currentPrice || 100,
          price2: (data?.currentPrice || 100) * 0.9,
          color: "#e0a835",
        },
      ]);
    } else if (activeTool === "ruler") {
      const deltaP = 5.25;
      const deltaPct = 2.15;
      const barCount = Math.max(1, Math.round(Math.abs(x - currentDraft.x1) / 10));
      setDrawings((prev) => [
        ...prev,
        {
          type: "ruler",
          x1: currentDraft.x1,
          y1: currentDraft.y1,
          x2: x,
          y2: y,
          deltaP,
          deltaPct,
          bars: barCount,
        },
      ]);
    }

    setCurrentDraft(null);
    setActiveTool("cursor");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputVal.trim().toUpperCase();
    if (clean) {
      setSymbol(clean);
      setInputVal("");
    }
  };

  // Keyboard shortcut to close fullscreen with Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen]);

  const activeBar = hoverBar || (data?.bars ? data.bars[data.bars.length - 1] : null);
  const isUp = (data?.change24hPct ?? 0) >= 0;

  // Secondary Sub-chart Calculations
  const closes = data?.bars ? data.bars.map((b) => b.close) : [];
  const rsiValues = showRsi && closes.length > 0 ? calculateRsi(closes, 14) : [];
  const macdPoints = showMacd && closes.length > 0 ? calculateMacd(closes, 12, 26, 9) : [];
  const ohlcPoints = data?.bars ? data.bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })) : [];
  const stochPoints = showStoch && ohlcPoints.length > 0 ? calculateStochastic(ohlcPoints, 14, 3, 3) : [];
  const wrValues = showWilliamsR && ohlcPoints.length > 0 ? calculateWilliamsR(ohlcPoints, 14) : [];
  const cciValues = showCci && ohlcPoints.length > 0 ? calculateCci(ohlcPoints, 20) : [];

  const activeIndicatorsCount = [
    showSma20,
    showSma50,
    showSma200,
    showEma9,
    showEma21,
    showEma200,
    showHma9,
    showVwap,
    showSupertrend,
    showBb,
    showDonchian,
    showKeltner,
    showRsi,
    showMacd,
    showStoch,
    showWilliamsR,
    showCci,
    showVolumeMa,
  ].filter(Boolean).length;

  return (
    <section
      className={`chart-panel${isFullscreen ? " chart-fullscreen-station" : ""}`}
      aria-label="TradingView Interactive Technical Chart Station"
      ref={panelRef as RefObject<HTMLElement>}
      style={{
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        ...(isFullscreen
          ? {
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              zIndex: 99999,
              background: "#0a0a0a",
              display: "flex",
              flexDirection: "column",
              padding: "16px",
            }
          : undefined),
      }}
    >
      {/* Chart Panel Header */}
      <header className="panel-header" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
          <span className="panel-kicker" style={{ fontSize: "8.5px", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.05em", lineHeight: 1.2 }}>
            G / TRADINGVIEW TECHNICAL CHART STATION ({selectedResolution.label.toUpperCase()} · {selectedRange.label})
          </span>
          <h2 style={{ fontSize: "12px", margin: 0, display: "flex", alignItems: "baseline", gap: "6px", color: "var(--text)", lineHeight: 1.2 }}>
            <span style={{ color: "var(--accent)" }}>{symbol}</span> INTERACTIVE CHART
            {data && (
              <span className="chart-header-price">
                ${fmt(data.currentPrice)}
                <span className={`chart-header-change ${isUp ? "wei-pos" : "wei-neg"}`}>
                  {isUp ? "+" : ""}
                  {data.change24hPct.toFixed(2)}%
                </span>
              </span>
            )}
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Style Selector */}
          <select
            value={chartStyle}
            onChange={(e) => setChartStyle(e.target.value as ChartStyle)}
            className="fx-search-input"
            style={{ fontSize: "11px", padding: "3px 6px", height: "26px" }}
          >
            <option value="candlestick">🕯 Candlesticks</option>
            <option value="hollow_candlestick">🕯 Hollow Candles</option>
            <option value="bar">📊 OHLC Bars</option>
            <option value="line">📈 Line</option>
            <option value="area">⛰ Mountain / Area</option>
            <option value="baseline">⚖ Baseline</option>
          </select>

          {/* Indicators Modal Trigger */}
          <button
            type="button"
            className="edgar-search-btn"
            style={{ fontSize: "11px", padding: "4px 8px" }}
            onClick={() => setIsIndicatorsModalOpen((prev) => !prev)}
          >
            ƒx INDICATORS ({activeIndicatorsCount})
          </button>

          {/* Height / Size Presets */}
          {!isFullscreen && (
            <div style={{ display: "flex", gap: "2px" }}>
              <button
                type="button"
                className={`macro-tf-btn${chartHeight === 220 ? " macro-tf-active" : ""}`}
                style={{ fontSize: "9px", padding: "2px 4px" }}
                onClick={() => setChartHeight(220)}
                title="Compact Window (220px)"
              >
                SM
              </button>
              <button
                type="button"
                className={`macro-tf-btn${chartHeight === 280 ? " macro-tf-active" : ""}`}
                style={{ fontSize: "9px", padding: "2px 4px" }}
                onClick={() => setChartHeight(280)}
                title="Standard Window (280px)"
              >
                MD
              </button>
              <button
                type="button"
                className={`macro-tf-btn${chartHeight === 400 ? " macro-tf-active" : ""}`}
                style={{ fontSize: "9px", padding: "2px 4px" }}
                onClick={() => setChartHeight(400)}
                title="Large Window (400px)"
              >
                LG
              </button>
              <button
                type="button"
                className={`macro-tf-btn${chartHeight === 560 ? " macro-tf-active" : ""}`}
                style={{ fontSize: "9px", padding: "2px 4px" }}
                onClick={() => setChartHeight(560)}
                title="Extra Large Window (560px)"
              >
                XL
              </button>
            </div>
          )}

          {/* Fullscreen Maximize Toggle */}
          <button
            type="button"
            className="edgar-search-btn"
            style={{ fontSize: "11px", padding: "4px 8px" }}
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? "Exit Fullscreen (ESC)" : "Expand to Fullscreen"}
          >
            {isFullscreen ? "✕ CLOSE" : "⛶ EXPAND"}
          </button>

          <span className={`news-status news-status-${status}`}>{status}</span>
        </div>
      </header>

      {/* Main Controls Toolbar (Quick Symbols + Resolution + Range + Search) */}
      <div className="chart-controls-bar" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid var(--border)", padding: "6px 8px" }}>
        <div className="fx-quick-pills">
          <span className="fx-quick-label">SYMBOL:</span>
          {QUICK_SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              className={`fx-pill${symbol === s ? " fx-pill-active" : ""}`}
              onClick={() => setSymbol(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="chart-toolbar-right" style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          {/* Resolution Selector */}
          <div className="chart-tf-group" style={{ display: "flex", flexWrap: "wrap", gap: "2px", alignItems: "center" }}>
            <span style={{ fontSize: "9px", color: "var(--muted)", marginRight: "2px", fontWeight: 700 }}>RES:</span>
            {RESOLUTIONS.map((res) => (
              <button
                key={res.label}
                type="button"
                className={`macro-tf-btn${selectedResolution.label === res.label ? " macro-tf-active" : ""}`}
                style={{
                  fontSize: "10px",
                  padding: "2px 5px",
                  fontWeight: selectedResolution.label === res.label ? 700 : 500,
                  color: res.category === "MACRO" ? "var(--accent)" : undefined,
                }}
                onClick={() => setSelectedResolution(res)}
                title={`Candle Resolution: ${res.label}`}
              >
                {res.label}
              </button>
            ))}
          </div>

          <div style={{ width: "1px", height: "16px", background: "var(--border)", margin: "0 2px" }} />

          {/* Lookback Range Selector */}
          <div className="chart-tf-group" style={{ display: "flex", flexWrap: "wrap", gap: "2px", alignItems: "center" }}>
            <span style={{ fontSize: "9px", color: "var(--muted)", marginRight: "2px", fontWeight: 700 }}>RANGE:</span>
            {RANGES.map((rng) => (
              <button
                key={rng.label}
                type="button"
                className={`macro-tf-btn${selectedRange.label === rng.label ? " macro-tf-active" : ""}`}
                style={{
                  fontSize: "10px",
                  padding: "2px 5px",
                  fontWeight: selectedRange.label === rng.label ? 700 : 500,
                  color: rng.label === "ALL" ? "#3ecf6e" : undefined,
                }}
                onClick={() => setSelectedRange(rng)}
                title={rng.label === "ALL" ? "Full History from Inception" : `Lookback Range: ${rng.label}`}
              >
                {rng.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearch} style={{ display: "flex", gap: 4 }}>
            <input
              type="text"
              className="fx-search-input"
              style={{ width: 70, fontSize: "11px" }}
              aria-label="Search chart ticker symbol"
              placeholder="TICKER"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
            <button type="submit" className="edgar-search-btn" style={{ fontSize: "10px", padding: "2px 6px" }}>
              GO
            </button>
          </form>
        </div>
      </div>

      {/* OHLCV Readout Banner */}
      {activeBar && (
        <div className="chart-readout-strip" style={{ display: "flex", flexWrap: "wrap", gap: "12px", padding: "4px 8px", background: "rgba(0,0,0,0.4)", borderBottom: "1px solid var(--border)", fontSize: "11px" }}>
          <span><strong style={{ color: "var(--muted)" }}>TIME:</strong> {activeBar.time}</span>
          <span><strong style={{ color: "var(--muted)" }}>O:</strong> ${fmt(activeBar.open)}</span>
          <span><strong style={{ color: "var(--muted)" }}>H:</strong> ${fmt(activeBar.high)}</span>
          <span><strong style={{ color: "var(--muted)" }}>L:</strong> ${fmt(activeBar.low)}</span>
          <span><strong style={{ color: "var(--muted)" }}>C:</strong> ${fmt(activeBar.close)}</span>
          <span><strong style={{ color: "var(--muted)" }}>VOL:</strong> {activeBar.volume ? activeBar.volume.toLocaleString() : "—"}</span>
          {showSma20 && activeBar.sma20 && <span><strong style={{ color: "#e0a835" }}>SMA20:</strong> ${fmt(activeBar.sma20)}</span>}
          {showSma50 && activeBar.sma50 && <span><strong style={{ color: "#00bcd4" }}>SMA50:</strong> ${fmt(activeBar.sma50)}</span>}
          {showRsi && activeBar.rsi14 && <span><strong style={{ color: "#ab47bc" }}>RSI14:</strong> {activeBar.rsi14.toFixed(1)}</span>}
        </div>
      )}

      {/* Main Chart Station Work Area (Left Drawing Dock + Center Chart Canvas) */}
      <div
        style={{
          display: "flex",
          position: "relative",
          height: isFullscreen ? "calc(100vh - 180px)" : `${chartHeight}px`,
          minHeight: "260px",
          width: "100%",
          overflow: "hidden",
        }}
      >
        {/* Left Drawing Tools Dock */}
        <div
          style={{
            width: "38px",
            borderRight: "1px solid var(--border)",
            background: "#0d0e10",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "6px 0",
            gap: "6px",
            zIndex: 20,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className={`fx-pill${activeTool === "cursor" ? " fx-pill-active" : ""}`}
            style={{ width: "30px", height: "30px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setActiveTool("cursor")}
            title="Crosshair / Cursor Pan & Zoom"
          >
            ✚
          </button>
          <button
            type="button"
            className={`fx-pill${activeTool === "trendline" ? " fx-pill-active" : ""}`}
            style={{ width: "30px", height: "30px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setActiveTool("trendline")}
            title="Trendline Tool (Click 2 points)"
          >
            ╱
          </button>
          <button
            type="button"
            className={`fx-pill${activeTool === "horizontal_line" ? " fx-pill-active" : ""}`}
            style={{ width: "30px", height: "30px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setActiveTool("horizontal_line")}
            title="Horizontal Price Level Tool (Click to place)"
          >
            ―
          </button>
          <button
            type="button"
            className={`fx-pill${activeTool === "fibonacci" ? " fx-pill-active" : ""}`}
            style={{ width: "30px", height: "30px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setActiveTool("fibonacci")}
            title="Fibonacci Retracement (Click High to Low)"
          >
            ≡
          </button>
          <button
            type="button"
            className={`fx-pill${activeTool === "ruler" ? " fx-pill-active" : ""}`}
            style={{ width: "30px", height: "30px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setActiveTool("ruler")}
            title="Measurement Ruler (Price & % Delta)"
          >
            📐
          </button>
          <div style={{ width: "24px", height: "1px", background: "var(--border)", margin: "4px 0" }} />
          {drawings.length > 0 && (
            <>
              <button
                type="button"
                className="fx-pill"
                style={{ width: "30px", height: "30px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={() => setDrawings((prev) => prev.slice(0, -1))}
                title="Undo Last Drawing"
              >
                ↶
              </button>
              <button
                type="button"
                className="fx-pill"
                style={{ width: "30px", height: "30px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ask)" }}
                onClick={() => setDrawings([])}
                title="Clear All Drawings"
              >
                🗑
              </button>
            </>
          )}
        </div>

        {/* Center Main Chart Container & Drawing Layer */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", minWidth: 0, height: "100%", overflow: "hidden" }}>
          {status === "loading" && !data ? (
            <p className="news-empty" style={{ margin: "auto" }}>
              Initializing TradingView Canvas Engine &amp; OHLCV Bars…
            </p>
          ) : (
            <div style={{ position: "relative", width: "100%", flex: 1, minHeight: "180px", overflow: "hidden" }}>
              {/* TradingView Chart Container */}
              <div ref={chartContainerRef} style={{ width: "100%", height: "100%" }} />

              {/* Interactive Drawing Canvas Layer */}
              <canvas
                ref={drawingCanvasRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: activeTool === "cursor" ? "none" : "auto",
                  cursor: activeTool === "cursor" ? "crosshair" : "crosshair",
                  zIndex: 10,
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
              />
            </div>
          )}

          {/* Secondary Sub-Chart Pane: RSI (14) */}
          {showRsi && rsiValues.length > 0 && (
            <div style={{ height: "60px", flexShrink: 0, borderTop: "1px solid var(--border)", background: "#0d0e10", padding: "4px 8px", position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)" }}>
                <span>RSI (14) · Wilder Momentum</span>
                <span style={{ color: "#ab47bc", fontWeight: 700 }}>
                  {activeBar?.rsi14 ? activeBar.rsi14.toFixed(1) : rsiValues[rsiValues.length - 1]?.toFixed(1) || "50.0"}
                </span>
              </div>
              <svg width="100%" height="40" preserveAspectRatio="none" viewBox="0 0 500 40">
                <line x1="0" y1="12" x2="500" y2="12" stroke="rgba(226, 85, 85, 0.3)" strokeDasharray="3 3" />
                <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="3 3" />
                <line x1="0" y1="28" x2="500" y2="28" stroke="rgba(62, 207, 110, 0.3)" strokeDasharray="3 3" />
                <path
                  d={rsiValues
                    .filter((v): v is number => v !== null)
                    .map((v, idx, arr) => `${idx === 0 ? "M" : "L"}${(idx / (arr.length - 1)) * 500},${40 - (v / 100) * 40}`)
                    .join(" ")}
                  fill="none"
                  stroke="#ab47bc"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          )}

          {/* Secondary Sub-Chart Pane: MACD (12, 26, 9) */}
          {showMacd && macdPoints.length > 0 && (
            <div style={{ height: "60px", flexShrink: 0, borderTop: "1px solid var(--border)", background: "#0d0e10", padding: "4px 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)" }}>
                <span>MACD (12, 26, 9) · Convergence / Divergence</span>
                <span style={{ color: "#29b6f6" }}>
                  HIST: {macdPoints[macdPoints.length - 1]?.histogram?.toFixed(2) || "0.00"}
                </span>
              </div>
              <svg width="100%" height="40" preserveAspectRatio="none" viewBox="0 0 500 40">
                <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255, 255, 255, 0.1)" />
                {macdPoints.map((p, idx, arr) => {
                  if (p.histogram === null) return null;
                  const x = (idx / (arr.length - 1)) * 500;
                  const barH = Math.min(18, Math.abs(p.histogram) * 4);
                  const isPositive = p.histogram >= 0;
                  return (
                    <rect
                      key={idx}
                      x={x - 1.5}
                      y={isPositive ? 20 - barH : 20}
                      width={3}
                      height={Math.max(1, barH)}
                      fill={isPositive ? "rgba(62, 207, 110, 0.7)" : "rgba(226, 85, 85, 0.7)"}
                    />
                  );
                })}
              </svg>
            </div>
          )}

          {/* Secondary Sub-Chart Pane: Williams %R (14) */}
          {showWilliamsR && wrValues.length > 0 && (
            <div style={{ height: "60px", flexShrink: 0, borderTop: "1px solid var(--border)", background: "#0d0e10", padding: "4px 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)" }}>
                <span>WILLIAMS %R (14) · Momentum Oscillator</span>
                <span style={{ color: "#ffab00" }}>
                  %R: {wrValues[wrValues.length - 1]?.toFixed(1) || "—"}
                </span>
              </div>
              <svg width="100%" height="40" preserveAspectRatio="none" viewBox="0 0 500 40">
                <line x1="0" y1="8" x2="500" y2="8" stroke="rgba(226, 85, 85, 0.3)" strokeDasharray="3 3" />
                <line x1="0" y1="32" x2="500" y2="32" stroke="rgba(62, 207, 110, 0.3)" strokeDasharray="3 3" />
                <path
                  d={wrValues
                    .filter((v): v is number => v !== null)
                    .map((v, idx, arr) => `${idx === 0 ? "M" : "L"}${(idx / (arr.length - 1)) * 500},${40 - (Math.abs(v) / 100) * 40}`)
                    .join(" ")}
                  fill="none"
                  stroke="#ffab00"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          )}

          {/* Secondary Sub-Chart Pane: CCI (20) */}
          {showCci && cciValues.length > 0 && (
            <div style={{ height: "60px", flexShrink: 0, borderTop: "1px solid var(--border)", background: "#0d0e10", padding: "4px 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)" }}>
                <span>CCI (20) · Commodity Channel Index</span>
                <span style={{ color: "#00e5ff" }}>
                  CCI: {cciValues[cciValues.length - 1]?.toFixed(1) || "0.0"}
                </span>
              </div>
              <svg width="100%" height="40" preserveAspectRatio="none" viewBox="0 0 500 40">
                <line x1="0" y1="10" x2="500" y2="10" stroke="rgba(226, 85, 85, 0.3)" strokeDasharray="3 3" />
                <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255, 255, 255, 0.1)" />
                <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(62, 207, 110, 0.3)" strokeDasharray="3 3" />
                <path
                  d={cciValues
                    .filter((v): v is number => v !== null)
                    .map((v, idx, arr) => {
                      const clamped = Math.max(-200, Math.min(200, v));
                      const y = 20 - (clamped / 200) * 18;
                      return `${idx === 0 ? "M" : "L"}${(idx / (arr.length - 1)) * 500},${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#00e5ff"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Drag-to-Resize Handle */}
      {!isFullscreen && (
        <div
          className="chart-resize-handle"
          onMouseDown={handleResizeMouseDown}
          title="Click and drag up/down to adjust chart window height"
        >
          <div className="chart-resize-grip" />
        </div>
      )}

      {/* Quantitative Indicators Catalog Modal */}
      {isIndicatorsModalOpen && (
        <div className="chart-indicator-modal" style={{ width: "360px", maxHeight: "420px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "6px", marginBottom: "8px" }}>
            <strong style={{ color: "var(--accent)", fontSize: "12px" }}>ƒx TECHNICAL INDICATORS &amp; STRATEGIES</strong>
            <button
              type="button"
              className="fx-pill"
              style={{ padding: "2px 6px" }}
              onClick={() => setIsIndicatorsModalOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Search & Category Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
            <input
              type="text"
              className="fx-search-input"
              style={{ width: "100%", fontSize: "11px", padding: "4px 8px" }}
              placeholder="Filter strategies by name or type..."
              value={indicatorSearch}
              onChange={(e) => setIndicatorSearch(e.target.value)}
            />

            <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
              {(["ALL", "TREND", "BANDS", "MOMENTUM", "VOLUME"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`macro-tf-btn${indicatorTab === cat ? " macro-tf-active" : ""}`}
                  style={{ fontSize: "9px", padding: "2px 6px" }}
                  onClick={() => setIndicatorTab(cat)}
                >
                  {cat}
                </button>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  className="fx-pill"
                  style={{ fontSize: "9px", padding: "2px 5px", color: "var(--ask)" }}
                  onClick={() => {
                    setShowSma20(false);
                    setShowSma50(false);
                    setShowSma200(false);
                    setShowEma9(false);
                    setShowEma21(false);
                    setShowEma200(false);
                    setShowHma9(false);
                    setShowVwap(false);
                    setShowSupertrend(false);
                    setShowBb(false);
                    setShowDonchian(false);
                    setShowKeltner(false);
                    setShowRsi(false);
                    setShowMacd(false);
                    setShowStoch(false);
                    setShowWilliamsR(false);
                    setShowCci(false);
                    setShowVolumeMa(false);
                  }}
                  title="Clear All Active Indicators"
                >
                  CLEAR
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
            {/* Volume Section */}
            {(indicatorTab === "ALL" || indicatorTab === "VOLUME") && (!indicatorSearch || "volume".includes(indicatorSearch.toLowerCase())) && (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--text)" }}>
                  <input type="checkbox" checked={showVolume} onChange={(e) => setShowVolume(e.target.checked)} />
                  📊 Volume Histogram (Color-Coded)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#ffeb3b" }}>
                  <input type="checkbox" checked={showVolumeMa} onChange={(e) => setShowVolumeMa(e.target.checked)} />
                  — Volume MA 20 (Average Volume Line)
                </label>
              </>
            )}

            {/* Trend & Moving Averages Section */}
            {(indicatorTab === "ALL" || indicatorTab === "TREND") && (
              <>
                {(!indicatorSearch || "sma 20".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#e0a835" }}>
                    <input type="checkbox" checked={showSma20} onChange={(e) => setShowSma20(e.target.checked)} />
                    — SMA 20 (Short-Term Trend)
                  </label>
                )}
                {(!indicatorSearch || "sma 50".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#00bcd4" }}>
                    <input type="checkbox" checked={showSma50} onChange={(e) => setShowSma50(e.target.checked)} />
                    — SMA 50 (Medium-Term Trend)
                  </label>
                )}
                {(!indicatorSearch || "sma 200".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#e91e63" }}>
                    <input type="checkbox" checked={showSma200} onChange={(e) => setShowSma200(e.target.checked)} />
                    — SMA 200 (Macro Secular Barrier / Golden Cross)
                  </label>
                )}
                {(!indicatorSearch || "ema 9".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#76ff03" }}>
                    <input type="checkbox" checked={showEma9} onChange={(e) => setShowEma9(e.target.checked)} />
                    — EMA 9 (Fast Scalping Average)
                  </label>
                )}
                {(!indicatorSearch || "ema 21".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#ff9100" }}>
                    <input type="checkbox" checked={showEma21} onChange={(e) => setShowEma21(e.target.checked)} />
                    — EMA 21 (Swing Average Baseline)
                  </label>
                )}
                {(!indicatorSearch || "ema 200".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#9c27b0" }}>
                    <input type="checkbox" checked={showEma200} onChange={(e) => setShowEma200(e.target.checked)} />
                    — EMA 200 (Exponential Secular Line)
                  </label>
                )}
                {(!indicatorSearch || "hma hull".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#00e5ff" }}>
                    <input type="checkbox" checked={showHma9} onChange={(e) => setShowHma9(e.target.checked)} />
                    ⚡ HMA 9 (Hull Moving Average — Low-Lag)
                  </label>
                )}
                {(!indicatorSearch || "vwap".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#ffffff" }}>
                    <input type="checkbox" checked={showVwap} onChange={(e) => setShowVwap(e.target.checked)} />
                    --- VWAP (Volume Weighted Average Price)
                  </label>
                )}
                {(!indicatorSearch || "supertrend".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#00e676" }}>
                    <input type="checkbox" checked={showSupertrend} onChange={(e) => setShowSupertrend(e.target.checked)} />
                    🛡 Supertrend (10, 3.0 ATR Trailing Stop)
                  </label>
                )}
              </>
            )}

            {/* Bands & Channels Section */}
            {(indicatorTab === "ALL" || indicatorTab === "BANDS") && (
              <>
                {(!indicatorSearch || "bollinger".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#2979ff" }}>
                    <input type="checkbox" checked={showBb} onChange={(e) => setShowBb(e.target.checked)} />
                    ☷ Bollinger Bands (20, 2.0σ)
                  </label>
                )}
                {(!indicatorSearch || "donchian".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#e040fb" }}>
                    <input type="checkbox" checked={showDonchian} onChange={(e) => setShowDonchian(e.target.checked)} />
                    ☷ Donchian Channels (20 Breakout Bands)
                  </label>
                )}
                {(!indicatorSearch || "keltner".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#7c4dff" }}>
                    <input type="checkbox" checked={showKeltner} onChange={(e) => setShowKeltner(e.target.checked)} />
                    ☷ Keltner Channels (20, 1.5 ATR Envelope)
                  </label>
                )}
              </>
            )}

            {/* Momentum & Oscillators Section */}
            {(indicatorTab === "ALL" || indicatorTab === "MOMENTUM") && (
              <>
                {(!indicatorSearch || "rsi".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#ab47bc" }}>
                    <input type="checkbox" checked={showRsi} onChange={(e) => setShowRsi(e.target.checked)} />
                    〰 RSI 14 (Relative Strength Index)
                  </label>
                )}
                {(!indicatorSearch || "macd".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#29b6f6" }}>
                    <input type="checkbox" checked={showMacd} onChange={(e) => setShowMacd(e.target.checked)} />
                    📶 MACD (12, 26, 9 Oscillator)
                  </label>
                )}
                {(!indicatorSearch || "stochastic".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#ffb74d" }}>
                    <input type="checkbox" checked={showStoch} onChange={(e) => setShowStoch(e.target.checked)} />
                    ⚡ Stochastic Oscillator (14, 3, 3)
                  </label>
                )}
                {(!indicatorSearch || "williams %r".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#ffab00" }}>
                    <input type="checkbox" checked={showWilliamsR} onChange={(e) => setShowWilliamsR(e.target.checked)} />
                    📉 Williams %R (14 Momentum Oscillator)
                  </label>
                )}
                {(!indicatorSearch || "cci".includes(indicatorSearch.toLowerCase())) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#00e5ff" }}>
                    <input type="checkbox" checked={showCci} onChange={(e) => setShowCci(e.target.checked)} />
                    📈 CCI (20 Commodity Channel Index)
                  </label>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
