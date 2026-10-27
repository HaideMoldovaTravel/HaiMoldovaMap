import { Explorer } from "@/components/explore/explorer";
import { catalogConfig, publicCatalog } from "@/server/catalog";
export const dynamic = "force-dynamic";
export default async function Home() {
  if (!process.env.DATABASE_URL) return <Explorer />;
  const [places, config] = await Promise.all([
    publicCatalog(),
    catalogConfig(),
  ]);
  return (
    <Explorer
      initialPlaces={places}
      initialCategories={[
        { id: "all", label: "Toate locurile", labelEn: "All places" },
        ...config.map((c) => ({ id: c.id, label: c.name, labelEn: c.nameEn, icon:c.iconAssetId?`/api/media/${c.iconAssetId}`:undefined })),
      ]}
    />
  );
}
