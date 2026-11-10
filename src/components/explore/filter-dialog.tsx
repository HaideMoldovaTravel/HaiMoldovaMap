import { useEffect, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { useI18n } from "@/features/i18n/provider";
import {
  experienceSubcategories,
  initialExperienceFilters,
  type ExploreFacets,
} from "@/features/places/exploration";

export function FilterDialog({
  applied,
  showExperiences,
  showPrices,
  countResults,
  onApply,
  onClose,
}: {
  applied: ExploreFacets;
  showExperiences: boolean;
  showPrices: boolean;
  countResults: (facets: ExploreFacets) => number;
  onApply: (facets: ExploreFacets) => void;
  onClose: () => void;
}) {
  const { locale, t } = useI18n();
  const [draft, setDraft] = useState(applied);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const invalidRange =
    draft.minPrice !== undefined &&
    draft.maxPrice !== undefined &&
    draft.minPrice > draft.maxPrice;
  const resultCount = invalidRange ? 0 : countResults(draft);

  return (
    <dialog
      ref={dialog}
      className="filter-modal explore-filter-dialog"
      aria-labelledby="explore-filter-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (invalidRange) return;
          onApply(draft);
          dialog.current?.close();
        }}
      >
        <header className="explore-filter-header">
          <h2 id="explore-filter-title">{t("Filtre")}</h2>
          <button
            type="button"
            aria-label={t("Închide filtrele")}
            onClick={() => dialog.current?.close()}
          >
            <X size={21} />
          </button>
        </header>
        <div className="explore-filter-body">
          {showExperiences && (
            <>
              <fieldset>
                <legend>{t("Subcategorii de experiențe")}</legend>
                <div className="filter-options">
                  {experienceSubcategories.map(({ id, label, labelEn }) => {
                    const checked = draft.subcategories.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`category-chip ${checked ? "active" : ""}`}
                        aria-pressed={checked}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            subcategories: checked
                              ? current.subcategories.filter(
                                  (item) => item !== id,
                                )
                              : [...current.subcategories, id],
                          }))
                        }
                      >
                        {locale === "en" ? labelEn : label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset>
                <legend>{t("Tipul experienței")}</legend>
                <div className="filter-options">
                  {(
                    [
                      ["", "Oricare"],
                      ["group", "Grup deschis"],
                      ["private", "Grup privat"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={`category-chip ${draft.bookingMode === mode ? "active" : ""}`}
                      aria-pressed={draft.bookingMode === mode}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          bookingMode: mode,
                        }))
                      }
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {showPrices && (
            <fieldset>
              <legend>{t("Interval de preț (MDL)")}</legend>
              <div className="filter-price-inputs">
                <label>
                  {t("Preț minim")}
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={draft.minPrice ?? ""}
                    aria-invalid={invalidRange}
                    onChange={(event) => {
                      const value = event.currentTarget.valueAsNumber;
                      setDraft((current) => ({
                        ...current,
                        minPrice: Number.isFinite(value) ? value : undefined,
                      }));
                    }}
                  />
                </label>
                <label>
                  {t("Preț maxim")}
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder={t("Fără limită")}
                    value={draft.maxPrice ?? ""}
                    aria-invalid={invalidRange}
                    onChange={(event) => {
                      const value = event.currentTarget.valueAsNumber;
                      setDraft((current) => ({
                        ...current,
                        maxPrice: Number.isFinite(value) ? value : undefined,
                      }));
                    }}
                  />
                </label>
              </div>
              {invalidRange && (
                <p className="filter-error" role="alert">
                  {t(
                    "Prețul maxim trebuie să fie cel puțin egal cu prețul minim.",
                  )}
                </p>
              )}
            </fieldset>
          )}
          {showExperiences && (
            <div className="filter-guests">
              <div>
                <h3 id="filter-guests-title">{t("Număr de persoane")}</h3>
                <p>
                  {t(
                    "Alege mărimea grupului pentru a ține cont de minimul cerut de gazdă.",
                  )}
                </p>
              </div>
              <div
                className="filter-stepper"
                role="group"
                aria-labelledby="filter-guests-title"
              >
                <button
                  type="button"
                  aria-label={t("Scade numărul de persoane")}
                  disabled={draft.guests === 0}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      guests: current.guests - 1,
                    }))
                  }
                >
                  <Minus size={16} />
                </button>
                <output>{draft.guests || t("Oricare")}</output>
                <button
                  type="button"
                  aria-label={t("Crește numărul de persoane")}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      guests: current.guests + 1,
                    }))
                  }
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        <footer className="filter-actions">
          <button
            type="button"
            onClick={() => setDraft(initialExperienceFilters)}
          >
            {t("Resetează")}
          </button>
          <button
            className="primary-button"
            type="submit"
            disabled={invalidRange}
          >
            {invalidRange
              ? t("Aplică filtrele")
              : resultCount === 1
                ? t("Arată un loc")
                : t("Arată {{count}} locuri", { count: resultCount })}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
