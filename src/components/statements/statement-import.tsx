"use client";

import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, Coins, Copy, FileText, KeyRound, Loader2, Lock, Minus, ShieldCheck, UploadCloud, X,
} from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CardFace } from "@/components/card-face";
import { CategoryIcon } from "@/components/category-icon";
import { Modal } from "@/components/modal";
import { Badge, Button, LinkButton, Select, buttonClass } from "@/components/ui";
import { CATEGORIES, CATEGORY_MAP, categoryLabel } from "@/data/categories";
import { importStatements, type StatementImportResult } from "@/lib/actions/statements";
import { cardTitle, cn, fmtDate, inr } from "@/lib/format";
import {
  GENERIC_PASSWORD_HINTS, PASSWORD_HINTS, anonymiseLines, buildLines, issuerFromFileName, parseStatement, resolveWalletCard,
  type ClassifiedTxn, type IssuerDef, type StatementParse, type WalletCardRef,
} from "@/lib/statement-parser";
import type { RawImportRow } from "@/app/app/expenses/import-utils";
import { readPdf } from "./pdf-text";

/** A catalog card the user can pick (public + their own custom cards). */
export interface StatementProduct {
  id: string;
  bank: string;
  name: string;
  network: string;
  colorFrom: string;
  colorTo: string;
}

/** A card already in the user's wallet. */
export interface StatementWalletCard extends StatementProduct {
  productId: string;
  last4: string | null;
  nickname: string | null;
}

const MAX_FILES = 50;
const MAX_ROWS = 10_000;
const ROWS_PAGE = 30;

type Status = "reading" | "locked" | "ready" | "failed";

interface FileEntry {
  id: string;
  file: File;
  name: string;
  size: number;
  /** Bank guessed from the file name (only used to group locked files and show password hints). */
  guess: IssuerDef | null;
  status: Status;
  wrongPassword?: boolean;
  error?: string;
  parse?: StatementParse;
  /** Anonymised line layout, for support when a statement doesn't parse. */
  layout?: string;
}

type Result = Extract<StatementImportResult, { ok: true }> & { statements: number; payments: number; refunds: number; charges: number };

