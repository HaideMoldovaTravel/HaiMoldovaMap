export type CategoryId =
  "all" | "winery" | "stay" | "experience" | "nature" | "culture" | "food";
export interface Place {
  id: string;
  name: string;
  category: Exclude<CategoryId, "all">;
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
