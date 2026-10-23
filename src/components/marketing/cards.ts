import { CATALOG, type CatalogCard } from "@/data/catalog";

/** Looks up catalog cards by id, skipping any that no longer exist. */
export function pickCards(...ids: string[]): CatalogCard[] {
  return ids.map((id) => CATALOG.find((c) => c.id === id)).filter((c): c is CatalogCard => Boolean(c));
}

export function cardById(id: string): CatalogCard | undefined {
  return CATALOG.find((c) => c.id === id);
}
