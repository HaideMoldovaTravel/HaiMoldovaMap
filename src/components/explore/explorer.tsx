"use client";
import { useI18n } from "@/features/i18n/provider";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Bookmark,
  ChevronDown,
  Compass,
  MapPin,
  Menu,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
  Leaf,
  Map,
  Info,
} from "lucide-react";
import { categories, places, filterPlaces } from "@/features/places/data";
import type { CategoryId, Place, PlaceFilters } from "@/features/places/types";
import { categoryIcons, ArrowUpRightIcon } from "./icons";
import { PlaceCard } from "./place-card";
import { PlaceDetails } from "./place-details";
import { GeoSearchResults } from "./search-results";
import { searchAddress } from "@/features/map/client";
import { localizePlace } from "@/features/places/localization";
import type { MapPoint } from "@/features/map/types";
const TourismMap = dynamic(() => import("./tourism-map"), {
  ssr: false,
  loading: MapLoading,
});
const initialFilters: PlaceFilters = {
  query: "",
  category: "all",
  region: "all",
  minRating: 0,
  maxPrice: 2000,
  savedOnly: false,
};
export function Explorer() {
  const { t, locale, setLocale } = useI18n();

  const [searchPoint, setSearchPoint] = useState<MapPoint | null>(null);
  const [geoResults, setGeoResults] = useState<MapPoint[]>([]);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState("");
  const geoController = useRef<AbortController | null>(null);
  const [routeDestination, setRouteDestination] = useState<MapPoint | null>(
    null,
  );
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [notice, setNotice] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "map">("map");
  const [infoOpen, setInfoOpen] = useState(false);
  useEffect(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("hai-moldova-saved") || "[]",
      );
      if (Array.isArray(value))
        queueMicrotask(() =>
          setSaved(value.filter((id: unknown) => typeof id === "string")),
        );
    } catch {}
  }, []);
  const toggleSave = (id: string) =>
    setSaved((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      localStorage.setItem("hai-moldova-saved", JSON.stringify(next));
      return next;
    });
  const localizedPlaces = useMemo(
    () => places.map((p) => localizePlace(p, locale)),
    [locale],
  );
  const filtered = useMemo(() => {
    const list = filterPlaces(localizedPlaces, filters, saved);
    return list.sort((a, b) =>
      sort === "rating"
        ? b.rating - a.rating
        : sort === "price"
          ? a.price - b.price
          : Number(b.featured || false) - Number(a.featured || false),
    );
  }, [filters, saved, sort, localizedPlaces]);
  const select = useCallback((id: string) => {
    setSelectedId(id);
    setMobileView("list");
  }, []);
  const selected = localizedPlaces.find((p) => p.id === selectedId);
  const activeFilters =
    Number(filters.region !== "all") +
    Number(filters.minRating > 0) +
    Number(filters.maxPrice < 2000);
  const changeQuery = (query: string) => {
    geoController.current?.abort();
    setGeoBusy(false);
    setGeoResults([]);
    setGeoError("");
    setFilters((f) => ({ ...f, query }));
    setSelectedId(null);
  };
  const searchGeo = async () => {
    if (filters.query.trim().length < 2) return;
    geoController.current?.abort();
    const current = new AbortController();
    geoController.current = current;
    setGeoBusy(true);
    setGeoError("");
    try {
      const results = await searchAddress(filters.query, current.signal);
      if (current.signal.aborted) return;
      setGeoResults(results);
      if (!results.length)
        setGeoError(t("Nicio adresă găsită în Moldova. Încearcă alt nume."));
    } catch (e) {
      if (!current.signal.aborted)
        setGeoError(e instanceof Error ? e.message : t("Căutarea a eșuat."));
    } finally {
      if (!current.signal.aborted) setGeoBusy(false);
    }
  };
  const pickGeo = (point: MapPoint) => {
    setSearchPoint(point);
    setGeoResults([]);
    setFilters((f) => ({ ...f, query: "" }));
    setSelectedId(null);
    setMobileView("map");
  };
  const planRoute = (p: Place) => {
    setRouteDestination({
      id: p.id,
      label: p.name,
      coordinates: p.coordinates,
    });
    setMobileView("map");
  };
  useEffect(() => () => geoController.current?.abort(), []);
  const changeCategory = (category: CategoryId) => {
    setFilters((f) => ({ ...f, category }));
    setSelectedId(null);
  };
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  return (
    <main className={`explorer mobile-${mobileView}`}>
      <nav className="rail" aria-label={t("Navigare principală")}>
        <button
          className="brand-mark"
          aria-label={t("Hai Moldova, pagina principală")}
          onClick={() => {
            setFilters(initialFilters);
            setSelectedId(null);
            setSearchPoint(null);
            setRouteDestination(null);
            setGeoResults([]);
            setMobileView("map");
          }}
        >
          <Leaf size={26} />
          <span className="brand-dot" />
        </button>
        <div className="rail-nav">
          <button
            className={!filters.savedOnly ? "rail-item active" : "rail-item"}
            onClick={() => {
              setFilters((f) => ({ ...f, savedOnly: false }));
              setSelectedId(null);
            }}
          >
            <Compass size={23} />
            <span>{t("Explorează")}</span>
          </button>
          <button
            className={filters.savedOnly ? "rail-item active" : "rail-item"}
            onClick={() => {
              setFilters({ ...initialFilters, savedOnly: true });
              setSelectedId(null);
              setMobileView("list");
            }}
          >
            <Bookmark size={22} />
            {saved.length > 0 && <i>{saved.length}</i>}
            <span>{t("Salvate")}</span>
          </button>
        </div>
        <div className="rail-bottom">
          <button className="rail-item" onClick={() => setInfoOpen(true)}>
            <Info size={21} />
            <span>{t("Despre noi")}</span>
          </button>
          <button
            className="avatar"
            title={t("Profil demonstrativ")}
            onClick={() =>
              setNotice(
                t(
                  "Conturile de utilizator vor fi disponibile la integrarea backendului.",
                ),
              )
            }
          >
            A
          </button>
        </div>
      </nav>
      <section className="workspace">
        <header className="topbar">
          <div className="wordmark">
            <strong>
              hai<span>moldova</span>
              <i>®</i>
            </strong>
            <small>{t("LOCURI MICI. POVEȘTI MARI.")}</small>
          </div>
          <div className="header-right">
            <span className="header-tagline">
              {t("Mai aproape de locurile care contează.")}
            </span>
            <div
              className="language-switch"
              role="group"
              aria-label="Language / Limbă / Язык"
            >
              {(["ro", "en", "ru"] as const).map((language) => (
                <button
                  key={language}
                  lang={language}
                  aria-label={
                    { ro: "Română", en: "English", ru: "Русский" }[language]
                  }
                  aria-pressed={locale === language}
                  className={locale === language ? "active" : ""}
                  onClick={() => setLocale(language)}
                >
                  {language.toUpperCase()}
                </button>
              ))}
            </div>
            <span className="demo-pill">
              <span />
              {t("Preview")}
            </span>
          </div>
        </header>
        <div className="explore-content">
          <aside className={`sidebar ${selected ? "has-detail" : ""}`}>
            <div className="search-area">
              <form
                className="search-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  void searchGeo();
                }}
              >
                <Search size={20} />
                <input
                  aria-label={t("Caută locuri în Moldova")}
                  placeholder={t("Unde vrei să ajungi?")}
                  value={filters.query}
                  onChange={(e) => changeQuery(e.target.value)}
                />
                {filters.query && (
                  <button
                    type="button"
                    title={t("Șterge căutarea")}
                    onClick={() => changeQuery("")}
                  >
                    <X size={16} />
                  </button>
                )}
                <button
                  type="submit"
                  title={t("Caută localități și adrese pe hartă")}
                  disabled={geoBusy || filters.query.trim().length < 2}
                  className="search-key"
                >
                  {geoBusy ? "…" : "↵"}
                </button>
              </form>
              <div className="search-meta">
                <MapPin size={13} />
                <span>{t("Moldova")}</span>
                <span className="meta-dot">·</span>
                <span>{t("Enter pentru localități și adrese")}</span>
              </div>
              <GeoSearchResults
                results={geoResults}
                error={geoError}
                onSelect={pickGeo}
              />
            </div>
            {selected ? (
              <PlaceDetails
                place={selected}
                saved={saved.includes(selected.id)}
                onSave={() => toggleSave(selected.id)}
                onClose={() => setSelectedId(null)}
                onDemo={setNotice}
                onRoute={() => planRoute(selected)}
              />
            ) : (
              <>
                <div className="list-intro">
                  <div className="eyebrow">
                    <span />
                    {filters.savedOnly
                      ? t("COLECȚIA TA")
                      : t("MERITĂ DESCOPERIT")}
                  </div>
                  <h1>
                    {filters.savedOnly
                      ? t("Locurile tale preferate")
                      : filters.category === "all"
                        ? t("O altfel de Moldovă")
                        : t(
                            categories.find((c) => c.id === filters.category)
                              ?.label,
                          )}
                    <span className="title-dot">.</span>
                  </h1>
                  <p>
                    {filters.savedOnly
                      ? t("Păstrează aproape locurile în care vrei să ajungi.")
                      : t("Ieși din rutină. Găsește locuri cu suflet.")}
                  </p>
                </div>
                <div className="result-toolbar">
                  <span>
                    <strong>{filtered.length}</strong> {t("locuri")}{" "}
                    {filters.savedOnly ? t("salvate") : t("de explorat")}
                  </span>
                  <label className="sort-label">
                    <ArrowDownUp size={13} />
                    <select
                      aria-label={t("Sortează locațiile")}
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="recommended">{t("Recomandate")}</option>
                      <option value="rating">{t("Rating")}</option>
                      <option value="price">{t("Preț crescător")}</option>
                    </select>
                    <ChevronDown size={12} />
                  </label>
                </div>
                <div className="place-list">
                  {filtered.map((place) => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      saved={saved.includes(place.id)}
                      onSave={() => toggleSave(place.id)}
                      onSelect={() => select(place.id)}
                    />
                  ))}
                  {!filtered.length && (
                    <div className="empty-state">
                      <Search size={28} />
                      <h2>{t("Niciun loc găsit")}</h2>
                      <p>
                        {filters.savedOnly
                          ? t(
                              "Apasă pe inimă pentru a salva locurile preferate.",
                            )
                          : t("Încearcă altă căutare sau modifică filtrele.")}
                      </p>
                      <button onClick={() => setFilters(initialFilters)}>
                        {t("Explorează toate locurile")}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                  <div className="list-footer">
                    <Leaf size={17} />
                    <span>
                      {t("Cu drag de Moldova.")}
                      <br />
                      <small>{t("Și de oamenii care o fac specială.")}</small>
                    </span>
                  </div>
                </div>
              </>
            )}
            <div className="sidebar-bottom">
              <span className="live-dot" />
              {t("Date demonstrative")}{" "}
              <button onClick={() => setInfoOpen(true)}>
                {t("Despre proiect")}
                <ArrowUpRightIcon />
              </button>
            </div>
          </aside>
          <section
            className="map-region"
            aria-label={t("Explorează locațiile pe hartă")}
          >
            <div className="category-bar">
              <div className="category-scroll">
                {categories.map((c) => {
                  const Icon = categoryIcons[c.id];
                  return (
                    <button
                      key={c.id}
                      className={`category-chip ${filters.category === c.id ? "active" : ""}`}
                      aria-pressed={filters.category === c.id}
                      onClick={() => changeCategory(c.id)}
                    >
                      <Icon size={17} />
                      <span>{t(c.label)}</span>
                    </button>
                  );
                })}
              </div>
              <button
                aria-label={t("Filtre")}
                className={`filter-button ${activeFilters ? "has-filters" : ""}`}
                onClick={() => setFilterOpen(true)}
              >
                <SlidersHorizontal size={17} />
                <span>{t("Filtre")}</span>
                {activeFilters > 0 && <i>{activeFilters}</i>}
              </button>
            </div>
            <div className="mobile-map-search">
              <form
                className="search-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  void searchGeo();
                }}
              >
                <Search size={18} />
                <input
                  aria-label={t("Caută pe harta Moldovei")}
                  value={filters.query}
                  placeholder={t("Localitate, adresă sau loc…")}
                  onChange={(e) => changeQuery(e.target.value)}
                />
                <button
                  type="submit"
                  title={t("Caută pe hartă")}
                  disabled={geoBusy || filters.query.trim().length < 2}
                >
                  {geoBusy ? "…" : <ArrowRight size={18} />}
                </button>
              </form>
              <GeoSearchResults
                results={geoResults}
                error={geoError}
                onSelect={pickGeo}
              />
            </div>
            <TourismMap
              places={filtered}
              selectedId={selectedId}
              onSelect={select}
              searchPoint={searchPoint}
              routeDestination={routeDestination}
            />
            <div className="map-discovery">
              <span className="discovery-icon">
                <Sparkles size={20} />
              </span>
              <div>
                <strong>{t("Următoarea poveste începe aici.")}</strong>
                <p>{t("Alege un loc pe hartă și lasă-te surprins.")}</p>
              </div>
              <button
                title={t("Descoperă un loc")}
                onClick={() => {
                  if (filtered.length)
                    select(
                      filtered[Math.floor(Math.random() * filtered.length)].id,
                    );
                }}
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </section>
        </div>
      </section>
      <button
        className="mobile-view-toggle"
        onClick={() => setMobileView((v) => (v === "map" ? "list" : "map"))}
      >
        {mobileView === "map" ? <Menu size={17} /> : <Map size={17} />}{" "}
        {mobileView === "map" ? t("Vezi lista") : t("Vezi harta")}
      </button>
      {filterOpen && (
        <div className="modal-backdrop" onClick={() => setFilterOpen(false)}>
          <section
            className="filter-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Filtrează locațiile")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">
              <div>
                <span className="eyebrow">{t("PE GUSTUL TĂU")}</span>
                <h2>{t("O escapadă, așa cum vrei.")}</h2>
              </div>
              <button
                aria-label={t("Închide filtrele")}
                onClick={() => setFilterOpen(false)}
              >
                <X size={22} />
              </button>
            </div>
            <label className="filter-field">
              {t("Regiunea")}
              <select
                value={filters.region}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, region: e.target.value }))
                }
              >
                <option value="all">{t("Toată Moldova")}</option>
                <option value="Nord">{t("Nord")}</option>
                <option value="Centru">{t("Centru")}</option>
                <option value="Sud">{t("Sud")}</option>
              </select>
            </label>
            <div className="filter-field">
              {t("Rating minim")}
              <div className="rating-options">
                {[0, 4.5, 4.8, 4.9].map((r) => (
                  <button
                    className={filters.minRating === r ? "active" : ""}
                    key={r}
                    onClick={() => setFilters((f) => ({ ...f, minRating: r }))}
                  >
                    {r === 0 ? (
                      t("Oricare")
                    ) : (
                      <>
                        <Star size={14} />
                        {r}+
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <label className="filter-field">
              {t("Buget maxim")}
              <strong>{filters.maxPrice} MDL</strong>
              <input
                type="range"
                min="0"
                max="2000"
                step="50"
                value={filters.maxPrice}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    maxPrice: Number(e.target.value),
                  }))
                }
              />
              <small>
                {t("Prețuri orientative per activitate sau noapte.")}
              </small>
            </label>
            <div className="filter-actions">
              <button
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    region: "all",
                    minRating: 0,
                    maxPrice: 2000,
                  }))
                }
              >
                {t("Resetează")}
              </button>
              <button
                className="primary-button"
                onClick={() => setFilterOpen(false)}
              >
                {t("Arată {{count}} locuri", { count: filtered.length })}{" "}
                <ArrowRight size={17} />
              </button>
            </div>
          </section>
        </div>
      )}
      {infoOpen && (
        <div className="modal-backdrop" onClick={() => setInfoOpen(false)}>
          <section
            className="filter-modal about-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Despre Hai Moldova")}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-about"
              aria-label={t("Închide")}
              onClick={() => setInfoOpen(false)}
            >
              <X />
            </button>
            <Leaf size={40} />
            <h2>
              {t("O țară mică.")}
              <br />
              {t("Povești care merită trăite.")}
            </h2>
            <p>
              {t(
                "Hai Moldova aduce într-un singur loc vinării, pensiuni, experiențe și oameni care fac țara noastră specială.",
              )}
            </p>
            <div className="demo-explanation">
              <Info size={18} />
              <span>
                {t(
                  "Acesta este un prototip. Ratingurile, prețurile, programul și descrierile sunt demonstrative. Fotografiile sunt ilustrative, iar contactele vor fi adăugate după verificare.",
                )}
              </span>
            </div>
            <button
              className="primary-button"
              onClick={() => setInfoOpen(false)}
            >
              {t("Hai să explorăm")}
              <ArrowRight size={18} />
            </button>
          </section>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Info size={18} />
          {t(notice)}
          <button
            aria-label={t("Închide mesajul")}
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </main>
  );
}

function MapLoading() {
  const { t } = useI18n();
  return <div className="map-loading">{t("Pregătim harta…")}</div>;
}
