"use client";

import React, { useEffect, useRef, useState } from "react";

export interface TickFlashProps {
  value: number | string;
  displayValue?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function TickFlash({
  value,
  displayValue,
  className = "",
  style,
}: TickFlashProps) {
  const [flashDir, setFlashDir] = useState<"up" | "down" | null>(null);
  const prevValRef = useRef<number | string>(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const prev = prevValRef.current;
    if (prev !== value) {
      const numCur = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
      const numPrev = typeof prev === "number" ? prev : parseFloat(String(prev).replace(/[^0-9.-]/g, ""));

      if (!isNaN(numCur) && !isNaN(numPrev)) {
        if (numCur > numPrev) {
          setFlashDir("up");
        } else if (numCur < numPrev) {
          setFlashDir("down");
        }
      }

      prevValRef.current = value;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setFlashDir(null);
      }, 600);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  const flashClass = flashDir === "up" ? "tick-up" : flashDir === "down" ? "tick-down" : "";

  return (
    <span className={`tick-cell ${flashClass} ${className}`.trim()} style={style}>
      {displayValue !== undefined ? displayValue : value}
    </span>
  );
}

