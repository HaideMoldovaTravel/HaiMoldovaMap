import {
  Compass,
  Wine,
  BedDouble,
  Footprints,
  Trees,
  Landmark,
  Utensils,
  Church,
  Castle,
  University,
  Drama,
  Palette,
  TreeDeciduous,
  Store,
  Hotel,
  TentTree,
  Coffee,
  Beer,
  Grape,
  Map,
  ShoppingBag,
} from "lucide-react";
import type { CategoryId } from "@/features/places/types";
export const categoryIcons: Record<CategoryId, typeof Compass> = {
  all: Compass,
  winery: Wine,
  stay: BedDouble,
  experience: Footprints,
  nature: Trees,
  culture: Landmark,
  food: Utensils,
  // Categories created by scripts/import-places.ts
  worship: Church,
  monuments: Castle,
  museums: University,
  theatres: Drama,
  galleries: Palette,
  parks: TreeDeciduous,
  markets: Store,
  hotels: Hotel,
  resorts: TentTree,
  cafes: Coffee,
  bars: Beer,
  "wine-bars": Grape,
  "tour-operators": Map,
  shopping: ShoppingBag,
};
export const categoryColors: Record<CategoryId, string> = {
  all: "#002626",
  winery: "#944236",
  stay: "#b06a4a",
  experience: "#4d9f96",
  nature: "#17332d",
  culture: "#0f5a52",
  food: "#c0705f",
};

export function ArrowUpRightIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}
