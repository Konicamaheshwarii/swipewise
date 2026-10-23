"use client";

import { Ban, CalendarClock, Globe, Laptop, QrCode, Receipt, Search, Store, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { Panel } from "@/components/ui";
import { CATEGORIES, CATEGORY_MAP, MERCHANTS, categoryLabel, type MerchantDef } from "@/data/categories";
import { rankCards, type Channel, type EngineCard, type Txn } from "@/engine";
import { cn } from "@/lib/format";
import type { CardView } from "@/lib/wallet";
import { AdvisorResults } from "./results";
import { CatalogSuggestions, isRupay, type CatalogOption } from "./suggestions";

const QUICK_AMOUNTS = [500, 2000, 10000, 50000];
const POPULAR = ["Swiggy", "Amazon", "Zomato", "Flipkart", "BigBasket", "Uber"];
const CHANNELS: { key: Channel; label: string; icon: typeof Globe }[] = [
  { key: "online", label: "Online", icon: Laptop },
  { key: "offline", label: "In-store", icon: Store },
  { key: "international", label: "International", icon: Globe },
];

export function Advisor({
  cards,
  views,
  caps,
  now,
  catalog,
}: {
  cards: EngineCard[];
  views: CardView[];
  /** Catalog cards not in the wallet, for "cards that would earn here". */
  catalog: CatalogOption[];
  /** Serialised CapState entries. */
  caps: [string, number][];
  /** ISO timestamp from the server so cap periods match on both sides. */
  now: string;
}) {
  const [raw, setRaw] = useState("2000");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("shopping");
  const [channel, setChannel] = useState<Channel>("online");
  // UPI only works with RuPay credit cards.
  const [upi, setUpi] = useState(false);

  const amount = Number(raw) || 0;
  const capMap = useMemo(() => new Map(caps), [caps]);
  const txn = useMemo<Txn>(
    () => ({ amount, date: now, category, merchant: merchant.trim() || null, channel }),
    [amount, now, category, merchant, channel],
  );
  const rupayIds = useMemo(() => new Set(views.filter((v) => isRupay(v.network)).map((v) => v.id)), [views]);
  const usable = useMemo(() => (upi ? cards.filter((c) => rupayIds.has(c.id)) : cards), [cards, upi, rupayIds]);
  const results = useMemo(() => rankCards(usable, txn, capMap), [usable, txn, capMap]);
  const bestWalletNet = Math.max(0, results[0]?.net ?? 0);
  const notOnUpi = upi ? views.filter((v) => !rupayIds.has(v.id)) : [];

  const toggleUpi = () => {
    setUpi((u) => !u);
    if (!upi && channel === "international") setChannel("offline");
  };

  const pickMerchant = (m: MerchantDef) => {
    setMerchant(m.name);
    setCategory(m.category);
    setChannel(m.channel);
  };

  const typeMerchant = (value: string) => {
    setMerchant(value);
    const known = MERCHANTS.find((m) => m.name.toLowerCase() === value.trim().toLowerCase());
    if (known) {
      setCategory(known.category);
      setChannel(known.channel);
    }
  };

  const pickCategory = (key: string) => {
    setCategory(key);
    // A known merchant from another category no longer applies.
    const known = MERCHANTS.find((m) => m.name.toLowerCase() === merchant.trim().toLowerCase());
    if (known && known.category !== key) setMerchant("");
    if (channel !== "international") setChannel(CATEGORY_MAP[key]?.defaultChannel ?? "offline");
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
      <div className="min-w-0 lg:col-span-5">
        <Panel className="animate-fade-up p-5 sm:p-6 lg:sticky lg:top-8">
          <AmountInput raw={raw} onChange={setRaw} />
          <div className="mt-6 space-y-6">
            <MerchantSearch value={merchant} onType={typeMerchant} onPick={pickMerchant} />
            <div>
              <Label>Category</Label>
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {CATEGORIES.map((c) => {
                  const active = c.key === category;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => pickCategory(c.key)}
                      aria-pressed={active}
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-medium transition-all",
                        active
                          ? "border-accent/50 bg-accent/10 text-ink shadow-[0_0_0_3px_rgba(212,255,58,0.08)]"
                          : "border-line bg-surface-2 text-muted hover:border-line-strong hover:text-ink",
                      )}
                    >
                      <CategoryIcon category={c.key} size="sm" className="size-6 rounded-full" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Where are you paying?</Label>
              <div className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface-2 p-1" role="radiogroup">
                {CHANNELS.map(({ key, label, icon: Icon }) => {
                  const active = key === channel;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setChannel(key)}
                      disabled={upi && key === "international"}
                      className={cn(
                        "flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-all sm:text-[13px]",
                        active ? "bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-ink",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active && (key === "international" ? "text-info" : "text-accent"))} />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={upi}
                onClick={toggleUpi}
                className={cn(
                  "mt-3 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                  upi ? "border-accent/40 bg-accent/[0.06]" : "border-line bg-surface-2 hover:border-line-strong",
                )}
              >
                <QrCode className={cn("size-5 shrink-0", upi ? "text-accent" : "text-faint")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Paying by UPI</span>
                  <span className="block text-[11px] text-faint">Scan &amp; pay with a RuPay credit card linked to UPI</span>
                </span>
                <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", upi ? "bg-accent" : "bg-white/15")}>
                  <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", upi ? "left-[18px] bg-accent-ink" : "left-0.5")} />
                </span>
              </button>
            </div>
          </div>
        </Panel>
      </div>

      <div className="min-w-0 space-y-6 lg:col-span-7">
        {usable.length ? (
          <AdvisorResults results={results} views={views} amount={amount} categoryName={categoryLabel(category)} />
        ) : (
          <Panel className="flex items-start gap-4 p-6 sm:p-8">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-warn/25 bg-warn/10 text-warn">
              <Ban className="size-5" />
            </span>
            <div>
              <p className="font-display text-3xl leading-tight">No card works on UPI</p>
              <p className="mt-2 max-w-md text-sm text-muted">
                Only RuPay credit cards can be linked to UPI, and none of your cards is RuPay. Pay by card instead, or see RuPay cards below.
              </p>
            </div>
          </Panel>
        )}
        {notOnUpi.length > 0 && usable.length > 0 && (
          <p className="-mt-3 px-1 text-xs text-faint">
            Not usable on UPI (not RuPay): {notOnUpi.map((v) => v.nickname || `${v.bank} ${v.name}`).join(", ")}
          </p>
        )}
        <CatalogSuggestions options={catalog} txn={txn} bestWalletNet={bestWalletNet} upi={upi} />
        <Panel className="grid gap-4 p-5 text-xs text-muted sm:grid-cols-2">
          <Tip icon={<CalendarClock className="size-4" />}>
            Caps reset monthly, quarterly or yearly depending on the card. Your remaining caps are already factored in.
          </Tip>
          <Tip icon={<Receipt className="size-4" />}>
            Cap usage comes from the spend you logged against each card this year. Log expenses to keep it accurate.
          </Tip>
          {upi && (
            <Tip icon={<QrCode className="size-4" />}>
              On UPI, many RuPay cards earn their usual rate, but some earn less or nothing. Check your card&apos;s terms for UPI spends.
            </Tip>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
      {children}
    </label>
  );
}

function Tip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/5 text-faint">{icon}</span>
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

function AmountInput({ raw, onChange }: { raw: string; onChange: (v: string) => void }) {
  const id = useId();
  const display = raw ? Number(raw).toLocaleString("en-IN") : "";
  return (
    <div>
      <Label htmlFor={id}>Amount</Label>
      <div className="flex items-baseline gap-2 border-b border-line pb-3 focus-within:border-accent/50">
        <span className="font-display text-4xl text-faint sm:text-5xl">₹</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={display}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9))}
          className="num w-full min-w-0 bg-transparent font-display text-6xl leading-none tracking-tight text-ink outline-none placeholder:text-faint sm:text-7xl"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onChange(String(a))}
            className={cn(
              "num rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              Number(raw) === a ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted hover:border-line-strong hover:text-ink",
            )}
          >
            ₹{a.toLocaleString("en-IN")}
          </button>
        ))}
      </div>
    </div>
  );
}

