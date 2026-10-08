import { NextRequest, NextResponse } from "next/server";
import { cachedSearch, serviceHeaders } from "@/features/map/server";
import type { MapPoint } from "@/features/map/types";
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2 || query.length > 150)
    return NextResponse.json(
      { error: "Introdu cel puțin 2 caractere și cel mult 150." },
      { status: 400 },
    );
  try {
    const results = await cachedSearch<MapPoint[]>(
      query.toLocaleLowerCase("ro"),
      async () => {
        const params = new URLSearchParams({
          q: query,
          countrycode: "MD",
          limit: "5",
          lat: "47.02",
          lon: "28.83",
        });
        const response = await fetch(
          `${process.env.PHOTON_URL || "https://photon.komoot.io"}/api/?${params}`,
          { headers: serviceHeaders, signal: AbortSignal.timeout(10000) },
        );
        if (!response.ok) throw new Error("Geocoding unavailable");
        const data: {
          features: {
            properties: {
              osm_id: number;
              osm_type: string;
              name?: string;
              street?: string;
              housenumber?: string;
              city?: string;
              state?: string;
            };
            geometry: { coordinates: [number, number] };
          }[];
        } = await response.json();
        return data.features.map(({ properties: p, geometry: g }) => ({
          id: `${p.osm_type}${p.osm_id}`,
          label: [
            p.name,
            [p.street, p.housenumber].filter(Boolean).join(" "),
            p.city || p.state,
          ]
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(", "),
          coordinates: [g.coordinates[1], g.coordinates[0]],
        }));
      },
    );
    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Căutarea pe hartă nu este disponibilă momentan. Încearcă din nou.",
      },
      { status: 503 },
    );
  }
}
