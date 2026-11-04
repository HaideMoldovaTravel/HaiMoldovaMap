import type { Place } from "./types";

export type ExploreGroup = "all" | "experience" | "stay";
type Category = Pick<Place, "category" | "categoryLabel" | "kind">;

export const experienceSubcategories = [
  { id: "food-wine", label: "Gastronomie și vin", labelEn: "Food & wine" },
  {
    id: "craft-traditions",
    label: "Meșteșuguri și tradiții",
    labelEn: "Craft & traditions",
  },
  { id: "village-life", label: "Viața la sat", labelEn: "Village life" },
  { id: "adrenaline", label: "Adrenalină", labelEn: "Adrenaline" },
  {
    id: "private-exclusive",
    label: "Privat și exclusiv",
    labelEn: "Private & exclusive",
  },
  { id: "on-the-water", label: "Pe apă", labelEn: "On the water" },
  { id: "animals", label: "Animale", labelEn: "Animals" },
  { id: "soviet-vibe", label: "Atmosferă sovietică", labelEn: "Soviet vibe" },
  { id: "after-sunset", label: "După apus", labelEn: "After sunset" },
] as const;
export type ExperienceSubcategory =
  (typeof experienceSubcategories)[number]["id"];

export function placeSubcategories(
  place: Pick<
    Place,
    "category" | "name" | "description" | "tags" | "subcategories"
  >,
): string[] {
  if (place.subcategories?.length) return place.subcategories;
  const text =
    `${place.category} ${place.name} ${place.tags.join(" ")} ${place.description}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const matches: [ExperienceSubcategory, RegExp][] = [
    [
      "food-wine",
      /winery|wine|vinar|vinicol|degust|gastronom|culinar|branz|cascaval/,
    ],
    [
      "craft-traditions",
      /craft|workshop|atelier|ceramic|pottery|mestesug|olar|tesut/,
    ],
    ["village-life", /village|rural|viata la sat|gospodar|agrotur/],
    [
      "adrenaline",
      /adrenalin|extreme|atv|parasut|parapant|escalad|cav(e|es)|speolog/,
    ],
    ["private-exclusive", /private|privat|exclusiv/],
    ["on-the-water", /kayak|caiac|\bsup\b|canoe|barca|boat|croazier|vaslit/],
    [
      "animals",
      /animal|horse|equestrian|calar|ponei|ferma|farm|zoo|albin|prisac|apiterap/,
    ],
    ["soviet-vibe", /soviet|sovietic/],
    [
      "after-sunset",
      /after sunset|dupa apus|nocturn|night tour|cerul instelat/,
    ],
  ];
  return matches.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
}

export function isTourAgency(place: Category) {
  return /tour-operators|agency|agencies|agentii|agenții|agenție|agentie/i.test(
    `${place.category} ${place.categoryLabel ?? ""}`,
  );
}

export function matchesExploreGroup(place: Category, group: ExploreGroup) {
  if (isTourAgency(place)) return false;
  const stay = /stay|resorts|accommodation|cazare|cazări|pensiun|hotel/i.test(
    `${place.category} ${place.categoryLabel ?? ""}`,
  );
  const experience =
    !stay &&
    (place.kind === "experience" ||
      /^(experience|winery|extreme)$/.test(place.category));
  return group === "all"
    ? stay || experience
    : group === "stay"
      ? stay
      : experience;
}