function MerchantSearch({
  value,
  onType,
  onPick,
}: {
  value: string;
  onType: (v: string) => void;
  onPick: (m: MerchantDef) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = value.trim().toLowerCase();
  const suggestions = q
    ? MERCHANTS.filter((m) => m.name.toLowerCase().includes(q) && m.name.toLowerCase() !== q)
        .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
        .slice(0, 6)
    : POPULAR.map((n) => MERCHANTS.find((m) => m.name === n)!).filter(Boolean);
  const show = open && suggestions.length > 0;

  const choose = (m: MerchantDef) => {
    onPick(m);
    setOpen(false);
  };

  return (
    <div>
      <Label htmlFor={id}>Merchant <span className="normal-case tracking-normal text-faint/70">(optional)</span></Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          id={id}
          role="combobox"
          aria-expanded={show}
          aria-controls={`${id}-list`}
          aria-activedescendant={show ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          placeholder="Swiggy, Amazon, or any store"
          value={value}
          onChange={(e) => {
            onType(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (!show) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(suggestions[Math.min(active, suggestions.length - 1)]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-12 w-full rounded-2xl border border-line bg-surface-2 pl-10 pr-10 text-sm text-ink placeholder:text-faint transition-colors focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/15"
        />
        {value && (
          <button
            type="button"
            onClick={() => onType("")}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-faint hover:bg-white/5 hover:text-ink"
            aria-label="Clear merchant"
          >
            <X className="size-4" />
          </button>
        )}
        {show && (
          <ul
            id={`${id}-list`}
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-line-strong bg-surface-2/95 p-1 shadow-2xl backdrop-blur-xl animate-[fade-up_0.18s_ease-out]"
          >
            {!q && <li className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.16em] text-faint">Popular</li>}
            {suggestions.map((m, i) => (
              <li
                key={m.name}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(m);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2", i === active && "bg-white/[0.06]")}
              >
                <CategoryIcon category={m.category} size="sm" />
                <span className="flex-1 text-sm">{m.name}</span>
                <span className="text-[11px] text-faint">
                  {categoryLabel(m.category)} · {m.channel === "offline" ? "In-store" : "Online"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