const plural = (n: number, word: string, many = `${word}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? word : many}`;
const money = (n: number) => inr(n, { decimals: n % 1 ? 2 : 0 });
let seq = 0;

function periodLabel(p: StatementParse["period"]) {
  if (!p.to && !p.from) return null;
  const end = p.to ?? p.from!;
  if (!p.from || p.from === end) return `Statement ${fmtDate(end, { day: "numeric", month: "short", year: "numeric" })}`;
  return `${fmtDate(p.from, { day: "numeric", month: "short" })} – ${fmtDate(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

/** Group locked files by the bank in their file name, so one password can unlock all of them. */
const groupOf = (f: FileEntry) => f.guess?.key ?? "other";

export function StatementImportModal({
  catalog,
  cards,
  onClose,
}: {
  catalog: StatementProduct[];
  cards: StatementWalletCard[];
  onClose: () => void;
}) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [step, setStep] = useState<"files" | "review">("files");
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [perFile, setPerFile] = useState<Record<string, boolean>>({});
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [rowCats, setRowCats] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const productById = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const catalogEntries = useMemo(() => catalog.map((p) => ({ id: p.id, bank: p.bank, name: p.name })), [catalog]);
  const banks = useMemo(() => [...new Set(catalog.map((p) => p.bank))].sort(), [catalog]);

  const patch = (id: string, change: Partial<FileEntry>) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...change } : f)));

  /** Default card for a parsed statement: the wallet card with these digits, the best catalog match, or the only card from that bank. */
  function defaultChoice(p: StatementParse): string {
    const bank = p.issuer?.bank;
    const byDigits = p.last4 ? cards.find((c) => c.last4 === p.last4 && (!bank || c.bank === bank)) : undefined;
    if (byDigits) return `w:${byDigits.id}`;
    if (p.matches[0]) return `p:${p.matches[0].id}`;
    const sameBank = bank ? cards.filter((c) => c.bank === bank) : [];
    if (sameBank.length === 1) return `w:${sameBank[0].id}`;
    return "";
  }

  /** Reads one file. Returns true when it opened (so a password can be tried on other files). */
  async function process(entry: FileEntry, password?: string): Promise<"ok" | "locked" | "wrong" | "failed"> {
    patch(entry.id, { status: "reading", error: undefined });
    try {
      const res = await readPdf(entry.file, password);
      if (!res.ok) {
        if (res.reason === "password" || res.reason === "wrong-password") {
          patch(entry.id, { status: "locked", wrongPassword: !!password });
          return password ? "wrong" : "locked";
        }
        patch(entry.id, { status: "failed", error: res.message ?? "Couldn't read this file." });
        return "failed";
      }
      const lines = buildLines(res.pages);
      const parse = parseStatement(lines, catalogEntries);
      const layout = anonymiseLines(lines);
      const label = `${parse.issuer?.bank ?? "Unknown bank"} · ${parse.txns.length} rows · check ${parse.check.status}`;
      // Anonymised (no names, merchants or numbers): safe to share when a layout needs a parser fix.
      console.groupCollapsed(`Swipewise statement layout (anonymised): ${label}`);
      console.info(layout);
      console.groupEnd();
      if (!parse.txns.length) {
        patch(entry.id, { status: "failed", error: "No transactions found. This layout may need a parser update.", parse, layout, wrongPassword: false });
        return "ok";
      }
      patch(entry.id, { status: "ready", parse, layout, wrongPassword: false });
      setChoice((c) => (entry.id in c ? c : { ...c, [entry.id]: defaultChoice(parse) }));
      return "ok";
    } catch (e) {
      console.warn("Statement could not be read:", e instanceof Error ? e.name : "unknown error");
      patch(entry.id, { status: "failed", error: "Couldn't read this file." });
      return "failed";
    }
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const pdfs = [...list].filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (pdfs.length < list.length) toast.error(`${plural(list.length - pdfs.length, "file")} skipped: only PDF statements are supported here`);
    const fresh = pdfs.filter((f) => !files.some((e) => e.name === f.name && e.size === f.size));
    const room = MAX_FILES - files.length;
    if (fresh.length > room) toast.error(`Add up to ${MAX_FILES} statements at a time`);
    const entries: FileEntry[] = fresh.slice(0, Math.max(0, room)).map((file) => ({
      id: `f${++seq}`, file, name: file.name, size: file.size, guess: issuerFromFileName(file.name), status: "reading",
    }));
    if (!entries.length) return;
    setFiles((fs) => [...fs, ...entries]);
    // One at a time keeps memory low with many large PDFs.
    void (async () => {
      for (const e of entries) await process(e);
    })();
  }

  async function unlock(key: string, targets: FileEntry[]) {
    const password = passwords[key] ?? "";
    if (!password || !targets.length) return;
    setUnlocking(key);
    let opened = 0;
    for (const t of targets) if ((await process(t, password)) === "ok") opened++;
    // Same password often works for the same person's other statements: try it on the rest, quietly.
    if (opened) {
      const others = files.filter((f) => f.status === "locked" && !targets.some((t) => t.id === f.id));
      for (const o of others) {
        const res = await readPdf(o.file, password);
        if (res.ok) {
          opened++;
          await process(o, password);
        }
      }
    }
    setPasswords((p) => ({ ...p, [key]: "" }));
    setUnlocking(null);
    if (opened) toast.success(`Unlocked ${plural(opened, "statement")}`);
    else toast.error("That password didn't open it. Check the format hint below.");
  }

  function remove(id: string) {
    setFiles((fs) => fs.filter((f) => f.id !== id));
  }

  const locked = files.filter((f) => f.status === "locked");
  const lockedGroups = (() => {
    const m = new Map<string, FileEntry[]>();
    for (const f of locked) m.set(groupOf(f), [...(m.get(groupOf(f)) ?? []), f]);
    return [...m];
  })();
  const reading = files.some((f) => f.status === "reading");
  const ready = useMemo(() => files.filter((f) => f.status === "ready" && f.parse), [files]);

  /* ---------- Review model ---------- */

  const review = useMemo(() => {
    const wallet: WalletCardRef[] = cards.map((c) => ({ id: c.id, productId: c.productId, bank: c.bank, last4: c.last4 }));
    const seen = new Map<string, string>();
    const newCards = new Set<string>();
    const items = ready.map((f) => {
      const p = f.parse!;
      const sum = p.txns.reduce((n, t) => n + t.amount, 0);
      const key = `${p.issuer?.bank}|${p.last4}|${p.period.from}|${p.period.to}|${p.txns.length}|${sum.toFixed(2)}`;
      const duplicateOf = seen.get(key) ?? null;
      if (!duplicateOf) seen.set(key, f.name);
      const include = !excluded[f.id] && !duplicateOf;
      const value = choice[f.id] ?? "";
      let card: StatementProduct | null = null;
      let state: "wallet" | "new" | "none" = "none";
      let repeat = false;
      let walletCard: StatementWalletCard | null = null;
      if (value.startsWith("w:")) {
        walletCard = cardById.get(value.slice(2)) ?? null;
        card = walletCard;
        state = walletCard ? "wallet" : "none";
      } else if (value.startsWith("p:")) {
        const product = productById.get(value.slice(2)) ?? null;
        card = product;
        if (product) {
          const hit = resolveWalletCard(wallet, product, p.last4);
          if (hit) {
            walletCard = cardById.get(hit.card.id) ?? null;
            state = walletCard ? "wallet" : "new";
            if (hit.setLast4) hit.card.last4 = p.last4;
          } else {
            const id = `new:${product.id}:${p.last4 ?? ""}`;
            wallet.push({ id, productId: product.id, bank: product.bank, last4: p.last4 });
            state = "new";
          }
          if (state === "new" && include) {
            const id = hit?.card.id ?? `new:${product.id}:${p.last4 ?? ""}`;
            repeat = newCards.has(id);
            newCards.add(id);
          }
        }
      }
      const expenses = p.txns
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t.kind === "expense" && t.row)
        .map(({ t, i }) => {
          const override = rowCats[`${f.id}:${i}`];
          let row = t.row!;
          if (override) {
            const channel = t.auto?.matchedBy === "none" && row.channel !== "international" ? CATEGORY_MAP[override]?.defaultChannel : row.channel;
            row = { ...row, category: override, channel };
          }
          return { t, i, row, edited: !!override };
        });
      const rewards = p.txns.filter((t) => t.kind === "reward" && t.row);
      return {
        f, p, include, duplicateOf, value, card, state, repeat, walletCard, expenses, rewards,
        rewardTotal: rewards.reduce((n, t) => n + t.amount, 0),
        spend: expenses.reduce((n, e) => n + e.t.amount, 0),
      };
    });
    const included = items.filter((i) => i.include);
    return {
      items,
      included,
      expenses: included.reduce((n, i) => n + i.expenses.length, 0),
      rewards: included.reduce((n, i) => n + i.rewards.length, 0),
      newCards: newCards.size,
      unassigned: included.filter((i) => !i.card).length,
    };
  }, [ready, cards, choice, excluded, rowCats, cardById, productById]);

  function runImport() {
    const statements = review.included.map((i) => ({
      cardId: i.value.startsWith("w:") ? i.value.slice(2) : null,
      cardProductId: i.value.startsWith("p:") ? i.value.slice(2) : null,
      last4: i.p.last4,
      expenses: i.expenses.map((e) => strip(e.row)),
      credits: i.rewards.map((t) => strip(t.row!)),
    }));
    const rows = statements.reduce((n, s) => n + s.expenses.length + s.credits.length, 0);
    if (rows > MAX_ROWS) {
      setError(`That's ${rows.toLocaleString("en-IN")} rows. Import up to ${MAX_ROWS.toLocaleString("en-IN")} at a time.`);
      return;
    }
    setError(null);
    start(async () => {
      const res = await importStatements(statements);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      const skipped = (k: ClassifiedTxn["kind"]) => review.included.reduce((n, i) => n + i.p.counts[k], 0);
      setResult({ ...res, statements: statements.length, payments: skipped("payment"), refunds: skipped("refund"), charges: skipped("charge") });
      const saved = [res.imported ? plural(res.imported, "expense") : "", res.rewards ? plural(res.rewards, "cashback credit") : ""].filter(Boolean);
      toast.success(saved.length ? `Imported ${saved.join(" and ")}` : "Everything was already imported");
    });
  }

  /* ---------- Render ---------- */

  const privacy = (
    <p className="flex items-start gap-1.5 text-[11px] text-good">
      <ShieldCheck className="mt-px size-3.5 shrink-0" />
      <span>Read on your device. Files and passwords are never uploaded. Only the transactions you import are saved.</span>
    </p>
  );

  if (result) {
    return (
      <Modal open onClose={onClose} title="Statements imported" className="sm:max-w-xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-good/25 bg-good/10 text-good">
            <CheckCircle2 className="size-6" />
          </div>
          <p className="font-display text-4xl">
            {result.imported || result.rewards || result.cardsAdded ? plural(result.imported, "expense") : "Already up to date"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {result.imported || result.rewards || result.cardsAdded
              ? `from ${plural(result.statements, "statement")}`
              : `Everything in ${result.statements === 1 ? "this statement" : `these ${result.statements} statements`} was imported before.`}
          </p>
          <div className="mt-5 grid w-full grid-cols-3 gap-2 text-left">
            <Stat label="Cards added" value={result.cardsAdded} hint={result.cardsMatched ? `${result.cardsMatched} already in wallet` : undefined} />
            <Stat label="Cashback credits" value={result.rewards} hint={result.rewardAmount ? money(result.rewardAmount) : undefined} tone="good" />
            <Stat label="Already imported" value={result.duplicates + result.rewardDuplicates} hint="skipped" />
          </div>
          <p className="mt-4 max-w-md text-xs text-faint">
            {[
              result.payments ? `${plural(result.payments, "payment")} skipped` : "",
              result.refunds ? `${plural(result.refunds, "refund/reversal", "refunds/reversals")} skipped` : "",
              result.charges ? `${plural(result.charges, "card charge")} (fees, GST, interest) skipped` : "",
              result.skipped ? `${plural(result.skipped, "invalid row")} skipped` : "",
            ].filter(Boolean).join(" · ")}
          </p>
          {result.cardsAdded > 0 && (
            <p className="mt-3 rounded-xl border border-warn/25 bg-warn/[0.06] px-3 py-2 text-xs text-muted">
              New cards were added with default limits and billing days. Fill those in from My Wallet whenever you like.
            </p>
          )}
          {result.errors.length > 0 && (
            <ul className="mt-4 w-full rounded-2xl border border-line bg-surface-2/60 p-3 text-left text-xs text-muted">
              {result.errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <div className="mt-6 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <LinkButton href="/app/wallet" variant="secondary" onClick={onClose}>Open My Wallet</LinkButton>
            <LinkButton href="/app/expenses" onClick={onClose}>See expenses</LinkButton>
          </div>
        </div>
      </Modal>
    );
  }

  if (step === "review") {
    return (
      <Modal
        open
        onClose={onClose}
        title="Check your statements"
        description="Confirm each card, then import. Tap a statement to see and recategorise its rows."
        className="sm:max-w-3xl"
      >
        <div className="flex flex-col gap-3">
          {review.items.map((it) => (
            <StatementCard
              key={it.f.id}
              item={it}
              open={expanded === it.f.id}
              onToggle={() => setExpanded((e) => (e === it.f.id ? null : it.f.id))}
              onInclude={(on) => setExcluded((x) => ({ ...x, [it.f.id]: !on }))}
              onChoice={(v) => setChoice((c) => ({ ...c, [it.f.id]: v }))}
              onCategory={(i, cat) => setRowCats((r) => ({ ...r, [`${it.f.id}:${i}`]: cat }))}
              catalog={catalog}
              cards={cards}
              banks={banks}
            />
          ))}
        </div>

        {error && <p className="mt-4 rounded-xl border border-bad/25 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">{error}</p>}

        <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 mt-6 border-t border-line bg-surface/90 px-6 py-4 backdrop-blur-md">
          {review.unassigned > 0 && (
            <p className="mb-2 text-xs text-warn">Pick the card for {plural(review.unassigned, "statement")} to continue.</p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={() => setStep("files")} disabled={pending}>
              <ArrowLeft className="size-4" /> Files
            </Button>
            <Button
              onClick={runImport}
              disabled={pending || !review.included.length || review.unassigned > 0 || (!review.expenses && !review.rewards)}
              className="h-auto min-h-10 whitespace-normal py-2 text-center"
            >
              {pending ? (
                <><Loader2 className="size-4 animate-spin" /> Importing…</>
              ) : (
                <>
                  Import {plural(review.expenses, "expense")}
                  {review.rewards ? ` + ${plural(review.rewards, "cashback credit")}` : ""} from {plural(review.included.length, "statement")}
                  {review.newCards ? ` (adds ${plural(review.newCards, "new card")})` : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Import statement PDFs"
      description="Drop all your card statements at once: several banks, several months. We find the card, every purchase and your cashback."
      className="sm:max-w-2xl"
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Add statement PDFs"
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed text-center transition-colors",
          files.length ? "px-4 py-5" : "px-6 py-12",
          drag ? "border-accent bg-accent/[0.06]" : "border-line-strong hover:border-accent/50 hover:bg-white/[0.02]",
        )}
      >
        <div className={cn("mb-3 grid size-12 place-items-center rounded-2xl border bg-surface-2 transition-colors", drag ? "border-accent/50 text-accent" : "border-line text-muted", files.length && "hidden")}>
          <UploadCloud className="size-5" />
        </div>
        <p className="font-medium">{files.length ? "Add more statements" : "Drop your statement PDFs here"}</p>
        <p className="mt-1 text-sm text-muted">or click to choose · up to {MAX_FILES} files, password-protected is fine</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <div className="mt-3">{privacy}</div>

      {files.length > 0 && (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {files.map((f) => (
            <FileRow key={f.id} f={f} productById={productById} cardById={cardById} choice={choice[f.id]} onRemove={() => remove(f.id)} />
          ))}
        </ul>
      )}

      {lockedGroups.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {lockedGroups.map(([key, group]) => {
            const def = group[0].guess;
            const bankName = def?.bank ?? "these";
            const hints = (def && PASSWORD_HINTS[def.key]) || GENERIC_PASSWORD_HINTS;
            const split = perFile[key] && group.length > 1;
            const targets = split ? [] : group;
            return (
              <div key={key} className="rounded-2xl border border-line bg-surface-2/50 p-3.5">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Lock className="size-3.5 text-gold" />
                  {plural(group.length, `${def ? `${def.bank} statement` : "locked statement"}`)} {group.length === 1 ? "needs" : "need"} a password
                </p>
                {split ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {group.map((f) => (
                      <PasswordField
                        key={f.id}
                        label={f.name}
                        value={passwords[f.id] ?? ""}
                        wrong={!!f.wrongPassword}
                        busy={unlocking === f.id}
                        onChange={(v) => setPasswords((p) => ({ ...p, [f.id]: v }))}
                        onSubmit={() => unlock(f.id, [f])}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-3">
                    <PasswordField
                      label={`Password for ${group.length > 1 ? `all ${bankName} statements` : group[0].name}`}
                      value={passwords[key] ?? ""}
                      wrong={group.some((f) => f.wrongPassword)}
                      busy={unlocking === key}
                      onChange={(v) => setPasswords((p) => ({ ...p, [key]: v }))}
                      onSubmit={() => unlock(key, targets)}
                    />
                  </div>
                )}
                {group.length > 1 && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={!perFile[key]}
                      onChange={(e) => setPerFile((p) => ({ ...p, [key]: !e.target.checked }))}
                      className="size-3.5 accent-[#d4ff3a]"
                    />
                    Use for all {def ? `${def.bank} ` : ""}statements
                  </label>
                )}
                <div className="mt-2.5 rounded-xl border border-line bg-surface/60 px-3 py-2 text-[11px] text-faint">
                  <p className="flex items-center gap-1 font-medium text-muted"><KeyRound className="size-3" /> Hint (common format, not verified)</p>
                  <ul className="mt-1 list-disc pl-4">
                    {hints.map((h) => <li key={h}>{h}</li>)}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="mt-3 rounded-xl border border-bad/25 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">{error}</p>}

      <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 mt-6 border-t border-line bg-surface/90 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-xs text-muted">
            {files.length === 0
              ? "PDF statements from any Indian card issuer"
              : reading
                ? "Reading…"
                : [
                    ready.length ? `${ready.length} ready` : "",
                    locked.length ? `${locked.length} locked` : "",
                    files.length - ready.length - locked.length ? `${files.length - ready.length - locked.length} unreadable` : "",
                  ].filter(Boolean).join(" · ")}
          </p>
          <Button onClick={() => setStep("review")} disabled={!ready.length || reading} className="shrink-0">
            {ready.length ? `Review ${plural(ready.length, "statement")}` : "Add statements"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function strip(row: RawImportRow): RawImportRow {
  const { card, ...rest } = row;
  void card;
  return rest;
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "good" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface-2/60 p-2.5 sm:p-3">
      <p className="text-[11px] leading-tight text-faint">{label}</p>
      <p className={cn("num mt-1 text-xl font-semibold", tone === "good" && value ? "text-good" : "text-ink")}>{value.toLocaleString("en-IN")}</p>
      {hint && <p className="mt-0.5 text-[11px] leading-tight text-muted">{hint}</p>}
    </div>
  );
}

function PasswordField({
  label, value, wrong, busy, onChange, onSubmit,
}: {
  label: string;
  value: string;
  wrong: boolean;
  busy: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-1.5"
    >
      <span className="truncate text-xs text-muted">{label}</span>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          aria-invalid={wrong}
          className={cn(
            "h-10 min-w-0 flex-1 rounded-xl border bg-surface-2 px-3 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/15",
            wrong ? "border-bad/50" : "border-line focus:border-accent/60",
          )}
          placeholder="Statement password"
        />
        <Button type="submit" disabled={!value || busy} className="shrink-0">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Unlock"}
        </Button>
      </div>
      {wrong && <span className="text-[11px] text-bad">Wrong password. Try the format in the hint.</span>}
    </form>
  );
}

function FileRow({
  f, productById, cardById, choice, onRemove,
}: {
  f: FileEntry;
  productById: Map<string, StatementProduct>;
  cardById: Map<string, StatementWalletCard>;
  choice: string | undefined;
  onRemove: () => void;
}) {
  const p = f.parse;
  const card = choice?.startsWith("w:") ? cardById.get(choice.slice(2)) : choice?.startsWith("p:") ? productById.get(choice.slice(2)) : undefined;
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      {f.status === "ready" && card ? (
        <CardFace {...card} size="xs" className="w-10 self-center rounded-[5px]" />
      ) : (
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            f.status === "failed" ? "bg-bad/10 text-bad" : f.status === "locked" ? "bg-gold/10 text-gold" : f.status === "ready" ? "bg-good/10 text-good" : "bg-white/5 text-muted",
          )}
        >
          {f.status === "reading" ? <Loader2 className="size-4 animate-spin" /> : f.status === "locked" ? <Lock className="size-4" /> : f.status === "failed" ? <AlertTriangle className="size-4" /> : <FileText className="size-4" />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{f.name}</p>
        <p className={cn("truncate text-[11px]", f.status === "failed" ? "text-bad" : "text-faint")}>
          {f.status === "reading" && "Reading on your device…"}
          {f.status === "locked" && (f.wrongPassword ? "Wrong password" : "Locked · needs password")}
          {f.status === "failed" && (f.error ?? "Couldn't read this file")}
          {f.status === "ready" && p && (
            <>
              {p.issuer?.bank ?? "Bank not recognised"}
              {p.last4 ? ` ·· ${p.last4}` : ""} · {plural(p.counts.expense, "purchase")}
              {p.counts.reward ? ` · ${plural(p.counts.reward, "cashback credit")}` : ""}
            </>
          )}
        </p>
      </div>
      {f.status === "failed" && f.layout && <CopyLayout layout={f.layout} />}
      <button type="button" onClick={onRemove} className="grid size-8 shrink-0 place-items-center rounded-lg text-faint hover:bg-white/5 hover:text-ink" aria-label={`Remove ${f.name}`}>
        <X className="size-4" />
      </button>
    </li>
  );
}

function CopyLayout({ layout }: { layout: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(layout);
          toast.success("Anonymised layout copied", { description: "No names, merchants or amounts. Send it to us to get this statement supported." });
        } catch {
          toast.error("Couldn't copy. It's also in the browser console.");
        }
      }}
      className="hidden shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted hover:bg-white/5 hover:text-ink sm:inline-flex"
      title="Copy the statement's line layout with every name, merchant and number masked"
    >
      <Copy className="size-3" /> Copy layout
    </button>
  );
}

type ReviewItem = {
  f: FileEntry;
  p: StatementParse;
  include: boolean;
  duplicateOf: string | null;
  value: string;
  card: StatementProduct | null;
  state: "wallet" | "new" | "none";
  /** Another statement above already adds this new card. */
  repeat: boolean;
  walletCard: StatementWalletCard | null;
  expenses: { t: ClassifiedTxn; i: number; row: RawImportRow; edited: boolean }[];
  rewards: ClassifiedTxn[];
  rewardTotal: number;
  spend: number;
};

function StatementCard({
  item, open, onToggle, onInclude, onChoice, onCategory, catalog, cards, banks,
}: {
  item: ReviewItem;
  open: boolean;
  onToggle: () => void;
  onInclude: (on: boolean) => void;
  onChoice: (v: string) => void;
  onCategory: (index: number, category: string) => void;
  catalog: StatementProduct[];
  cards: StatementWalletCard[];
  banks: string[];
}) {
  const { p, f } = item;
  const [shown, setShown] = useState(ROWS_PAGE);
  const bank = p.issuer?.bank ?? null;
  const top = p.matches[0];
  const chosenProduct = item.value.startsWith("p:") ? item.value.slice(2) : null;
  const skippedText = [
    p.counts.payment ? `${plural(p.counts.payment, "payment")} skipped` : "",
    p.counts.refund ? `${plural(p.counts.refund, "refund")} skipped` : "",
    p.counts.charge ? `${plural(p.counts.charge, "fee/charge", "fees/charges")} skipped` : "",
  ].filter(Boolean);
  const sortedBanks = bank ? [bank, ...banks.filter((b) => b !== bank)] : banks;
  const period = periodLabel(p.period);

  return (
    <div className={cn("rounded-2xl border bg-surface-2/40 transition-colors", item.include ? "border-line" : "border-line opacity-60")}>
      <div className="flex gap-3 p-3 sm:p-4">
        {item.card ? (
          <CardFace {...item.card} last4={p.last4} size="xs" className="mt-0.5 self-start" />
        ) : (
          <div className="mt-0.5 grid aspect-[1.586] w-14 shrink-0 place-items-center self-start rounded-md border border-dashed border-line-strong text-faint">?</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 truncate text-sm font-medium">{item.card ? cardTitle(item.walletCard ?? item.card) : bank ? `${bank} card` : "Pick your card"}</p>
            {item.state === "new" && (item.repeat ? <Badge tone="neutral">Added above</Badge> : <Badge tone="accent">New card</Badge>)}
            {item.state === "wallet" && <Badge tone="neutral">In wallet</Badge>}
            {chosenProduct && top && chosenProduct === top.id && item.state !== "wallet" && (
              <Badge tone={top.confidence === "high" ? "good" : top.confidence === "medium" ? "warn" : "neutral"}>{top.confidence} match</Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-faint">
            {p.last4 ? <span className="num">•••• {p.last4}</span> : "Card digits not found"}
            {period ? ` · ${period}` : ""}
            {p.summary.totalDue != null ? <> · due <span className="num">{money(p.summary.totalDue)}</span></> : null}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            <span className="text-ink">{plural(item.expenses.length, "purchase")}</span>
            {item.spend ? <> (<span className="num">{money(item.spend)}</span>)</> : null}
            {item.rewards.length > 0 && (
              <> · <span className="text-good">{plural(item.rewards.length, "cashback credit")} (<span className="num">{money(item.rewardTotal)}</span>)</span></>
            )}
            {skippedText.length > 0 && <span className="text-faint"> · {skippedText.join(" · ")}</span>}
          </p>
          {p.check.status === "match" && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-good">
              <CheckCircle2 className="size-3 shrink-0" /> Matches the statement&apos;s {p.check.label} total
            </p>
          )}
          {p.check.status === "mismatch" && (
            <p className="mt-1.5 flex items-start gap-1 text-[11px] text-warn">
              <AlertTriangle className="mt-px size-3 shrink-0" />
              <span>
                Parsed {p.check.label} <span className="num">{money(p.check.parsed)}</span> vs statement <span className="num">{money(p.check.expected ?? 0)}</span>. Some rows may be missing; check before importing.
              </span>
            </p>
          )}
          {item.duplicateOf && <p className="mt-1.5 text-[11px] text-warn">Same statement as {item.duplicateOf}; skipped.</p>}
        </div>
        {!item.duplicateOf && (
          <label className="flex h-fit shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted" title="Include this statement">
            <input type="checkbox" checked={item.include} onChange={(e) => onInclude(e.target.checked)} className="size-4 accent-[#d4ff3a]" />
            <span className="hidden sm:inline">Import</span>
          </label>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-line px-3 py-2.5 sm:flex-row sm:items-center sm:px-4">
        <span className="relative min-w-0 flex-1">
          <Select value={item.value} onChange={(e) => onChoice(e.target.value)} className={cn("h-9 text-xs", !item.card && "border-warn/50")} aria-label={`Card for ${f.name}`}>
            <option value="">Pick the card for this statement…</option>
            {cards.length > 0 && (
              <optgroup label="In your wallet">
                {cards.map((c) => (
                  <option key={c.id} value={`w:${c.id}`}>{cardTitle(c)}{c.last4 ? ` ·· ${c.last4}` : ""}</option>
                ))}
              </optgroup>
            )}
            {p.matches.length > 0 && (
              <optgroup label="Best matches">
                {p.matches.slice(0, 4).map((m) => {
                  const prod = catalog.find((c) => c.id === m.id);
                  return prod ? <option key={`m-${m.id}`} value={`p:${m.id}`}>{prod.bank} {prod.name}</option> : null;
                })}
              </optgroup>
            )}
            {sortedBanks.map((b) => (
              <optgroup key={b} label={b}>
                {catalog.filter((c) => c.bank === b && !p.matches.slice(0, 4).some((m) => m.id === c.id)).map((c) => (
                  <option key={c.id} value={`p:${c.id}`}>{c.bank} {c.name}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </span>
        <button type="button" onClick={onToggle} aria-expanded={open} className={buttonClass("outline", "sm", "h-9 shrink-0 justify-between")}>
          {open ? "Hide rows" : `Show ${plural(p.txns.length, "row")}`}
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="border-t border-line px-2 pb-2 pt-1 sm:px-3">
          <ul className="divide-y divide-line">
            {item.expenses.slice(0, shown).map(({ t, i, row, edited }) => (
              <li key={i} className="flex items-center gap-2.5 px-1 py-2">
                <CategoryIcon category={row.category ?? "other"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
                    <span className="truncate">{row.merchant || categoryLabel(row.category ?? "other")}</span>
                    {edited && <span className="shrink-0 rounded-full border border-line px-1.5 text-[10px] text-muted">edited</span>}
                    {row.channel === "international" && <Badge tone="info" className="shrink-0 px-1.5 py-0 text-[10px]">intl</Badge>}
                  </p>
                  <p className="truncate text-[11px] text-faint">
                    <span className="num">{fmtDate(t.date, { day: "numeric", month: "short" })}</span> · {t.description}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="num text-[13px] font-medium">{money(t.amount)}</span>
                  <span className="relative">
                    <Select
                      aria-label={`Category for ${row.merchant || t.description}`}
                      value={row.category}
                      onChange={(e) => onCategory(i, e.target.value)}
                      className={cn("h-7 w-[112px] rounded-lg bg-none py-0 pl-2 pr-6 text-[11px] sm:w-[140px]", row.category === "other" && "border-warn/40 text-warn")}
                    >
                      {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </Select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-faint" />
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {item.expenses.length > shown && (
            <button type="button" onClick={() => setShown((s) => s + ROWS_PAGE * 2)} className="mt-1 w-full rounded-xl py-2 text-xs font-medium text-muted hover:bg-white/5 hover:text-ink">
              Show more ({item.expenses.length - shown} left)
            </button>
          )}
          {p.txns.some((t) => t.kind !== "expense") && (
            <ul className="mt-2 flex flex-col gap-1 rounded-xl bg-surface/60 p-2.5">
              {p.txns.filter((t) => t.kind !== "expense").map((t, k) => (
                <li key={k} className="flex items-center gap-2 text-[11px]">
                  {t.kind === "reward" ? <Coins className="size-3 shrink-0 text-good" /> : <Minus className="size-3 shrink-0 text-faint" />}
                  <span className="num w-12 shrink-0 text-faint">{fmtDate(t.date, { day: "numeric", month: "short" })}</span>
                  <span className={cn("min-w-0 flex-1 truncate", t.kind === "reward" ? "text-muted" : "text-faint")}>{t.description}</span>
                  <span className="shrink-0 text-faint">{t.kind === "reward" ? "cashback" : t.kind === "charge" ? "fee · skipped" : `${t.kind} · skipped`}</span>
                  <span className={cn("num shrink-0", t.kind === "reward" ? "text-good" : "text-faint")}>{t.credit ? "+" : ""}{money(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {f.layout && (
            <div className="mt-2 flex justify-end">
              <CopyLayout layout={f.layout} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Button that opens the statement import (for server-rendered pages such as the dashboard). */
export function StatementImportButton({
  catalog,
  cards,
  children,
  variant = "secondary",
  size = "md",
  className,
}: {
  catalog: StatementProduct[];
  cards: StatementWalletCard[];
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        {children}
      </Button>
      {open && <StatementImportModal key={key} catalog={catalog} cards={cards} onClose={() => setOpen(false)} />}
    </>
  );
}
