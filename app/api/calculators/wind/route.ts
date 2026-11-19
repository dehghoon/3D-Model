import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const base = () => (process.env.WIND_CALCULATOR_API_URL || "https://wind-calculator.vercel.app").replace(/\/$/, "");

type Station = { id: string; location: string; provinceOrTerritory: string; q50KPa: number };
async function stations(): Promise<Station[]> {
  const response = await fetch(`${base()}/api/v1/climate/nbc-2020/wind-pressure`, {
    next: { revalidate: 86400 }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Wind station catalog unavailable.");
  const { records, source } = await response.json();
  if (!Array.isArray(records) || source?.printing !== 2) throw new Error("Wind station catalog unavailable.");
  return records;
}

export async function GET() {
  try {
    return NextResponse.json({ stations: (await stations()).map(({ id, location, provinceOrTerritory }) =>
      ({ id, location, provinceOrTerritory })) });
  } catch {
    return NextResponse.json({ error: "Wind station catalog unavailable." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const input = await request.json().catch(() => null);
  const { stationId, dimensions, terrain, importance, topography } = input ?? {};
  if (typeof stationId !== "string" || !dimensions ||
      ![dimensions.x, dimensions.y, dimensions.z, importance, topography].every(value => Number.isFinite(value) && value > 0) ||
      !["open", "rough"].includes(terrain)) {
    return NextResponse.json({ error: "Check the station, geometry and wind factors." }, { status: 400 });
  }
  try {
    const station = (await stations()).find(record => record.id === stationId);
    if (!station || !Number.isFinite(station.q50KPa) || station.q50KPa <= 0) {
      return NextResponse.json({ error: "Select a named NBC 2020 wind station." }, { status: 422 });
    }
    async function directionalPressure(axis: "x" | "y") {
      const response = await fetch(`${base()}/api/v1/calculations/general-static/run`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          code_edition: "NBC_2020", pressure_application: "building_as_whole",
          height: dimensions.z, wind_parallel_dimension: dimensions[axis], terrain,
          importance_factor: importance, reference_velocity_pressure: station!.q50KPa,
          topographic_factor: topography,
        }),
      });
      if (!response.ok) throw new Error("Wind Calculator rejected the building inputs.");
      const data = await response.json();
      return { windward: data.windward.pressure, leeward: data.leeward.pressure, parallel: data.parallel_wall.pressure };
    }
    const [x, y] = await Promise.all([directionalPressure("x"), directionalPressure("y")]);
    return NextResponse.json({ station, pressures: { x, y } });
  } catch {
    return NextResponse.json({ error: "Wind Calculator could not return external wall pressures. Check the inputs and try again." }, { status: 502 });
  }
}
