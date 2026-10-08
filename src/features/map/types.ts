export type Coordinates = [number, number];
export interface MapPoint {
  id: string;
  label: string;
  coordinates: Coordinates;
}
export interface RouteStep {
  name: string;
  distance: number;
  maneuver: { type: string; modifier?: string; exit?: number };
}
export interface MapRoute {
  distance: number;
  duration: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  steps: RouteStep[];
}
