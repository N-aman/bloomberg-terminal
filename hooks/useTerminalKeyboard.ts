"use client";

import { useEffect } from "react";

export interface UseTerminalKeyboardProps {
  allPanelRefs: React.RefObject<HTMLElement | null>[];
  commandBarRef: React.RefObject<HTMLInputElement | null>;
  indicesPanelRef: React.RefObject<HTMLElement | null>;
  moversPanelRef: React.RefObject<HTMLElement | null>;
  fxMatrixPanelRef: React.RefObject<HTMLElement | null>;
  commoditiesPanelRef: React.RefObject<HTMLElement | null>;
  calendarPanelRef: React.RefObject<HTMLElement | null>;
  setFocusedPanelIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setCommandNotice: (notice: string) => void;
  scrollToPanel: (ref: React.RefObject<HTMLElement | null>) => void;
}

export function useTerminalKeyboard({
  allPanelRefs,
  commandBarRef,
  indicesPanelRef,
  moversPanelRef,
  fxMatrixPanelRef,
  commoditiesPanelRef,
  calendarPanelRef,
  setFocusedPanelIndex,
  setCommandNotice,
  scrollToPanel,
}: UseTerminalKeyboardProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Hotkey: '/' focuses command bar if not already in an input
      if (
        e.key === "/" &&
        document.activeElement !== commandBarRef.current &&
        !(document.activeElement instanceof HTMLInputElement) &&
        !(document.activeElement instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        commandBarRef.current?.focus();
        setFocusedPanelIndex(null);
        return;
      }

      // Hotkey: Escape clears focus ring and refocuses command bar
      if (e.key === "Escape") {
        setFocusedPanelIndex(null);
        commandBarRef.current?.focus();
        return;
      }

      // Function key shortcuts (F1-F6)
      if (e.key === "F1") {
        e.preventDefault();
        setCommandNotice("HELP: F1=HELP F2=WEI F3=MOST F4=FXC F5=COMM F6=ECO");
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        scrollToPanel(indicesPanelRef);
        setCommandNotice("NAV: WEI (World Equity Indices)");
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        scrollToPanel(moversPanelRef);
        setCommandNotice("NAV: MOST (Market Movers)");
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        scrollToPanel(fxMatrixPanelRef);
        setCommandNotice("NAV: FXC (FX Cross Matrix)");
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        scrollToPanel(commoditiesPanelRef);
        setCommandNotice("NAV: COMM (Commodities)");
        return;
      }
      if (e.key === "F6") {
        e.preventDefault();
        scrollToPanel(calendarPanelRef);
        setCommandNotice("NAV: ECO (Economic Calendar)");
        return;
      }

      // Sequential Panel Focus Ring via Tab / Shift+Tab when not inside form elements
      if (
        e.key === "Tab" &&
        document.activeElement !== commandBarRef.current &&
        !(document.activeElement instanceof HTMLInputElement) &&
        !(document.activeElement instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setFocusedPanelIndex((prev) => {
          const total = allPanelRefs.length;
          let nextIdx: number;
          if (e.shiftKey) {
            nextIdx = prev === null || prev <= 0 ? total - 1 : prev - 1;
          } else {
            nextIdx = prev === null || prev >= total - 1 ? 0 : prev + 1;
          }
          const targetRef = allPanelRefs[nextIdx];
          if (targetRef) scrollToPanel(targetRef);
          return nextIdx;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    allPanelRefs,
    commandBarRef,
    indicesPanelRef,
    moversPanelRef,
    fxMatrixPanelRef,
    commoditiesPanelRef,
    calendarPanelRef,
    setFocusedPanelIndex,
    setCommandNotice,
    scrollToPanel,
  ]);
}

