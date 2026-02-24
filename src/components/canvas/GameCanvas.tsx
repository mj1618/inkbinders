"use client";

import { useRef, useEffect } from "react";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";

interface GameCanvasProps {
  width?: number;
  height?: number;
  onMount?: (ctx: CanvasRenderingContext2D) => void;
  onUnmount?: () => void;
}

export function GameCanvas({
  width = CANVAS_WIDTH,
  height = CANVAS_HEIGHT,
  onMount,
  onUnmount,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onMountRef = useRef(onMount);
  const onUnmountRef = useRef(onUnmount);
  onMountRef.current = onMount;
  onUnmountRef.current = onUnmount;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    onMountRef.current?.(ctx);

    return () => {
      onUnmountRef.current?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block bg-zinc-950 border border-zinc-800 rounded"
    />
  );
}
