import { LineChart, type SeriesPoint } from "@molcrafts/molplot";
import { useEffect, useRef } from "react";
import {
  lerpSchedule,
  tempPointsToSchedulePoints,
} from "../model/schedule";
import type { SchedulePoint, TempControlPoint } from "../model/types";
import { css } from "./styles";

const TWEEN_MS = 420;
const CURSOR_SERIES = "cursor";
const T_SERIES = "T";

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * molplot LineChart driven by temperature control points.
 *
 * - Curve series updates with a short tween animation when points change.
 * - Optional playhead (`cursor` series) walks the polyline once when
 *   `playToken` increments (Play schedule button).
 */
export function TempScheduleChart({
  tempPoints,
  playToken = 0,
}: {
  tempPoints: TempControlPoint[];
  /** Bump to replay the walk-along animation. */
  playToken?: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<LineChart | null>(null);
  const displayedRef = useRef<SchedulePoint[]>([]);
  const tweenRafRef = useRef<number | null>(null);
  const playRafRef = useRef<number | null>(null);

  // Mount chart once
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const initial = tempPointsToSchedulePoints(tempPoints);
    displayedRef.current = initial;
    const chart = new LineChart(el, {
      preset: "molplot",
      theme: "auto",
      showLegend: false,
      series: [
        {
          id: T_SERIES,
          label: "T schedule",
          mode: "lines+markers",
          width: 2.5,
          initialPoints: initial as SeriesPoint[],
        },
        {
          id: CURSOR_SERIES,
          label: "playhead",
          mode: "lines+markers",
          color: "#e11d48",
          width: 3,
          opacity: 1,
          // Hidden until Play schedule (empty → no mark)
          initialPoints: [],
        },
      ],
      xAxis: { label: "Step" },
      yAxis: { label: "Temperature" },
    });
    chartRef.current = chart;
    // Soft entrance: host fades in after first embed
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
    el.style.transition =
      "opacity 0.45s ease, transform 0.45s ease, box-shadow 0.35s ease";
    void chart.ready().then(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    return () => {
      if (tweenRafRef.current != null) cancelAnimationFrame(tweenRafRef.current);
      if (playRafRef.current != null) cancelAnimationFrame(playRafRef.current);
      chart.dispose();
      chartRef.current = null;
    };
    // mount once — tempPoints read only for initial series
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tween curve when control points change
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const target = tempPointsToSchedulePoints(tempPoints);
    const from = displayedRef.current.length
      ? displayedRef.current
      : target;

    if (tweenRafRef.current != null) {
      cancelAnimationFrame(tweenRafRef.current);
      tweenRafRef.current = null;
    }

    // Skip tween if identical
    if (
      from.length === target.length &&
      from.every(
        (p, i) => p.x === target[i].x && p.y === target[i].y,
      )
    ) {
      return;
    }

    const t0 = performance.now();
    const tick = (now: number) => {
      const u = easeOutCubic(
        Math.min(1, (now - t0) / TWEEN_MS),
      );
      const mid = lerpSchedule(from, target, u);
      displayedRef.current = mid;
      void chart.setSeries(T_SERIES, mid as SeriesPoint[]);
      if (u < 1) {
        tweenRafRef.current = requestAnimationFrame(tick);
      } else {
        displayedRef.current = target;
        tweenRafRef.current = null;
      }
    };
    tweenRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (tweenRafRef.current != null) {
        cancelAnimationFrame(tweenRafRef.current);
        tweenRafRef.current = null;
      }
    };
  }, [tempPoints]);

  // Playhead walk-along animation
  useEffect(() => {
    if (playToken === 0) return;
    const chart = chartRef.current;
    if (!chart) return;
    const path = tempPointsToSchedulePoints(tempPoints);
    if (path.length < 2) return;

    if (playRafRef.current != null) {
      cancelAnimationFrame(playRafRef.current);
      playRafRef.current = null;
    }

    // Arc-length parameterization
    const segs: { x0: number; y0: number; x1: number; y1: number; len: number }[] =
      [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      // Normalize x (steps) vs y (T) for visual speed — weight step more
      const len = Math.hypot(dx / 1000, dy);
      segs.push({
        x0: path[i - 1].x,
        y0: path[i - 1].y,
        x1: path[i].x,
        y1: path[i].y,
        len,
      });
      total += len;
    }
    if (total <= 0) return;

    const duration = Math.min(2800, Math.max(900, total * 180));
    const t0 = performance.now();
    const host = hostRef.current;
    if (host) {
      host.style.boxShadow = "0 0 0 2px rgba(225, 29, 72, 0.35)";
    }

    const sampleAt = (s: number): SchedulePoint => {
      let remain = s * total;
      for (const seg of segs) {
        if (remain <= seg.len || seg === segs[segs.length - 1]) {
          const u = seg.len > 0 ? Math.min(1, remain / seg.len) : 1;
          return {
            x: seg.x0 + (seg.x1 - seg.x0) * u,
            y: seg.y0 + (seg.y1 - seg.y0) * u,
          };
        }
        remain -= seg.len;
      }
      return path[path.length - 1];
    };

    const tick = (now: number) => {
      const u = easeOutCubic(Math.min(1, (now - t0) / duration));
      const pt = sampleAt(u);
      void chart.setSeries(CURSOR_SERIES, [
        { x: pt.x, y: pt.y },
      ] as SeriesPoint[]);
      if (u < 1) {
        playRafRef.current = requestAnimationFrame(tick);
      } else {
        window.setTimeout(() => {
          void chart.setSeries(CURSOR_SERIES, []);
          if (host) host.style.boxShadow = "none";
        }, 400);
        playRafRef.current = null;
      }
    };
    playRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (playRafRef.current != null) {
        cancelAnimationFrame(playRafRef.current);
        playRafRef.current = null;
      }
    };
  }, [playToken, tempPoints]);

  return (
    <div
      ref={hostRef}
      style={{
        ...css.chartHost,
        transition: "box-shadow 0.35s ease, border-color 0.35s ease",
      }}
      aria-label="Temperature schedule (molplot)"
    />
  );
}
