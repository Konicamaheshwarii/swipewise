"use client";

import Papa from "papaparse";
import { AlertTriangle, CheckCircle2, ChevronDown, Coins, Download, FileSpreadsheet, Sparkles, UploadCloud, Wand2, X } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { Modal } from "@/components/modal";
import { Badge, Button, Select } from "@/components/ui";
import {
  IMPORT_MAX_ROWS, STATEMENT_FIELDS, TEMPLATE_CSV, detectColumns, detectNegativeIsDebit, normalizeCredit, normalizeRow, resolveStatementRow,
  sampleStatementCsv, type AutoInfo, type ColumnMapping, type NormalizedCredit, type NormalizedRow, type RawImportRow, type StatementField,
} from "@/app/app/expenses/import-utils";
import { importCredits } from "@/lib/actions/credits";
import { importExpenses } from "@/lib/actions/expenses";
import { CATEGORIES, CATEGORY_MAP, categoryLabel } from "@/data/categories";
import { cardTitle, cn, fmtDate, inr } from "@/lib/format";
import type { CardView } from "@/lib/wallet";

const CHUNK = 1000;
const PAGE = 40;
const FIELD_LABEL: Record<StatementField, string> = {
  date: "Date", description: "Description", merchant: "Merchant", amount: "Amount", debit: "Debit", credit: "Credit",
  drcr: "Dr / Cr", category: "Category / tag", subcategory: "Subcategory", channel: "Channel", card: "Card / account",
  mcc: "MCC", currency: "Currency", note: "Note",
};
const CONFIDENCE = {
  high: { dot: "bg-good", label: "High confidence" },
  medium: { dot: "bg-warn", label: "Medium confidence" },
  low: { dot: "bg-bad", label: "Low confidence" },
} as const;
const MATCHED_BY = { alias: "known merchant", mcc: "merchant category code", keyword: "keywords in the description", none: "no match" } as const;

interface Parsed {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
}

interface Item {
  index: number;
  /** Spreadsheet line (header is line 1). */
  line: number;
  descriptor: string;
  auto: AutoInfo | null;
  edited: boolean;
  row: RawImportRow;
  checked: { row: NormalizedRow } | { error: string };
}

interface RewardItem {
  index: number;
  line: number;
  descriptor: string;
  row: RawImportRow;
  checked: { row: NormalizedCredit } | { error: string };
}

type Result = {
  imported: number; skipped: number; credits: number; charges: number; unmatchedCards: number; duplicates: number; errors: string[];
  /** Cashback credits saved as rewards received. */
  rewards: number; rewardAmount: number; rewardDuplicates: number; rewardsWithoutCard: number;
};

