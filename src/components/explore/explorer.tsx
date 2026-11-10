"use client";
/* eslint-disable @next/next/no-img-element */
import { useI18n } from "@/features/i18n/provider";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
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
  X,
  Leaf,
  Map,
  Info,
  List,
  Plus,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import {
  categories as demoCategories,
  places as demoPlaces,
  filterPlaces,
} from "@/features/places/data";
import {
  initialExperienceFilters,
  matchesExperienceFilters,
  matchesExploreGroup,
  type ExploreFacets,
  type ExploreGroup,
} from "@/features/places/exploration";
import type { CategoryId, Place, PlaceFilters } from "@/features/places/types";
import { categoryIcons, ArrowUpRightIcon } from "./icons";
import { FilterDialog } from "./filter-dialog";
import { MetaPixel } from "./meta-pixel";
import { PlaceCard } from "./place-card";
import { PlaceDetails } from "./place-details";
import { GeoSearchResults } from "./search-results";
import { searchAddress } from "@/features/map/client";
import { localizePlace } from "@/features/places/localization";
import type { MapPoint } from "@/features/map/types";
import {
  fullFeatures,
  type ExplorerFeatures,
} from "@/features/places/features";
const TourismMap = dynamic(() => import("./tourism-map"), {
  ssr: false,
  loading: MapLoading,
});
const initialFilters: PlaceFilters = {
  query: "",
  category: "all",
  region: "all",
  minRating: 0,
  maxPrice: Number.POSITIVE_INFINITY,
  savedOnly: false,
};
export function Explorer({
  initialPlaces = demoPlaces,
  initialCategories = demoCategories,
  features = fullFeatures,
  embedded = false,
  initialMobileView = "map",
  siteUrl = "/",
}: {
  initialPlaces?: Place[];
  initialCategories?: {
    id: string;
    label: string;
    labelEn?: string;
    icon?: string;
  }[];
  features?: ExplorerFeatures;
  embedded?: boolean;
  initialMobileView?: "list" | "map";
  siteUrl?: string;
}) {
  const f = features;
  const router = useRouter();
  const categories = initialCategories;
  const places = useMemo(
    () => initialPlaces.filter((p) => matchesExploreGroup(p, "all")),
    [initialPlaces],
  );
  const [group, setGroup] = useState<ExploreGroup>("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const [facets, setFacets] = useState(initialExperienceFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const originView = useRef<"map" | "list">(initialMobileView);
  const listScroll = useRef(0);
  const sidebarRef = useRef<HTMLElement>(null);
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
  const [sort, setSort] = useState("recommended");
  const [notice, setNotice] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "map">(
    initialMobileView,
  );
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
    [locale, places],
  );
  const getMatches = useCallback(
    (next: ExploreFacets) =>
      filterPlaces(
        localizedPlaces.filter(
          (p) =>
            matchesExploreGroup(p, group) && matchesExperienceFilters(p, next),
        ),
        {
          ...filters,
          minPrice: next.minPrice,
          maxPrice: next.maxPrice ?? Infinity,
        },
        saved,
      ),
    [filters, saved, localizedPlaces, group],
  );
  const filtered = useMemo(
    () =>
      getMatches(facets).sort((a, b) =>
        sort === "rating"
          ? b.rating - a.rating
          : sort === "price"
            ? a.price - b.price
            : Number(b.featured || false) - Number(a.featured || false),
      ),
    [getMatches, facets, sort],
  );
  const resultCount = filtered.length;
  const needsDe =
    locale === "ro" &&
    resultCount >= 20 &&
    (resultCount % 100 === 0 || resultCount % 100 >= 20);
  const activeFilters =
    Number(facets.subcategories.length > 0) +
    Number(Boolean(facets.bookingMode)) +
    Number(facets.guests > 0) +
    Number((facets.minPrice ?? 0) > 0 || facets.maxPrice !== undefined);
  const canFilter = f.advancedFilters && (group !== "stay" || f.prices);
  const filterButton = canFilter && (
    <button
      type="button"
      className={`filter-button ${activeFilters ? "has-filters" : ""}`}
      aria-label={t("Filtre")}
      aria-haspopup="dialog"
      onClick={() => setFilterOpen(true)}
    >
      <SlidersHorizontal size={17} />
      <span>{t("Filtre")}</span>
      {activeFilters > 0 && <i aria-hidden="true">{activeFilters}</i>}
    </button>
  );
  const select = useCallback((id: string, source: "map" | "list") => {
    originView.current = source;
    listScroll.current =
      sidebarRef.current?.querySelector(".place-list")?.scrollTop ?? 0;
    setSelectedId(id);
    setDetailOpen(source === "list");
    setMobileView(source);
  }, []);
  const selectFromMap = useCallback(
    (id: string) => select(id, "map"),
    [select],
  );
  const closeDetails = () => {
    setDetailOpen(false);
    setSelectedId(null);
    setMobileView(originView.current);
    requestAnimationFrame(() => {
      const list = sidebarRef.current?.querySelector(".place-list");
      if (list) list.scrollTop = listScroll.current;
    });
  };
  const selected = localizedPlaces.find((p) => p.id === selectedId);
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
    if (p.routeAvailable === false) return;
    setRouteDestination({
      id: p.id,
      label: p.name,
      coordinates: p.coordinates,
    });
    setDetailOpen(false);
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
    <main
      className={`explorer mobile-${mobileView} ${selected && detailOpen ? "detail-open" : ""} ${embedded ? "is-embedded" : ""} ${f.header ? "" : "no-header"}`}
    >
      <nav className="rail" aria-label={t("Navigare principală")}>
        <button
          className="brand-mark"
          aria-label="Haide, pagina principală"
          onClick={() => {
            setFilters(initialFilters);
            setGroup("all");
            setFacets(initialExperienceFilters);
            setSelectedId(null);
            setDetailOpen(false);
            setSearchPoint(null);
            setRouteDestination(null);
            setGeoResults([]);
            setMobileView("map");
          }}
        >
          <img src="/haide-symbol.svg" alt="" width="44" height="40" />
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
          {f.favorites && (
            <button
              className={filters.savedOnly ? "rail-item active" : "rail-item"}
              onClick={() => {
                setFilters({ ...initialFilters, savedOnly: true });
                setFacets(initialExperienceFilters);
                setSelectedId(null);
                setMobileView("list");
              }}
            >
              <Bookmark size={22} />
              {saved.length > 0 && <i>{saved.length}</i>}
              <span>{t("Salvate")}</span>
            </button>
          )}
        </div>
        <div className="rail-bottom">
          {f.about && (
            <button className="rail-item" onClick={() => setInfoOpen(true)}>
              <Info size={21} />
              <span>{t("Despre noi")}</span>
            </button>
          )}
          {f.account && (
            <button
              className="avatar"
              title={t("Contul meu")}
              onClick={() => router.push("/cont")}
            >
              A
            </button>
          )}
        </div>
      </nav>
      <section className="workspace">
        {f.header && (
          <header className="topbar">
            <div className="wordmark">
              <img
                className="haide-logo"
                src="/haide-logo.svg"
                alt="Haide"
                width="116"
                height="36"
              />
            </div>
            <div className="header-right">
              {!embedded && <MetaPixel />}
              {f.contribute && (
                <a
                  className="contribute-link"
                  href={
                    embedded ? `${siteUrl.replace(/\/$/, "")}/cont` : "/cont"
                  }
                  target={embedded ? "_blank" : undefined}
                  rel={embedded ? "noopener" : undefined}
                >
                  {locale === "en" ? "Add experience" : "Adaugă experiență"}
                </a>
              )}
              <span className="header-tagline">
                {t("Mai aproape de locurile care contează.")}
              </span>
              {f.languageSwitch && (
                <label className="language-select">
                  <select
                    aria-label="Language / Limbă"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as "ro" | "en")}
                  >
                    <option value="ro">RO</option>
                    <option value="en">EN</option>
                  </select>
                  <ChevronDown size={14} />
                </label>
              )}
              {f.languageSwitch && (
                <div
                  className="language-switch"
                  role="group"
                  aria-label="Language / Limbă"
                >
                  {(["ro", "en"] as const).map((language) => (
                    <button
                      key={language}
                      lang={language}
                      aria-label={{ ro: "Română", en: "English" }[language]}
                      aria-pressed={locale === language}
                      className={locale === language ? "active" : ""}
                      onClick={() => setLocale(language)}
                    >
                      {language.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              {!embedded && (
                <span className="demo-pill">
                  <span />
                  {t("Preview")}
                </span>
              )}
            </div>
          </header>
        )}

        <div className="explore-content">
          <aside
            ref={sidebarRef}
            className={`sidebar ${selected && detailOpen ? "has-detail" : ""}`}
          >
            {f.search && (
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
            )}
            {selected && detailOpen ? (
              <PlaceDetails
                place={selected}
                saved={saved.includes(selected.id)}
                onSave={() => toggleSave(selected.id)}
                onClose={closeDetails}
                onDemo={setNotice}
                onRoute={() => planRoute(selected)}
                features={f}
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
                    <strong>{resultCount}</strong>{" "}
                    {group === "experience" ? (
                      <>
                        {needsDe && "de "}
                        {t(resultCount === 1 ? "experiență" : "experiențe")}
                        {filters.savedOnly &&
                          ` ${t(resultCount === 1 ? "salvată" : "salvate")}`}
                      </>
                    ) : (
                      <>
                        {t("locuri")}{" "}
                        {filters.savedOnly ? t("salvate") : t("de explorat")}
                      </>
                    )}
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
                      {f.prices && (
                        <option value="price">{t("Preț crescător")}</option>
                      )}
                    </select>
                    <ChevronDown size={12} />
                  </label>
                  {canFilter && (
                    <div className="list-filter-trigger">{filterButton}</div>
                  )}
                </div>
                <div className="place-list">
                  {filtered.map((place) => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      saved={saved.includes(place.id)}
                      onSave={() => toggleSave(place.id)}
                      onSelect={() => select(place.id, "list")}
                      showSave={f.favorites}
                      showPrice={f.prices}
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
                      <button
                        onClick={() => {
                          setFilters(initialFilters);
                          setGroup("all");
                          setFacets(initialExperienceFilters);
                        }}
                      >
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
              {places.some((p) => p.demo !== false)
                ? t("Date demonstrative")
                : t("Locații verificate")}{" "}
              {f.about && (
                <button onClick={() => setInfoOpen(true)}>
                  {t("Despre proiect")}
                  <ArrowUpRightIcon />
                </button>
              )}
            </div>
          </aside>
          <section
            className="map-region"
            aria-label={t("Explorează locațiile pe hartă")}
          >
            {(f.categoryFilter || canFilter) && (
              <div className="category-bar">
                {f.categoryFilter && (
                  <div className="category-scroll">
                    {[
                      {
                        id: "experience",
                        label: "Experiențe",
                        labelEn: "Experiences",
                      },
                      { id: "stay", label: "Cazări", labelEn: "Stays" },
                    ].map((c) => {
                      const Icon = categoryIcons[c.id] ?? Compass;
                      return (
                        <button
                          key={c.id}
                          className={`category-chip ${group === c.id ? "active" : ""}`}
                          aria-pressed={group === c.id}
                          onClick={() => {
                            const nextGroup =
                              group === c.id ? "all" : (c.id as ExploreGroup);
                            setGroup(nextGroup);
                            if (nextGroup === "stay") {
                              setFacets(({ minPrice, maxPrice }) => ({
                                ...initialExperienceFilters,
                                minPrice,
                                maxPrice,
                              }));
                            }
                            changeCategory("all");
                          }}
                        >
                          <Icon size={17} />
                          <span>{locale === "en" ? c.labelEn : c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {filterButton}
              </div>
            )}
            {f.search && (
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
            )}
            <TourismMap
              places={filtered}
              selectedId={selectedId}
              onSelect={selectFromMap}
              searchPoint={searchPoint}
              routeDestination={routeDestination}
              allowRoutes={f.route}
            />
            {selected && !detailOpen && (
              <div className="map-place-preview">
                <button
                  className="preview-close"
                  aria-label={t("Închide")}
                  onClick={closeDetails}
                >
                  <X size={20} />
                </button>
                <PlaceCard
                  place={selected}
                  saved={saved.includes(selected.id)}
                  onSave={() => toggleSave(selected.id)}
                  onSelect={() => {
                    setDetailOpen(true);
                    setMobileView("list");
                  }}
                  showSave={f.favorites}
                  showPrice={f.prices}
                />
              </div>
            )}
            {f.branding && (
              <a
                className="embed-branding"
                href={siteUrl}
                target="_blank"
                rel="noopener"
              >
                <Leaf size={13} />
                <span>{t("Hartă oferită de")}</span>
                <strong>Hai Moldova</strong>
              </a>
            )}
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
      {!embedded && (
        <nav className="mobile-tabbar" aria-label={t("Navigare principală")}>
          <button
            className={
              mobileView === "map" && !filters.savedOnly ? "active" : ""
            }
            aria-current={mobileView === "map" && !filters.savedOnly}
            onClick={() => {
              setFilters((f) => ({ ...f, savedOnly: false }));
              setSelectedId(null);
              setMobileView("map");
            }}
          >
            <Map size={21} />
            <span>{t("Hartă")}</span>
          </button>
          <button
            className={
              mobileView === "list" && !filters.savedOnly ? "active" : ""
            }
            aria-current={mobileView === "list" && !filters.savedOnly}
            onClick={() => {
              setFilters((f) => ({ ...f, savedOnly: false }));
              setSelectedId(null);
              setMobileView("list");
            }}
          >
            <List size={21} />
            <span>{t("Listă")}</span>
          </button>
          {f.contribute && (
            <a className="tabbar-add" href="/cont">
              <span>
                <Plus size={22} />
              </span>
              <small>{t("Adaugă")}</small>
            </a>
          )}
          {f.favorites && (
            <button
              className={filters.savedOnly ? "active" : ""}
              aria-current={filters.savedOnly}
              onClick={() => {
                setFilters({ ...initialFilters, savedOnly: true });
                setFacets(initialExperienceFilters);
                setSelectedId(null);
                setMobileView("list");
              }}
            >
              <Bookmark size={21} />
              {saved.length > 0 && <i>{saved.length}</i>}
              <span>{t("Salvate")}</span>
            </button>
          )}
          {f.account ? (
            <button onClick={() => router.push("/cont")}>
              <UserRound size={21} />
              <span>{t("Cont")}</span>
            </button>
          ) : (
            f.about && (
              <button onClick={() => setInfoOpen(true)}>
                <Info size={21} />
                <span>{t("Despre")}</span>
              </button>
            )
          )}
        </nav>
      )}
      {filterOpen && canFilter && (
        <FilterDialog
          applied={facets}
          showExperiences={group !== "stay"}
          showPrices={f.prices}
          countResults={(draft) => getMatches(draft).length}
          onApply={(draft) => {
            setFacets(draft);
            setSelectedId(null);
          }}
          onClose={() => setFilterOpen(false)}
        />
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
