import type { Coords } from "./schemas";

const CURRENT_VARS = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "precipitation",
  "is_day",
  "weather_code",
].join(",");

export type CurrentWeather = {
  tempC: number;
  humidity: number | null;
  precipitationMm: number | null;
  feelsLikeC: number | null;
  isRaining: boolean;
  isDay: boolean | null;
  code: number | null;
  tz: string;
  source: "open-meteo";
};

export async function getCurrentWeather(
  { lat, lon }: Coords,
  timezone: "auto" | string = "auto"
): Promise<CurrentWeather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", CURRENT_VARS);
  url.searchParams.set("timezone", timezone); 

  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather http ${res.status}`);
  const data = await res.json();

  const c = data?.current ?? {};
  const tempC = Number(c.temperature_2m);
  const precipitation = Number.isFinite(c.precipitation) ? Number(c.precipitation) : null;
  const weatherCode = Number.isFinite(c.weather_code) ? Number(c.weather_code) : null;

  const rainyCodes = new Set([51,53,55,56,57,61,63,65,80,81,82,66,67]);
  const isRaining = (precipitation ?? 0) > 0 || (weatherCode ? rainyCodes.has(weatherCode) : false);

  return {
    tempC: Number.isFinite(tempC) ? tempC : NaN,
    humidity: Number.isFinite(c.relative_humidity_2m) ? Number(c.relative_humidity_2m) : null,
    precipitationMm: precipitation,
    feelsLikeC: Number.isFinite(c.apparent_temperature) ? Number(c.apparent_temperature) : null,
    isRaining,
    isDay: typeof c.is_day === "number" ? c.is_day === 1 : null,
    code: weatherCode,
    tz: data?.timezone ?? "GMT",
    source: "open-meteo",
  };
}
