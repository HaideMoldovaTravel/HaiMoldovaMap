export type CategoryId = string;
export type BookingMode = "group" | "private";
export interface Place {
  id: string;
  source?: "haide";
  sourceId?: string;
  routeAvailable?: boolean;
  name: string;
  category: Exclude<CategoryId, "all">;
  subcategories?: string[];
  kind?: "location" | "experience";
  bookingMode?: BookingMode;
  minPeople?: number;
  maxPeople?: number;
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
  minPrice?: number;
  maxPrice: number;
  savedOnly: boolean;
}
export interface PlacesRepository {
  list(): Promise<Place[]>;
  getById(id: string): Promise<Place | undefined>;
}
