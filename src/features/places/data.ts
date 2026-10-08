import type {
  Place,
  CategoryId,
  PlacesRepository,
  PlaceFilters,
} from "./types";
export const categories: { id: CategoryId; label: string }[] = [
  { id: "all", label: "Toate locurile" },
  { id: "winery", label: "Vinării" },
  { id: "stay", label: "Pensiuni" },
  { id: "experience", label: "Experiențe" },
  { id: "nature", label: "Natură" },
  { id: "culture", label: "Cultură" },
  { id: "food", label: "Gastronomie" },
];
const photo = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=85`;
const vineyard = photo("photo-1504279577054-acfeccf8fc52");
const wine = photo("photo-1510812431401-41d2bd2722f3");
const country = photo("photo-1449158743715-0a90ebb6d2d8");
const nature = photo("photo-1472396961693-142e6e269027");
const forest = photo("photo-1448375240586-882707db888b");
const food = photo("photo-1414235077428-338989a2e8c0");
const monastery = photo("photo-1516483638261-f4dbaf036963");
export const places: Place[] = [
  {
    id: "purcari",
    name: "Château Purcari",
    category: "winery",
    region: "Sud",
    village: "Purcari, Ștefan Vodă",
    coordinates: [46.535, 29.856],
    rating: 4.9,
    reviews: 328,
    image: vineyard,
    images: [vineyard, wine, country],
    description:
      "O escapadă printre podgorii, povești și vinuri de colecție. Descoperă tradiția vinicolă a Moldovei într-un loc în care timpul capătă un alt ritm.",
    tags: ["Degustări de vin", "Cazare", "Restaurant"],
    price: 450,
    priceLabel: "degustare",
    featured: true,
    hours: "10:00 – 19:00",
  },
  {
    id: "asconi",
    name: "Asconi Winery",
    category: "winery",
    region: "Centru",
    village: "Puhoi, Ialoveni",
    coordinates: [46.83, 28.866],
    rating: 4.8,
    reviews: 214,
    image: country,
    images: [country, vineyard, food],
    description:
      "Case tradiționale, bucate pregătite cu grijă și vinuri din inima Moldovei. Un loc primitor pentru o zi alături de cei dragi.",
    tags: ["Bucătărie locală", "Degustări de vin", "Cazare"],
    price: 350,
    priceLabel: "degustare",
    featured: true,
    hours: "10:00 – 20:00",
  },
  {
    id: "orhei",
    name: "Orheiul Vechi",
    category: "culture",
    region: "Centru",
    village: "Butuceni, Orhei",
    coordinates: [47.304, 28.973],
    rating: 4.9,
    reviews: 486,
    image: monastery,
    images: [monastery, nature, country],
    description:
      "Un peisaj care îți rămâne în suflet. Explorează poteci deasupra Răutului, sate cu tradiții vii și mănăstirea săpată în stâncă.",
    tags: ["Patrimoniu", "Priveliști", "Plimbări"],
    price: 0,
    priceLabel: "acces liber",
    hours: "09:00 – 18:00",
  },
  {
    id: "cricova",
    name: "Beciurile Cricova",
    category: "winery",
    region: "Centru",
    village: "Cricova, Chișinău",
    coordinates: [47.14, 28.861],
    rating: 4.8,
    reviews: 392,
    image: wine,
    images: [wine, vineyard, country],
    description:
      "O călătorie în orașul subteran al vinului. Galerii impresionante și o experiență de degustare pentru iubitorii de povești și arome.",
    tags: ["Tur ghidat", "Degustări de vin"],
    price: 550,
    priceLabel: "tur",
    hours: "09:00 – 18:00",
  },
  {
    id: "eco",
    name: "Eco Resort Butuceni",
    category: "stay",
    region: "Centru",
    village: "Butuceni, Orhei",
    coordinates: [47.296, 28.967],
    rating: 4.7,
    reviews: 173,
    image: country,
    images: [country, food, nature],
    description:
      "Dimineți liniștite, căsuțe cu farmec și gusturi din copilărie. O pensiune în care ospitalitatea locală face parte din fiecare experiență.",
    tags: ["Mic dejun", "Piscină", "Pet friendly"],
    price: 1400,
    priceLabel: "noapte",
    hours: "Recepție 24/7",
  },
  {
    id: "codru",
    name: "Rezervația Codrii",
    category: "nature",
    region: "Centru",
    village: "Lozova, Strășeni",
    coordinates: [47.105, 28.365],
    rating: 4.8,
    reviews: 126,
    image: forest,
    images: [forest, nature, country],
    description:
      "Respiră adânc și lasă orașul în urmă. Poteci prin păduri seculare și o biodiversitate fascinantă, în mijlocul naturii.",
    tags: ["Drumeții", "Pădure", "Familie"],
    price: 50,
    priceLabel: "intrare",
    hours: "09:00 – 17:00",
  },
  {
    id: "milesti",
    name: "Mileștii Mici",
    category: "winery",
    region: "Centru",
    village: "Mileștii Mici, Ialoveni",
    coordinates: [46.932, 28.805],
    rating: 4.7,
    reviews: 265,
    image: wine,
    images: [wine, vineyard],
    description:
      "Descoperă galerii subterane și o colecție impresionantă de vinuri. Un tur pentru cei care vor să cunoască Moldova prin tradiția ei vinicolă.",
    tags: ["Tur ghidat", "Colecție de vinuri"],
    price: 500,
    priceLabel: "tur",
    hours: "09:00 – 17:00",
  },
  {
    id: "soroca",
    name: "Cetatea Soroca",
    category: "culture",
    region: "Nord",
    village: "Soroca",
    coordinates: [48.161, 28.305],
    rating: 4.8,
    reviews: 281,
    image: monastery,
    images: [monastery, nature],
    description:
      "O oprire pe malul Nistrului, printre ziduri cu istorie și priveliști către râu.",
    tags: ["Istorie", "Familie"],
    price: 50,
    priceLabel: "intrare",
    hours: "09:00 – 18:00",
  },
  {
    id: "saharna",
    name: "Cascadele Saharna",
    category: "nature",
    region: "Nord",
    village: "Saharna, Rezina",
    coordinates: [47.694, 28.967],
    rating: 4.8,
    reviews: 194,
    image: nature,
    images: [nature, forest],
    description:
      "O plimbare printr-un defileu verde, cu cascade și opriri pentru a admira natura.",
    tags: ["Cascade", "Drumeții"],
    price: 0,
    priceLabel: "acces liber",
    hours: "Acces pe timp de zi",
  },
  {
    id: "valeni",
    name: "Casa Bunicii",
    category: "stay",
    region: "Sud",
    village: "Văleni, Cahul",
    coordinates: [45.642, 28.174],
    rating: 4.9,
    reviews: 87,
    image: country,
    images: [country, food],
    description:
      "O casă primitoare în sudul Moldovei, cu pâine de casă și povești de la gazde.",
    tags: ["Mic dejun", "Tradiții"],
    price: 850,
    priceLabel: "noapte",
    hours: "Recepție 08:00 – 22:00",
  },
  {
    id: "kayak",
    name: "Cu caiacul pe Nistru",
    category: "experience",
    region: "Centru",
    village: "Vadul lui Vodă",
    coordinates: [47.089, 29.085],
    rating: 4.9,
    reviews: 64,
    image: nature,
    images: [nature, forest],
    description:
      "Privește Moldova de pe apă. O experiență relaxantă de vâslit, cu ghid și echipament inclus.",
    tags: ["Aventură", "Ghid inclus"],
    price: 400,
    priceLabel: "persoană",
    hours: "10:00 – 18:00",
  },
  {
    id: "han",
    name: "La Hanul lui Vasile",
    category: "food",
    region: "Centru",
    village: "Chișinău",
    coordinates: [47.026, 28.84],
    rating: 4.6,
    reviews: 152,
    image: food,
    images: [food, country],
    description:
      "Plăcinte, mămăligă și bucate de sezon într-o atmosferă caldă, inspirată de satul moldovenesc.",
    tags: ["Bucătărie locală", "Terasă"],
    price: 250,
    priceLabel: "persoană",
    hours: "11:00 – 22:00",
  },
];
export const mockPlacesRepository: PlacesRepository = {
  async list() {
    return places;
  },
  async getById(id) {
    return places.find((p) => p.id === id);
  },
};
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function filterPlaces(
  items: Place[],
  filters: PlaceFilters,
  saved: string[],
) {
  const query = normalize(filters.query.trim());
  return items.filter(
    (p) =>
      (!query ||
        normalize(
          `${p.name} ${p.village} ${p.description} ${p.tags.join(" ")}`,
        ).includes(query)) &&
      (filters.category === "all" || p.category === filters.category) &&
      (filters.region === "all" || p.region === filters.region) &&
      p.rating >= filters.minRating &&
      p.price <= filters.maxPrice &&
      (!filters.savedOnly || saved.includes(p.id)),
  );
}
