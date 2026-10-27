import type { Place } from "./types";

export type ExploreGroup = "all" | "experience" | "stay";
type Category = Pick<Place, "category" | "categoryLabel">;

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
  return group === "all" || (group === "stay" ? stay : !stay);
}
