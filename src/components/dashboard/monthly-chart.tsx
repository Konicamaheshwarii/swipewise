"use client";

import { useState } from "react";
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps,
} from "recharts";
import { cn, inr } from "@/lib/format";
import type { MonthPoint } from "./model";

/* Validated (dark, surface #0e0e13): lightness band, CVD ΔE 17.8, normal ΔE 24.1. */
const EARNED = "#2fa58a";
const OPTIMAL = "#8b7cf6";
const GRID = "rgba(255,255,255,0.06)";
const TICK = { fill: "#6b6b76", fontSize: 11 };

function MonthTip({ active, payload }: TooltipContentProps) {
  const p = payload?.[0]?.payload as MonthPoint | undefined;
  if (!active || !p) return null;
  const gap = Math.max(0, p.optimal - p.actual);
  return (
    <div className="min-w-44 rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2.5 text-xs shadow-2xl backdrop-blur">
      <p className="mb-1.5 font-medium text-ink">{p.label.replace(" ’", " 20")}</p>
      <Row label="Spend" value={inr(p.spend)} swatch="bg-white/30" />
      <Row label="Earned" value={inr(p.actual)} color={EARNED} />
      {/* Split only when the month mixes reward types. */}
      {[p.cashback, p.pointsValue, p.milesValue].filter((v) => Math.abs(v) >= 0.5).length > 1 && (
        <div className="mb-0.5 ml-3.5 border-l border-line pl-2 text-[11px]">
          {Math.abs(p.cashback) >= 0.5 && <Sub label="Cashback" value={inr(p.cashback)} />}
          {p.pointsValue >= 0.5 && <Sub label="Points" value={`≈ ${inr(p.pointsValue)}`} />}
          {p.milesValue >= 0.5 && <Sub label="Miles" value={`≈ ${inr(p.milesValue)}`} />}
        </div>
      )}
      <Row label="Possible" value={inr(p.optimal)} color={OPTIMAL} />
      {gap >= 1 && <p className="mt-1.5 border-t border-line pt-1.5 text-muted">Left on the table <span className="num font-medium text-bad">{inr(gap)}</span></p>}
    </div>
  );
}

function Sub({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-faint">
      <span>{label}</span>
      <span className="num text-muted">{value}</span>
    </div>
  );
}

function Row({ label, value, color, swatch }: { label: string; value: string; color?: string; swatch?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-1.5 text-muted">
        <span className={cn("size-2 rounded-full", swatch)} style={color ? { background: color } : undefined} />
        {label}
      </span>
      <span className="num text-ink">{value}</span>
    </div>
  );
}

const compact = (v: number) => inr(v, { compact: true });

/** Small multiples on a shared month axis: spend (columns) above rewards earned vs possible (lines). */
export function MonthlyChart({ months }: { months: MonthPoint[] }) {
  const [table, setTable] = useState(false);
  const last = months[months.length - 1];
  const totalActual = months.reduce((s, m) => s + m.actual, 0);
  const totalOptimal = months.reduce((s, m) => s + m.optimal, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <Legend color={EARNED} label="Rewards earned" value={inr(totalActual)} />
          <Legend color={OPTIMAL} label="Best-card possible" value={inr(totalOptimal)} />
        </div>
        <div className="flex rounded-lg border border-line p-0.5 text-[11px]">
          {(["Chart", "Table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setTable(v === "Table")}
              className={cn(
                "cursor-pointer rounded-md px-2 py-0.5 transition-colors",
                table === (v === "Table") ? "bg-white/10 text-ink" : "text-faint hover:text-muted",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {table ? (
        <div className="mt-4 overflow-x-auto px-5 pb-5 sm:px-6">
          <table className="num w-full min-w-[420px] text-xs">
            <thead className="text-left text-faint">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">Month</th>
                <th className="py-2 text-right font-medium">Spend</th>
                <th className="py-2 text-right font-medium">Earned</th>
                <th className="py-2 text-right font-medium">Possible</th>
                <th className="py-2 text-right font-medium">Missed</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.key} className="border-b border-line/60 last:border-0">
                  <td className="py-1.5 text-muted">{m.label}</td>
                  <td className="py-1.5 text-right">{inr(m.spend)}</td>
                  <td className="py-1.5 text-right">{inr(m.actual)}</td>
                  <td className="py-1.5 text-right">{inr(m.optimal)}</td>
                  <td className="py-1.5 text-right text-muted">{inr(Math.max(0, m.optimal - m.actual))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 pb-3">
          <p className="px-5 text-[11px] font-medium uppercase tracking-[0.14em] text-faint sm:px-6">Monthly spend</p>
          <div className="h-36 sm:h-40">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={months} margin={{ top: 10, right: 20, bottom: 0, left: 4 }} syncId="monthly">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" hide />
                <YAxis tickFormatter={compact} tick={TICK} axisLine={false} tickLine={false} width={48} tickCount={3} />
                <Tooltip content={MonthTip} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="spend" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
                  {months.map((m) => (
                    <Cell key={m.key} fill={m === last ? "#d4ff3a" : "rgba(255,255,255,0.16)"} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <p className="mt-2 px-5 text-[11px] font-medium uppercase tracking-[0.14em] text-faint sm:px-6">Rewards · earned vs possible</p>
          <div className="h-44 sm:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={months} margin={{ top: 10, right: 20, bottom: 0, left: 4 }} syncId="monthly">
                <defs>
                  <linearGradient id="optWash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={OPTIMAL} stopOpacity={0.14} />
                    <stop offset="1" stopColor={OPTIMAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                <YAxis tickFormatter={compact} tick={TICK} axisLine={false} tickLine={false} width={48} tickCount={3} />
                <Tooltip content={MonthTip} cursor={{ stroke: "rgba(255,255,255,0.15)" }} />
                <Area type="monotone" dataKey="optimal" stroke="none" fill="url(#optWash)" isAnimationActive={false} activeDot={false} />
                <Line type="monotone" dataKey="optimal" stroke={OPTIMAL} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#0e0e13", strokeWidth: 2 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="actual" stroke={EARNED} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#0e0e13", strokeWidth: 2 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
      {label}
      <span className="num font-medium text-ink">{value}</span>
    </span>
  );
}
