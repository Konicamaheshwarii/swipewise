import {
  Bike, Clapperboard, Fuel, GraduationCap, HeartPulse, House, Landmark, Plane, ShieldCheck,
  ShoppingBag, ShoppingBasket, Sparkles, UtensilsCrossed, Wallet, Zap, type LucideIcon,
} from "lucide-react";
import { CATEGORY_MAP } from "@/data/categories";
import { cn } from "@/lib/format";

const ICONS: Record<string, LucideIcon> = {
  ShoppingBasket, UtensilsCrossed, Bike, ShoppingBag, Plane, Fuel, Zap, Clapperboard,
  HeartPulse, Home: House, ShieldCheck, GraduationCap, Wallet, Landmark, Sparkles,
};

/** Rounded tile with the category's icon tinted in its colour. */
export function CategoryIcon({ category, size = "md", className }: { category: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const def = CATEGORY_MAP[category] ?? CATEGORY_MAP.other;
  const Icon = ICONS[def.icon] ?? Sparkles;
  const box = { sm: "size-7 rounded-lg", md: "size-9 rounded-xl", lg: "size-11 rounded-2xl" }[size];
  const icon = { sm: "size-3.5", md: "size-4", lg: "size-5" }[size];
  return (
    <span
      className={cn("grid shrink-0 place-items-center border", box, className)}
      style={{ color: def.color, background: `${def.color}14`, borderColor: `${def.color}2e` }}
    >
      <Icon className={icon} />
    </span>
  );
}
