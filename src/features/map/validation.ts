export function parseCoordinates(
  value: string | null,
): [number, number] | null {
  if (!value || !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(value)) return null;
  const [lat, lng] = value.split(",").map(Number);
  return Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
    ? [lat, lng]
    : null;
}
