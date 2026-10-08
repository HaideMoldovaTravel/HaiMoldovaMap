import { useI18n } from "@/features/i18n/provider";
import { MapPin, ChevronRight } from "lucide-react";
import type { MapPoint } from "@/features/map/types";
export function GeoSearchResults({
  results,
  error,
  onSelect,
}: {
  results: MapPoint[];
  error: string;
  onSelect: (point: MapPoint) => void;
}) {
  const { t } = useI18n();

  return results.length || error ? (
    <div className="geo-search-results">
      {results.length > 0 && (
        <span className="eyebrow">{t("REZULTATE PE HARTĂ")}</span>
      )}
      {results.map((p) => (
        <button key={p.id} onClick={() => onSelect(p)}>
          <MapPin size={16} />
          <span>{p.label}</span>
          <ChevronRight size={14} />
        </button>
      ))}
      {error && (
        <p className="inline-error" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  ) : null;
}
