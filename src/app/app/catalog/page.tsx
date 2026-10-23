import type { Metadata } from "next";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";
import type { CatalogProduct } from "@/components/catalog/types";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadCatalog, parseBenefits, rulePct, splitList } from "@/lib/wallet";

export const metadata: Metadata = { title: "Card Catalog" };

export default async function CatalogPage() {
  const user = await requireUser();
  const catalog = await loadCatalog();

  const products: CatalogProduct[] = catalog.map((p) => {
    const groupSize = new Map<string, number>();
    for (const r of p.rules) if (r.capGroup) groupSize.set(r.capGroup, (groupSize.get(r.capGroup) ?? 0) + 1);
    return {
      id: p.id, bank: p.bank, name: p.name, network: p.network, tier: p.tier,
      annualFee: p.annualFee, joiningFee: p.joiningFee, feeWaiverSpend: p.feeWaiverSpend,
      forexMarkup: p.forexMarkup, pointValue: p.pointValue, rewardUnit: p.rewardUnit,
      excluded: splitList(p.excludedCategories), benefits: parseBenefits(p.benefits),
      colorFrom: p.colorFrom, colorTo: p.colorTo, sourceUrl: p.sourceUrl, lastVerified: p.lastVerified, notes: p.notes,
      rules: p.rules.map((r) => ({
        id: r.id, label: r.label,
        categories: splitList(r.categories), merchants: splitList(r.merchants), channels: splitList(r.channels),
        rateType: r.rateType === "points" ? "points" : "percent", rate: r.rate, perAmount: r.perAmount,
        pct: rulePct(r, p.pointValue),
        capValue: r.capValue, capPeriod: r.capPeriod, capGroup: r.capGroup,
        capShared: !!r.capGroup && (groupSize.get(r.capGroup) ?? 0) > 1,
        minTxn: r.minTxn, priority: r.priority,
      })),
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Card Catalog"
        title={<>Every rule, <span className="italic text-accent">in the open</span></>}
        description={`The ${products.length} cards Swipewise knows about, with the exact reward rules, caps and exclusions the engine uses.`}
      />
      <CatalogBrowser products={products} isAdmin={user.isAdmin} />
    </>
  );
}
