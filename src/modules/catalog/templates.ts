import type { ContentField } from "./schema";
const field = (
  id: string,
  label: string,
  type: ContentField["type"],
  group: ContentField["group"],
  extra: Partial<ContentField> = {},
): ContentField => ({
  id,
  label,
  labelEn: "",
  type,
  group,
  required: false,
  public: true,
  help: "",
  options: [],
  ...extra,
});
const common: ContentField[] = [
  field("name", "Denumire", "text", "presentation", {
    required: true,
    labelEn: "Name",
  }),
  field("name_en", "Denumire în engleză", "text", "presentation", {
    labelEn: "English name",
  }),
  field("description", "Descriere", "textarea", "presentation", {
    required: true,
    labelEn: "Description",
  }),
  field("description_en", "Descriere în engleză", "textarea", "presentation", {
    labelEn: "English description",
  }),
  field("region", "Regiune", "select", "location", {
    required: true,
    options: ["Nord", "Centru", "Sud"],
    labelEn: "Region",
  }),
  field("village", "Localitate și adresă", "text", "location", {
    required: true,
    labelEn: "Address",
  }),
  field("latitude", "Latitudine", "number", "location", {
    required: true,
    labelEn: "Latitude",
    help: "Coordonatele punctului exact, de exemplu 47.0245.",
  }),
  field("longitude", "Longitudine", "number", "location", {
    required: true,
    labelEn: "Longitude",
    help: "De exemplu 28.8353.",
  }),
  field("gallery", "Fotografii", "gallery", "media", {
    labelEn: "Photos",
    help: "Până la 10 fotografii JPEG, PNG sau WebP, maximum 10 MB fiecare. Confirmă că ai dreptul să le publici.",
  }),
  field("phone", "Telefon", "phone", "contacts", { labelEn: "Phone" }),
  field("email", "Email public", "email", "contacts", {
    labelEn: "Public email",
  }),
  field("website", "Website", "url", "contacts", { labelEn: "Website" }),
  field("whatsapp", "WhatsApp", "phone", "contacts", {
    labelEn: "WhatsApp",
    help: "Număr complet, cu prefix de țară.",
  }),
  ...["facebook", "instagram", "tiktok", "youtube", "telegram"].map((id) =>
    field(id, id[0].toUpperCase() + id.slice(1), "url", "contacts"),
  ),
  field("booking_url", "Link rezervare online", "url", "contacts", {
    labelEn: "Online booking",
  }),
  field("tags", "Facilități și etichete", "multiselect", "details", {
    options: [
      "Degustări de vin",
      "Cazare",
      "Restaurant",
      "Bucătărie locală",
      "Patrimoniu",
      "Priveliști",
      "Plimbări",
      "Tur ghidat",
      "Mic dejun",
      "Piscină",
      "Pet friendly",
      "Drumeții",
      "Pădure",
      "Familie",
      "Colecție de vinuri",
      "Istorie",
      "Cascade",
      "Tradiții",
      "Aventură",
      "Ghid inclus",
      "Terasă",
    ],
    labelEn: "Amenities",
  }),
  field("hours", "Program", "text", "details", { labelEn: "Opening hours" }),
  field("price_mode", "Tipul prețului", "select", "details", {
    options: ["La cerere", "Gratuit", "Fix", "De la"],
    labelEn: "Price type",
  }),
  field("price", "Preț", "price", "details", { labelEn: "Price" }),
  field("currency", "Monedă", "select", "details", {
    options: ["MDL", "EUR", "USD"],
    labelEn: "Currency",
  }),
  field("price_unit", "Preț pentru", "select", "details", {
    options: ["persoană", "noapte", "grup", "intrare", "degustare", "tur"],
    labelEn: "Price unit",
  }),
  field("languages", "Limbi vorbite", "multiselect", "details", {
    options: ["Română", "English", "Altele"],
    labelEn: "Spoken languages",
  }),
  field("accessibility", "Accesibilitate", "textarea", "details", {
    labelEn: "Accessibility",
  }),
  field(
    "internal_notes",
    "Observații pentru moderatori",
    "textarea",
    "details",
    {
      public: false,
      labelEn: "Private notes",
      help: "Nu sunt publicate pe site.",
    },
  ),
];
export const initialCategories = [
  {
    id: "winery",
    name: "Vinării",
    nameEn: "Wineries",
    color: "#944236",
    kind: "location",
    extras: [
      field("wine_tours", "Tururi ghidate", "boolean", "details"),
      field("tasting", "Degustări", "boolean", "details"),
      field("restaurant", "Restaurant", "boolean", "details"),
      field("accommodation", "Cazare", "boolean", "details"),
    ],
  },
  {
    id: "stay",
    name: "Pensiuni",
    nameEn: "Stays",
    color: "#b06a4a",
    kind: "location",
    extras: [
      field("rooms", "Număr de camere", "number", "details"),
      field("capacity", "Capacitate persoane", "number", "details"),
      field("check_in", "Check-in", "text", "details"),
      field("check_out", "Check-out", "text", "details"),
      field("breakfast", "Mic dejun inclus", "boolean", "details"),
      field("pets", "Animale acceptate", "boolean", "details"),
    ],
  },
  {
    id: "experience",
    name: "Experiențe",
    nameEn: "Experiences",
    color: "#4d9f96",
    kind: "experience",
    extras: [
      field("duration", "Durată în minute", "number", "details"),
      field("min_people", "Număr minim participanți", "number", "details"),
      field("max_people", "Număr maxim participanți", "number", "details"),
      field("included", "Ce este inclus", "textarea", "details"),
      field("requirements", "Ce trebuie să aduci", "textarea", "details"),
      field("meeting_point", "Punct de întâlnire", "text", "details"),
    ],
  },
  {
    id: "nature",
    name: "Natură",
    nameEn: "Nature",
    color: "#17332d",
    kind: "location",
    extras: [
      field("trail_km", "Lungime traseu (km)", "number", "details"),
      field("difficulty", "Dificultate", "select", "details", {
        options: ["Ușor", "Mediu", "Dificil"],
      }),
      field("season", "Sezon recomandat", "text", "details"),
      field("rules", "Reguli de vizitare", "textarea", "details"),
    ],
  },
  {
    id: "culture",
    name: "Cultură",
    nameEn: "Culture",
    color: "#0f5a52",
    kind: "location",
    extras: [
      field("guided_visit", "Vizite ghidate", "boolean", "details"),
      field(
        "visit_duration",
        "Durată recomandată (minute)",
        "number",
        "details",
      ),
      field("visitor_rules", "Reguli pentru vizitatori", "textarea", "details"),
    ],
  },
  {
    id: "food",
    name: "Gastronomie",
    nameEn: "Food",
    color: "#c0705f",
    kind: "location",
    extras: [
      field("cuisine", "Specificul bucătăriei", "text", "details"),
      field("menu_url", "Link meniu", "url", "details"),
      field("vegetarian", "Opțiuni vegetariene", "boolean", "details"),
      field("terrace", "Terasă", "boolean", "details"),
      field("capacity", "Număr de locuri", "number", "details"),
    ],
  },
] as const;
export function initialFields(categoryId: string): ContentField[] {
  const category = initialCategories.find((c) => c.id === categoryId);
  if (!category) throw new Error("Categorie necunoscută.");
  return structuredClone([...common, ...category.extras]);
}