function download(name: string, text: string) {
  const blob = new Blob([text + "\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export const downloadTemplate = () => download("swipewise-expenses-template.csv", TEMPLATE_CSV);
export const downloadSampleStatement = () => download("sample-bank-statement.csv", sampleStatementCsv());

const plural = (n: number, word: string) => `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;

export function ImportModal({ cards, onClose }: { cards: CardView[]; onClose: () => void }) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [cardId, setCardId] = useState("");
  const [rowCats, setRowCats] = useState<Record<number, string>>({});
  const [groupCats, setGroupCats] = useState<Record<string, string>>({});
  const [lastEdit, setLastEdit] = useState<{ key: string; category: string; name: string; count: number } | null>(null);
  const [filter, setFilter] = useState<"all" | "review">("all");
  const [shown, setShown] = useState(PAGE);
  const [showColumns, setShowColumns] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [progress, setProgress] = useState(0);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function readFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!/\.(csv|txt)$/i.test(file.name) && file.type !== "text/csv") {
      setError("Please choose a .csv file. Export Excel sheets as CSV first.");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const headers = (res.meta.fields ?? []).filter(Boolean);
        if (!headers.length || !res.data.length) {
          setError("That file looks empty. It needs a header row and at least one transaction.");
          return;
        }
        if (res.data.length > IMPORT_MAX_ROWS) {
          setError(`That file has ${res.data.length.toLocaleString("en-IN")} rows. Import up to ${IMPORT_MAX_ROWS.toLocaleString("en-IN")} at a time.`);
          return;
        }
        const detected = detectColumns(headers);
        setParsed({ fileName: file.name, headers, rows: res.data });
        setMapping(detected);
        // A statement belongs to one card: preselect it when there's no card column and only one card.
        setCardId(!detected.card && cards.length === 1 ? cards[0].id : "");
        setRowCats({});
        setGroupCats({});
        setLastEdit(null);
        setFilter("all");
        setShown(PAGE);
        setShowColumns(!detected.date || !(detected.amount || detected.debit || detected.credit));
      },
      error: (err) => setError(`Couldn't read the file: ${err.message}`),
    });
  }

  // Resolve raw rows once per file/mapping/card choice; category edits only re-run the cheap step below.
  const analysis = useMemo(() => {
    if (!parsed || !mapping) return null;
    const negativeIsDebit = detectNegativeIsDebit(parsed.rows, mapping);
    const resolved = parsed.rows.map((r) => resolveStatementRow(r, mapping, { cardId, negativeIsDebit }));
    const groups = new Map<string, number>();
    for (const r of resolved) if (r.kind === "expense" && r.auto) groups.set(r.auto.key, (groups.get(r.auto.key) ?? 0) + 1);
    return { resolved, groups };
  }, [parsed, mapping, cardId]);

  const preview = useMemo(() => {
    if (!analysis || !mapping) return null;
    const items: Item[] = [];
    const rewards: RewardItem[] = [];
    let credits = 0;
    let charges = 0;
    analysis.resolved.forEach((r, index) => {
      if (r.kind === "reward") {
        rewards.push({ index, line: index + 2, descriptor: r.descriptor, row: r.row, checked: normalizeCredit(r.row, cards) });
        return;
      }
      if (r.kind !== "expense") {
        if (r.kind === "credit") credits++;
        else charges++;
        return;
      }
      const override = rowCats[index] ?? (r.auto ? groupCats[r.auto.key] : undefined);
      let row = r.row;
      if (override) {
        // Unknown descriptors take the new category's usual channel.
        const channel = r.auto?.matchedBy === "none" && !mapping.channel && row.channel !== "international" ? CATEGORY_MAP[override]?.defaultChannel : row.channel;
        row = { ...row, category: override, channel };
      }
      items.push({ index, line: index + 2, descriptor: r.descriptor, auto: r.auto, edited: !!override, row, checked: normalizeRow(row, cards) });
    });
    const valid = items.filter((i) => "row" in i.checked);
    const needs = valid.filter((i) => "row" in i.checked && i.checked.row.category === "other");
    const autoDone = valid.filter((i) => i.auto && "row" in i.checked && i.checked.row.category !== "other").length;
    const anyAuto = items.some((i) => i.auto);
    const validRewards = rewards.filter((i): i is RewardItem & { checked: { row: NormalizedCredit } } => "row" in i.checked);
    const rewardTotal = validRewards.reduce((s, i) => s + i.checked.row.amount, 0);
    return {
      items, valid, needs, autoDone, anyAuto, credits, charges, invalid: items.length - valid.length + rewards.length - validRewards.length,
      rewards, validRewards, rewardTotal,
    };
  }, [analysis, mapping, rowCats, groupCats, cards]);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const missingDate = mapping ? !mapping.date : false;
  const missingAmount = mapping ? !(mapping.amount || mapping.debit || mapping.credit) : false;
  const missing = [missingDate && "date", missingAmount && "amount"].filter(Boolean) as string[];

  function setCategory(item: Item, category: string) {
    setRowCats((o) => ({ ...o, [item.index]: category }));
    const key = item.auto?.key;
    const count = key ? analysis?.groups.get(key) ?? 0 : 0;
    setLastEdit(key && count > 1 ? { key, category, name: item.row.merchant || item.descriptor, count } : null);
  }

  function applyToSimilar() {
    if (!lastEdit || !analysis) return;
    const { key, category, count } = lastEdit;
    setGroupCats((g) => ({ ...g, [key]: category }));
    // Rows in the group follow the group choice from now on.
    setRowCats((o) => {
      const next = { ...o };
      analysis.resolved.forEach((r, i) => {
        if (r.kind === "expense" && r.auto?.key === key) delete next[i];
      });
      return next;
    });
    setLastEdit(null);
    toast.success(`${plural(count, "row")} set to ${categoryLabel(category)}`);
  }

  function runImport() {
    if (!preview) return;
    const rows = preview.valid.map((i) => i.row);
    const lines = preview.valid.map((i) => i.line);
    const rewardRows = preview.validRewards.map((i) => i.row);
    const clientErrors = [...preview.items, ...preview.rewards]
      .sort((a, b) => a.line - b.line)
      .flatMap((i) => ("error" in i.checked ? [`Row ${i.line}: ${i.checked.error}`] : []))
      .slice(0, 10);
    start(async () => {
      const total: Result = {
        imported: 0, skipped: preview.invalid, credits: preview.credits, charges: preview.charges, unmatchedCards: 0, duplicates: 0, errors: clientErrors,
        rewards: 0, rewardAmount: 0, rewardDuplicates: 0, rewardsWithoutCard: 0,
      };
      for (let i = 0; i < rows.length; i += CHUNK) {
        setProgress(i / rows.length);
        const res = await importExpenses(rows.slice(i, i + CHUNK), i, lines.slice(i, i + CHUNK));
        if ("error" in res) {
          setError(res.error);
          if (total.imported) setResult(total);
          return;
        }
        total.imported += res.imported;
        total.skipped += res.skipped;
        total.unmatchedCards += res.unmatchedCards;
        total.duplicates += res.duplicates;
        total.errors.push(...res.errors.slice(0, Math.max(0, 10 - total.errors.length)));
      }
      if (rewardRows.length) {
        const res = await importCredits(rewardRows);
        if ("error" in res) {
          setError(res.error);
          setResult(total);
          return;
        }
        total.rewards = res.imported;
        total.rewardAmount = res.amount;
        total.rewardDuplicates = res.duplicates;
        total.rewardsWithoutCard = res.withoutCard;
        total.skipped += res.skipped;
        total.errors.push(...res.errors.slice(0, Math.max(0, 10 - total.errors.length)));
      }
      setProgress(1);
      setResult(total);
      const saved = [total.imported ? plural(total.imported, "expense") : "", total.rewards ? plural(total.rewards, "cashback credit") : ""].filter(Boolean);
      if (saved.length) toast.success(`Imported ${saved.join(" and ")}`);
    });
  }

  function reset() {
    setParsed(null);
    setMapping(null);
    setResult(null);
    setError(null);
    setProgress(0);
  }

  const list = preview ? (filter === "review" ? preview.needs : preview.items) : [];

  return (
    <Modal
      open
      onClose={onClose}
      title="Import expenses"
      description="Upload your bank's statement CSV as-is. We'll detect the columns and categorise every transaction."
      className="sm:max-w-3xl"
    >
      {result ? (
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-good/25 bg-good/10 text-good">
            <CheckCircle2 className="size-6" />
          </div>
          <p className="font-display text-4xl">{result.imported.toLocaleString("en-IN")} imported</p>
          {result.rewards > 0 && (
            <p className="mt-3 inline-flex flex-wrap items-center justify-center gap-x-1.5 rounded-2xl border border-good/25 bg-good/10 px-3 py-1.5 text-xs text-good">
              <Coins className="size-3.5" />
              <span className="num font-semibold">{inr(result.rewardAmount, { decimals: result.rewardAmount % 1 ? 2 : 0 })}</span>
              cashback from {plural(result.rewards, "credit")} saved to Rewards received
            </p>
          )}
          <p className="mt-2 max-w-md text-sm text-muted">
            {[
              result.credits ? `${plural(result.credits, "payment/refund")} skipped` : "",
              result.charges ? `${plural(result.charges, "card charge")} skipped` : "",
              result.duplicates ? `${plural(result.duplicates, "already-imported row")} skipped` : "",
              result.rewardDuplicates ? `${plural(result.rewardDuplicates, "cashback credit")} already saved` : "",
              result.rewardsWithoutCard ? `${plural(result.rewardsWithoutCard, "cashback credit")} saved without a card` : "",
              result.skipped ? `${plural(result.skipped, "invalid row")} skipped` : "",
              result.unmatchedCards ? `${result.unmatchedCards} with an unrecognised card (saved without a card)` : "",
            ].filter(Boolean).join(" · ") || "No rows skipped"}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-5 w-full max-w-md rounded-2xl border border-line bg-surface-2/60 p-4 text-left text-xs text-muted">
              {result.errors.map((e) => <li key={e} className="py-0.5">{e}</li>)}
            </ul>
          )}
          {error && <p className="mt-4 text-xs text-bad">{error}</p>}
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" onClick={reset}>Import another file</Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : !parsed || !mapping || !preview ? (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              readFile(e.dataTransfer.files[0]);
            }}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-12 text-center transition-colors",
              drag ? "border-accent bg-accent/[0.06]" : "border-line-strong hover:border-accent/50 hover:bg-white/[0.02]",
            )}
          >
            <div className={cn("mb-4 grid size-14 place-items-center rounded-2xl border bg-surface-2 transition-colors", drag ? "border-accent/50 text-accent" : "border-line text-muted")}>
              <UploadCloud className="size-6" />
            </div>
            <p className="font-medium">Drop your statement CSV here</p>
            <p className="mt-1 text-sm text-muted">or click to browse · up to {IMPORT_MAX_ROWS.toLocaleString("en-IN")} rows</p>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
          </div>
          {error && <p className="mt-3 rounded-xl border border-bad/25 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">{error}</p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/50 p-4">
              <div className="text-xs text-muted">
                <p className="flex items-center gap-1.5 font-medium text-ink"><Wand2 className="size-3.5 text-accent" /> Raw bank statement</p>
                <p className="mt-1">
                  Narration/description, Dr/Cr or debit/credit columns, any common date format. We skip payments and refunds, save
                  cashback credits as rewards received and categorise each merchant for you.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={downloadSampleStatement} className="mt-auto self-start">
                <Download className="size-3.5" /> Download sample bank statement
              </Button>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/50 p-4">
              <div className="text-xs text-muted">
                <p className="font-medium text-ink">Swipewise template</p>
                <p className="mt-1 font-mono text-[11px]">date, amount, category, merchant, channel, card, note</p>
                <p className="mt-1">Card = last 4 digits or nickname. Missing categories are filled in automatically.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={downloadTemplate} className="mt-auto self-start">
                <Download className="size-3.5" /> Download template
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {/* File summary */}
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-good/10 text-good">
              <FileSpreadsheet className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{parsed.fileName}</p>
              <p className="text-xs text-muted">
                {plural(parsed.rows.length, "row")}
                {preview.anyAuto ? (
                  <>
                    {" · "}<span className="text-good">{preview.autoDone.toLocaleString("en-IN")} auto-categorised</span>
                    {preview.needs.length > 0 && <span className="text-warn"> · {preview.needs.length.toLocaleString("en-IN")} need a look</span>}
                  </>
                ) : (
                  <>{" · "}<span className="text-good">{preview.valid.length.toLocaleString("en-IN")} ready</span></>
                )}
              </p>
              {preview.validRewards.length > 0 && (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-good">
                  <Coins className="size-3 shrink-0" />
                  <span>
                    {plural(preview.validRewards.length, "cashback credit")} (<span className="num">{inr(preview.rewardTotal, { decimals: preview.rewardTotal % 1 ? 2 : 0 })}</span>) will be saved
                  </span>
                </p>
              )}
              {(preview.credits > 0 || preview.charges > 0 || preview.invalid > 0) && (
                <p className="mt-0.5 text-[11px] text-faint">
                  Skipping {[
                    preview.credits ? plural(preview.credits, "payment/refund") : "",
                    preview.charges ? plural(preview.charges, "card charge") : "",
                    preview.invalid ? plural(preview.invalid, "invalid row") : "",
                  ].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>Change</Button>
          </div>

          {/* Card + columns */}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">These transactions are from</span>
              <Select value={cardId} onChange={(e) => setCardId(e.target.value)} className="h-9 text-xs">
                <option value="">{mapping.card ? `Card column in file (“${mapping.card}”)` : "No card / decide later"}</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {cardTitle(c)}{c.last4 ? ` ·· ${c.last4}` : ""}
                  </option>
                ))}
              </Select>
            </label>
            <Button variant="outline" size="sm" onClick={() => setShowColumns((s) => !s)} aria-expanded={showColumns} className="h-9 justify-between">
              Columns
              <span className="text-faint">{STATEMENT_FIELDS.filter((f) => mapping[f]).length} matched</span>
              <ChevronDown className={cn("size-3.5 transition-transform", showColumns && "rotate-180")} />
            </Button>
          </div>

          {showColumns && (
            <div className="rounded-2xl border border-line bg-surface-2/40 p-3">
              <p className="mb-2 text-[11px] text-faint">Pick which column holds each field. Date and an amount (or debit/credit) are required.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STATEMENT_FIELDS.map((f) => {
                  const required = (f === "date" && missingDate) || ((f === "amount" || f === "debit") && missingAmount);
                  return (
                    <label key={f} className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-center gap-1 text-[11px] text-faint">
                        {FIELD_LABEL[f]}
                        {(f === "date" || f === "amount") && <span className="text-accent">*</span>}
                      </span>
                      <Select
                        value={mapping[f] ?? ""}
                        onChange={(e) => setMapping({ ...mapping, [f]: e.target.value || null })}
                        className={cn("h-9 text-xs", mapping[f] ? "border-accent/30" : required ? "border-bad/40" : "")}
                      >
                        <option value="">Not in file</option>
                        {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </Select>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cashback credits found in the file */}
          {preview.validRewards.length > 0 && (
            <div className="rounded-2xl border border-good/20 bg-good/[0.04] p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
                <Coins className="size-3.5 text-good" /> Cashback credits
              </p>
              <p className="mt-0.5 text-[11px] text-faint">Saved to Rewards received and checked against what your spend should have earned.</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {preview.validRewards.slice(0, 5).map((i) => {
                  const r = i.checked.row;
                  const card = r.userCardId ? cardById.get(r.userCardId) : null;
                  return (
                    <li key={i.index} className="flex items-center gap-2 text-[11px]">
                      <span className="num w-12 shrink-0 text-faint">{fmtDate(r.date, { day: "numeric", month: "short" })}</span>
                      <span className="min-w-0 flex-1 truncate text-muted">
                        {i.descriptor}
                        {card ? ` · ${cardTitle(card)}` : <span className="text-warn"> · no card</span>}
                      </span>
                      <span className="num shrink-0 font-medium text-good">+{inr(r.amount, { decimals: r.amount % 1 ? 2 : 0 })}</span>
                    </li>
                  );
                })}
                {preview.validRewards.length > 5 && <li className="text-[11px] text-faint">and {preview.validRewards.length - 5} more</li>}
              </ul>
            </div>
          )}

          {/* Rows */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex gap-1 rounded-xl border border-line bg-surface-2 p-0.5 text-xs" role="tablist" aria-label="Filter rows">
                {([
                  ["all", `All ${preview.items.length.toLocaleString("en-IN")}`],
                  ["review", `Needs a look ${preview.needs.length.toLocaleString("en-IN")}`],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={filter === k}
                    onClick={() => {
                      setFilter(k);
                      setShown(PAGE);
                    }}
                    className={cn(
                      "h-7 rounded-lg px-2.5 font-medium transition-colors",
                      filter === k ? "bg-surface-3 text-ink ring-1 ring-line-strong" : "text-muted hover:text-ink",
                      k === "review" && preview.needs.length > 0 && filter !== k && "text-warn",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="hidden items-center gap-3 text-[11px] text-faint sm:flex">
                {(["high", "medium", "low"] as const).map((c) => (
                  <span key={c} className="flex items-center gap-1"><span className={cn("size-1.5 rounded-full", CONFIDENCE[c].dot)} />{c}</span>
                ))}
              </span>
            </div>

            {lastEdit && (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-accent/25 bg-accent/[0.06] px-3 py-2 text-xs" role="status">
                <Sparkles className="size-3.5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 text-muted">
                  Changed <span className="font-medium text-ink">{lastEdit.name}</span> to {categoryLabel(lastEdit.category)}.
                </span>
                <Button size="sm" onClick={applyToSimilar} className="h-7">Apply to all {lastEdit.count} similar</Button>
                <button onClick={() => setLastEdit(null)} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-ink" aria-label="Dismiss">
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {list.length === 0 && (
                <li className="px-3 py-8 text-center text-xs text-muted">
                  {filter === "review" ? "Nothing left to check. Every row has a category." : "No purchases found in this file."}
                </li>
              )}
              {list.slice(0, shown).map((item) => {
                const c = item.checked;
                if ("error" in c) {
                  return (
                    <li key={item.index} className="flex items-start gap-2 bg-bad/[0.04] px-3 py-2.5 text-xs text-bad">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span className="min-w-0">Row {item.line} will be skipped: {c.error}</span>
                    </li>
                  );
                }
                const r = c.row;
                const card = !cardId && r.userCardId ? cardById.get(r.userCardId) : null;
                const showDesc = item.descriptor && item.descriptor.toLowerCase() !== (r.merchant ?? "").toLowerCase();
                return (
                  <li key={item.index} className="flex items-center gap-3 px-3 py-2.5">
                    <CategoryIcon category={r.category} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
                        <span className="truncate">{r.merchant || categoryLabel(r.category)}</span>
                        {item.edited ? (
                          <span className="shrink-0 rounded-full border border-line px-1.5 text-[10px] font-medium text-muted">edited</span>
                        ) : item.auto ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-1.5 text-[10px] font-medium text-accent"
                            title={`Auto-categorised · ${CONFIDENCE[item.auto.confidence].label} · from ${MATCHED_BY[item.auto.matchedBy]}`}
                          >
                            <span className={cn("size-1.5 rounded-full", CONFIDENCE[item.auto.confidence].dot)} />
                            auto
                          </span>
                        ) : null}
                        {r.channel === "international" && <Badge tone="info" className="shrink-0 px-1.5 py-0 text-[10px]">intl</Badge>}
                      </p>
                      <p className="truncate text-[11px] text-faint">
                        <span className="num">{fmtDate(r.date, { day: "numeric", month: "short" })}</span>
                        {showDesc ? ` · ${item.descriptor}` : ""}
                        {card ? ` · ${cardTitle(card)}` : ""}
                        {r.cardUnmatched && <span className="text-warn"> · card not matched</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="num text-[13px] font-medium">{inr(r.amount, { decimals: r.amount % 1 ? 2 : 0 })}</span>
                      <span className="relative">
                        <Select
                          aria-label={`Category for ${r.merchant || item.descriptor || `row ${item.line}`}`}
                          value={r.category}
                          onChange={(e) => setCategory(item, e.target.value)}
                          className={cn(
                            "h-7 w-[118px] rounded-lg bg-none py-0 pl-2 pr-6 text-[11px] sm:w-[140px]",
                            r.category === "other" && "border-warn/40 text-warn",
                          )}
                        >
                          {CATEGORIES.map((cat) => <option key={cat.key} value={cat.key}>{cat.label}</option>)}
                        </Select>
                        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-faint" />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {list.length > shown && (
              <button onClick={() => setShown((s) => s + PAGE * 2)} className="mt-2 w-full rounded-xl py-2 text-xs font-medium text-muted hover:bg-white/5 hover:text-ink">
                Show more ({(list.length - shown).toLocaleString("en-IN")} left)
              </button>
            )}
          </div>

          {missing.length > 0 && (
            <p className="text-xs text-warn">Map the {missing.join(" and ")} column{missing.length > 1 ? "s" : ""} to continue.</p>
          )}
          {error && <p className="rounded-xl border border-bad/25 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={runImport} disabled={pending || missing.length > 0 || (preview.valid.length === 0 && preview.validRewards.length === 0)}>
              {pending
                ? `Importing… ${Math.round(progress * 100)}%`
                : `Import ${[
                    preview.valid.length || !preview.validRewards.length ? plural(preview.valid.length, "expense") : "",
                    preview.validRewards.length ? plural(preview.validRewards.length, "cashback credit") : "",
                  ].filter(Boolean).join(" + ")}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
