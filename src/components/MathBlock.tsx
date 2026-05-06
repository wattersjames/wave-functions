"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useEffect, useRef } from "react";

type MathBlockProps = {
  latex: string;
  displayMode?: boolean;
};

export function MathBlock({ latex, displayMode = true }: MathBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    katex.render(latex, ref.current, {
      displayMode,
      throwOnError: false,
      trust: false,
    });
  }, [latex, displayMode]);

  return (
    <div
      ref={ref}
      className="text-foreground overflow-x-auto py-1 text-center text-[0.95rem] sm:text-base"
    />
  );
}
