import { NextRequest, NextResponse } from "next/server";
import { serviceHeaders } from "@/features/map/server";
import { parseCoordinates } from "@/features/map/validation";
import type { MapRoute, RouteStep } from "@/features/map/types";
export async function GET(request: NextRequest) {
  const from = parseCoordinates(request.nextUrl.searchParams.get("from"));
  const to = parseCoordinates(request.nextUrl.searchParams.get("to"));
  if (!from || !to)
    return NextResponse.json(
      { error: "Punctele traseului nu sunt valide." },
      { status: 400 },
    );
  try {
    const coordinates = `${from[1]},${from[0]};${to[1]},${to[0]}`;
    const response = await fetch(
      `${process.env.OSRM_URL || "https://router.project-osrm.org"}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&alternatives=true`,
      {
        headers: serviceHeaders,
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("Routing unavailable");
    const data: {
      code: string;
      routes: (MapRoute & { legs: { steps: RouteStep[] }[] })[];
    } = await response.json();
    if (data.code !== "Ok" || !data.routes.length)
      return NextResponse.json(
        { error: "Nu am găsit un traseu auto între aceste puncte." },
        { status: 404 },
      );
    const routes: MapRoute[] = data.routes.slice(0, 3).map((route) => ({
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
      steps: route.legs.flatMap((leg) => leg.steps),
    }));
    return NextResponse.json(routes, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Calcularea traseului nu este disponibilă momentan. Încearcă din nou.",
      },
      { status: 503 },
    );
  }
}
