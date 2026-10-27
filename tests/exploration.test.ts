import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isTourAgency,
  matchesExploreGroup,
} from "../src/features/places/exploration";

test("Imported hotels and resorts join stays; wineries remain experiences", () => {
  for (const category of ["stay", "hotels", "resorts"]) {
    assert.equal(matchesExploreGroup({ category }, "stay"), true);
    assert.equal(matchesExploreGroup({ category }, "experience"), false);
  }
  assert.equal(matchesExploreGroup({ category: "winery" }, "experience"), true);
  assert.equal(
    matchesExploreGroup(
      { category: "custom", categoryLabel: "Pensiuni" },
      "stay",
    ),
    true,
  );
});

test("Tour operators are excluded from every public exploration group", () => {
  for (const place of [
    { category: "tour-operators" },
    { category: "custom", categoryLabel: "Agenții de turism" },
  ]) {
    assert.equal(isTourAgency(place), true);
    for (const group of ["all", "experience", "stay"] as const)
      assert.equal(matchesExploreGroup(place, group), false);
  }
});
