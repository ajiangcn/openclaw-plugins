/**
 * Curated city/region lookup so the tools accept plain city names instead of
 * raw Redfin region ids. Redfin's location-autocomplete endpoint is bot-blocked,
 * so these ids were resolved from public Redfin region pages and are cached here.
 *
 * - Larger cities use their Redfin "city" region (regionType 6).
 * - Small single-ZIP boroughs use their ZIP region (regionType 2), which maps
 *   cleanly to the town boundary.
 *
 * To add a city: open it on redfin.com and read the id from the URL
 * (e.g. redfin.com/city/16163/WA/Seattle => regionId 16163, regionType 6), or for
 * a single-ZIP town use the ZIP region (regionType 2) shown on its zipcode page.
 */
export interface RegionEntry {
  regionId: number;
  regionType: number;
  state: string;
  /** Optional Redfin market slug; not required by the API. */
  market?: string;
}

export const REGIONS: Record<string, RegionEntry> = {
  // New Jersey (Bergen County)
  closter: { regionId: 2714, regionType: 2, state: "NJ" },
  demarest: { regionId: 2716, regionType: 2, state: "NJ" },
  haworth: { regionId: 2722, regionType: 2, state: "NJ" },
  tenafly: { regionId: 18484, regionType: 6, state: "NJ" },
  // Washington (Puget Sound / Eastside)
  seattle: { regionId: 16163, regionType: 6, state: "WA", market: "seattle" },
  bellevue: { regionId: 1387, regionType: 6, state: "WA", market: "seattle" },
  kirkland: { regionId: 9148, regionType: 6, state: "WA", market: "seattle" },
  redmond: { regionId: 14913, regionType: 6, state: "WA", market: "seattle" },
};

/** Normalize a free-form city string ("Closter, NJ") to a lookup key ("closter"). */
function normalizeKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/,?\s*(nj|wa|new jersey|washington)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveRegion(name: string): RegionEntry | undefined {
  return REGIONS[normalizeKey(name)];
}

export function regionNames(): string[] {
  return Object.keys(REGIONS);
}
