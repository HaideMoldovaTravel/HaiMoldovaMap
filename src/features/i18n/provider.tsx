"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Locale } from "./messages";
import { translate } from "./translate";
const I18nContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (
    text: string | undefined,
    params?: Record<string, string | number>,
  ) => string;
} | null>(null);
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLanguage] = useState<Locale>("ro");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hai-moldova-language");
      if (saved === "ro" || saved === "en" || saved === "ru")
        queueMicrotask(() => setLanguage(saved));
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(
      "Hai Moldova — Descoperă locuri, trăiește povești",
      locale,
    );
  }, [locale]);
  const setLocale = useCallback((value: Locale) => {
    setLanguage(value);
    try {
      localStorage.setItem("hai-moldova-language", value);
    } catch {}
  }, []);
  const t = useCallback(
    (text: string | undefined, params?: Record<string, string | number>) =>
      translate(text, locale, params),
    [locale],
  );
  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider missing");
  return value;
}
