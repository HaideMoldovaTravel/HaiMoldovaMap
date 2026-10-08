export const mapLayers = [
  {
    id: "standard",
    label: "Hartă",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    maxZoom: 19,
  },
  {
    id: "satellite",
    label: "Satelit",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    maxZoom: 18,
  },
] as const;
export type MapLayerId = (typeof mapLayers)[number]["id"];
