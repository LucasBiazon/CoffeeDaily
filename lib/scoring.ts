import type { CurrentWeather } from "./weather";
import type { CoffeeCatalogItem } from "./catalog";
import type { PreferencesInput } from "./schemas";

type Scored = { coffee: CoffeeCatalogItem; score: number };

export function climateBucket(tempC: number): "cold" | "mild" | "hot" {
  if (!Number.isFinite(tempC)) return "mild";
  if (tempC <= 18) return "cold";
  if (tempC >= 24) return "hot";
  return "mild";
}

export function baseScoreCoffee(
  it: CoffeeCatalogItem,
  weather: CurrentWeather,
  prefs: PreferencesInput
): number {
  const t = climateBucket(weather.tempC);
  let s = 0;

  if (t === "cold" && it.tempAllowed.includes("hot")) s += 0.45;
  if (t === "hot" && it.tempAllowed.includes("iced")) s += 0.45;
  if (weather.isRaining && it.tags.includes("chocolate")) s += 0.1;

  if (prefs.tempPref && it.tempAllowed.includes(prefs.tempPref)) s += 0.2;
  if (prefs.flavorNotes?.length) {
    const hits = prefs.flavorNotes.filter((n) => it.tags.includes(n.toLowerCase())).length;
    s += Math.min(0.2, 0.05 * hits);
  }
  if (prefs.dairy === "lactoseFree" && it.tags.includes("milk")) s -= 0.2;
  if (prefs.dairy === "none" && it.tags.includes("milk")) s -= 0.35;

  return Math.max(0, Math.min(1, s));
}

export function scoreCandidates(
  catalog: CoffeeCatalogItem[],
  weather: CurrentWeather,
  prefs: PreferencesInput,
  k: number = 8
): Scored[] {
  return catalog
    .map((coffee) => ({ coffee, score: baseScoreCoffee(coffee, weather, prefs) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
