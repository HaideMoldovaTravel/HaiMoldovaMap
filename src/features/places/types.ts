export type CategoryId = string;
export interface Place {
  id: string;
  source?: "haide";
  sourceId?: string;
  name: string;
  category: Exclude<CategoryId, "all">;
  kind?: "location" | "experience";
  region: string;
  village: string;
  coordinates: [number, number];
  rating: number;
  reviews: number;
  image: string;
  images: string[];
  description: string;
  tags: string[];
  price: number;
  priceLabel: string;
  featured?: boolean;
  hours: string;
  categoryLabel?: string;
  categoryLabelEn?: string;
  categoryColor?: string;
  categoryIcon?: string;
  imageAlts?: string[];
  priceMode?: string;
  currency?: string;
  demo?: boolean;
  contacts?: Record<string, string>;
  contactFields?: {
    id: string;
    label: string;
    labelEn: string;
    type: string;
    value: string;
  }[];
  translatedName?: string;
  translatedDescription?: string;
  details?: {
    type?: string;
    id: string;
    label: string;
    labelEn: string;
    value: string | number | boolean | string[];
  }[];
}
export interface PlaceFilters {
  query: string;
  category: CategoryId;
  region: string;
  minRating: number;
  maxPrice: number;
  savedOnly: boolean;
}
export interface PlacesRepository {
  list(): Promise<Place[]>;
  getById(id: string): Promise<Place | undefined>;
}
