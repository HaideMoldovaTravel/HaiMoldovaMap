import {
  Compass,
  Wine,
  BedDouble,
  Footprints,
  Trees,
  Landmark,
  Utensils,
} from "lucide-react";
import type { CategoryId } from "@/features/places/types";
export const categoryIcons = {
  all: Compass,
  winery: Wine,
  stay: BedDouble,
  experience: Footprints,
  nature: Trees,
  culture: Landmark,
  food: Utensils,
} satisfies Record<CategoryId, typeof Compass>;
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
