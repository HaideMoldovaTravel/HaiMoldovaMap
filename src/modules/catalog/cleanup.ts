/** Decisions for the reviewed local catalog. Unknown categories require review. */
export type CatalogDecision = {
  action: "keep" | "archive" | "reclassify";
  reason: string;
  category?: string;
  subcategories?: string[];
};
const reclassifications: Record<
  string,
  { category: string; subcategories?: string[]; reason: string }
> = {
  "import-fc0fd6bd0cdf676cbfb1": {
    category: "stay",
    reason: "Pensiune agroturistică, încadrată la experiențe.",
  },
  "vtb-196": {
    category: "stay",
    reason: "CUIB oferă cazare cu rezervare explicită; păstrat la cazări.",
  },
  "vtb-36": {
    category: "experience",
    subcategories: ["village-life"],
    reason:
      "Poarta Neamului oferă drumeții și activități rurale, nu doar masă.",
  },
  "vtb-136": {
    category: "experience",
    subcategories: ["village-life"],
    reason: "Vizită cu programare în grădina gazdei.",
  },
  "vtb-150": {
    category: "experience",
    subcategories: ["village-life"],
    reason: "Vizită cu bilet și sesiuni foto în câmpul de lavandă.",
  },
  "vtb-156": {
    category: "experience",
    subcategories: ["village-life"],
    reason: "Vizită sezonieră și fotografii în câmpul de lavandă.",
  },
  "vtb-212": {
    category: "experience",
    subcategories: ["animals"],
    reason: "Activități cu animale, ponei și călărie.",
  },
  ...Object.fromEntries(
    [
      "import-6ce0434692b90410e09b",
      "import-0fe303332922d7ba1c34",
      "import-764f2f2448d481fbfea2",
      "import-91bcc72018dadc4b7c75",
      "import-9b86154a54607823aae7",
    ].map((id) => [
      id,
      {
        category: "experience",
        subcategories: ["food-wine"],
        reason:
          "Descrierea oferă explicit degustări ghidate sau tematice; păstrat ca experiență.",
      },
    ]),
  ),
};
const notExperiences: Record<string, string> = {
  "import-f90f8b445bef02bc79f1":
    "Magazinul fabricii Bucuria; nu este oferit un tur sau atelier.",
  "import-ee04551f2e2cec2c08f8": "Standuri comerciale temporare la Moldexpo.",
  "import-a120f6cee552b89073e0":
    "Chișinău Arena: fișă generală de complex și evenimente, fără o experiență concretă.",
};
const excludedCategories = new Set([
  "monuments",
  "worship",
  "museums",
  "theatres",
  "galleries",
  "parks",
  "markets",
  "cafes",
  "bars",
  "wine-bars",
  "food",
  "tour-operators",
  "shopping",
  "culture",
  "nature",
]);
export function catalogDecision(row: {
  id: string;
  demo: boolean;
  category_id: string;
  kind: string;
}): CatalogDecision {
  if (row.demo)
    return {
      action: "archive",
      reason: "Fișă demonstrativă cu imagini și contacte ilustrative.",
    };
  if (reclassifications[row.id])
    return { action: "reclassify", ...reclassifications[row.id] };
  if (notExperiences[row.id])
    return { action: "archive", reason: notExperiences[row.id] };
  if (excludedCategories.has(row.category_id))
    return {
      action: "archive",
      reason:
        "Obiectiv, local de alimentație sau punct comercial; fără o experiență concretă ori cazare în fișa analizată.",
    };
  return {
    action: "keep",
    reason: "Experiență, vinărie cu vizitare sau cazare; păstrată.",
  };
}
