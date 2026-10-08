import type { Metadata } from "next";
import "./globals.css";
import { Montserrat } from "next/font/google";
import { I18nProvider } from "@/features/i18n/provider";
const montserrat = Montserrat({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-montserrat",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Hai Moldova — Descoperă locuri, trăiește povești",
  description:
    "Explorează Moldova pe o hartă interactivă. Vinării, pensiuni, natură și experiențe locale.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body className={montserrat.variable}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
