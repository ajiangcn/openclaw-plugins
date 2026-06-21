import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "../../runtime-api.js";
import { fetchListings, formatListing } from "../redfin-client.js";
import { regionNames, resolveRegion } from "../regions.js";
import type { RedfinConfig, RedfinSearch } from "../types.js";

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function numberArray(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  return out.length > 0 ? out : undefined;
}

export function createSearchTool(api: OpenClawPluginApi) {
  const config = (api.pluginConfig ?? {}) as RedfinConfig;
  const maxResults = config.maxResults ?? 100;

  return {
    name: "redfin_search",
    label: "Redfin Search",
    description:
      "Search Redfin for-sale listings. Provide a known `city` name (e.g. \"Closter\", \"Seattle\"), " +
      "or a saved search by `searchName` (from plugin config), " +
      "or raw `regionId` + `regionType` (from a Redfin search URL like redfin.com/city/16163/WA/Seattle) " +
      "plus optional price/bed/bath/property-type filters. Returns matching active listings.",
    parameters: Type.Object({
      city: Type.Optional(
        Type.String({ description: `Known city name; resolves region id automatically. Options: ${regionNames().join(", ")}.` }),
      ),
      searchName: Type.Optional(
        Type.String({ description: "Name of a saved search defined in plugin config. Overrides inline filters." }),
      ),
      regionId: Type.Optional(Type.Number({ description: "Redfin region id from the search URL." })),
      regionType: Type.Optional(
        Type.Number({ description: "Region type: 2=zip, 6=city, 5=county, 4=state, 1=neighborhood." }),
      ),
      market: Type.Optional(Type.String({ description: 'Redfin market slug, e.g. "seattle".' })),
      minPrice: Type.Optional(Type.Number({ description: "Minimum list price." })),
      maxPrice: Type.Optional(Type.Number({ description: "Maximum list price." })),
      minBeds: Type.Optional(Type.Number({ description: "Minimum bedrooms." })),
      minBaths: Type.Optional(Type.Number({ description: "Minimum bathrooms." })),
      propertyTypes: Type.Optional(
        Type.Array(Type.Number(), {
          description: "1=House, 2=Condo, 3=Townhouse, 4=Multi-family, 5=Land, 6=Other, 7=Mobile, 8=Co-op.",
        }),
      ),
      maxDaysOnMarket: Type.Optional(Type.Number({ description: "Only include listings on market <= N days." })),
      limit: Type.Optional(Type.Number({ description: "Max listings to display (default 25).", minimum: 1, maximum: 200 })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      let search: RedfinSearch | undefined;

      const searchName = typeof params.searchName === "string" ? params.searchName.trim() : "";
      const cityName = typeof params.city === "string" ? params.city.trim() : "";
      if (searchName) {
        search = (config.searches ?? []).find((s) => s.name === searchName);
        if (!search) {
          const names = (config.searches ?? []).map((s) => s.name).join(", ") || "(none configured)";
          throw new Error(`No saved search named "${searchName}". Configured searches: ${names}.`);
        }
      } else if (cityName) {
        const region = resolveRegion(cityName);
        if (!region) {
          throw new Error(`Unknown city "${cityName}". Known cities: ${regionNames().join(", ")}.`);
        }
        search = {
          name: cityName,
          regionId: region.regionId,
          regionType: region.regionType,
          market: region.market,
          minPrice: num(params.minPrice),
          maxPrice: num(params.maxPrice),
          minBeds: num(params.minBeds),
          minBaths: num(params.minBaths),
          propertyTypes: numberArray(params.propertyTypes),
          maxDaysOnMarket: num(params.maxDaysOnMarket),
        };
      } else {
        const regionId = num(params.regionId);
        const regionType = num(params.regionType);
        if (regionId == null || regionType == null) {
          throw new Error("Provide a city name, or searchName, or both regionId and regionType.");
        }
        search = {
          name: "ad-hoc",
          regionId,
          regionType,
          market: typeof params.market === "string" ? params.market : undefined,
          minPrice: num(params.minPrice),
          maxPrice: num(params.maxPrice),
          minBeds: num(params.minBeds),
          minBaths: num(params.minBaths),
          propertyTypes: numberArray(params.propertyTypes),
          maxDaysOnMarket: num(params.maxDaysOnMarket),
        };
      }

      const listings = await fetchListings(search, config.userAgent, maxResults);
      const limit = num(params.limit) ?? 25;
      const shown = listings.slice(0, limit);

      api.logger?.debug?.(`redfin_search: "${search.name}" -> ${listings.length} listings`);

      if (shown.length === 0) {
        return {
          content: [{ type: "text", text: `No active Redfin listings matched search "${search.name}".` }],
          details: { search: search.name, count: 0, listings: [] },
        };
      }

      const body = shown.map(formatListing).join("\n\n");
      const header = `${shown.length} of ${listings.length} listing(s) for "${search.name}":`;
      return {
        content: [{ type: "text", text: `${header}\n\n${body}` }],
        details: { search: search.name, count: listings.length, listings: shown },
      };
    },
  };
}
