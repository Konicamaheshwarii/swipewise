import type { Metadata } from "next";
import { NETWORKS, type CustomProduct, type Network } from "@/components/wallet/custom-shared";
import { WalletView, type CatalogItem } from "@/components/wallet/wallet-view";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadCatalog, loadWallet, parseBenefits, splitList } from "@/lib/wallet";

export const metadata: Metadata = { title: "My Wallet" };

export default async function WalletPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [{ cardViews }, products, own] = await Promise.all([
    loadWallet(user.id, 0),
    loadCatalog(),
    db.cardProduct.findMany({ where: { ownerId: user.id }, include: { rules: { orderBy: { priority: "asc" } } } }),
  ]);

  const catalog: CatalogItem[] = products.map((p) => ({
    id: p.id,
    bank: p.bank,
    name: p.name,
    network: p.network,
    tier: p.tier,
    annualFee: p.annualFee,
    feeWaiverSpend: p.feeWaiverSpend,
    rewardUnit: p.rewardUnit,
    colorFrom: p.colorFrom,
    colorTo: p.colorTo,
    benefits: parseBenefits(p.benefits),
  }));

  // Custom cards: base rule (priority 0, no categories) + up to 3 category bonus rules.
  const custom: CustomProduct[] = own.map((p) => {
    const base = p.rules.find((r) => !r.categories && r.priority === 0);
    return {
      id: p.id,
      bank: p.bank,
      name: p.name,
      network: (NETWORKS as readonly string[]).includes(p.network) ? (p.network as Network) : "Visa",
      annualFee: p.annualFee,
      feeWaiverSpend: p.feeWaiverSpend,
      forexMarkup: p.forexMarkup,
      baseRate: base?.rate ?? 0,
      bonuses: p.rules
        .filter((r) => r.categories)
        .slice(0, 3)
        .map((r) => ({ category: splitList(r.categories)[0], rate: r.rate, monthlyCap: r.capValue })),
      excluded: splitList(p.excludedCategories),
    };
  });

  const add = typeof sp.add === "string" && catalog.some((c) => c.id === sp.add) ? sp.add : null;

  // Keyed so a fresh ?add=<id> (e.g. from Discover) reopens the modal even on client navigation.
  return <WalletView key={add ?? "wallet"} cards={cardViews} catalog={catalog} custom={custom} welcome={sp.welcome === "1"} initialAdd={add} />;
}
