import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "../../runtime-api.js";
import { fetchListings, formatListing } from "../redfin-client.js";
import { loadSeen, saveSeen, type SeenState } from "../store.js";
import type { Listing, RedfinConfig, RedfinSearch } from "../types.js";

export function createNewListingsTool(api: OpenClawPluginApi) {
  const config = (api.pluginConfig ?? {}) as RedfinConfig;
  const maxResults = config.maxResults ?? 100;

  return {
    name: "redfin_new_listings",
    label: "Redfin New Listings",
    description:
      "Check saved Redfin searches and return only listings that are NEW since the last run " +
      "(deduped by Redfin property id, persisted on disk). Use this for a daily new-listings digest. " +
      "Runs all configured searches unless a specific searchName is given.",
    parameters: Type.Object({
      searchName: Type.Optional(
        Type.String({ description: "Limit to one saved search by name. Omit to run all configured searches." }),
      ),
      markSeen: Type.Optional(
        Type.Boolean({
          description: "Persist the current listings as seen (default true). Set false to preview without updating state.",
        }),
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const allSearches = config.searches ?? [];
      if (allSearches.length === 0) {
        throw new Error("No saved searches configured. Add entries to the redfin plugin's `searches` config.");
      }

      const searchName = typeof params.searchName === "string" ? params.searchName.trim() : "";
      let searches: RedfinSearch[];
      if (searchName) {
        const match = allSearches.find((s) => s.name === searchName);
        if (!match) {
          const names = allSearches.map((s) => s.name).join(", ");
          throw new Error(`No saved search named "${searchName}". Configured searches: ${names}.`);
        }
        searches = [match];
      } else {
        searches = allSearches;
      }

      const markSeen = params.markSeen === undefined ? true : params.markSeen === true;
      const state: SeenState = await loadSeen();
      const nowIso = new Date().toISOString();

      const perSearch: Array<{ search: string; newListings: Listing[]; total: number }> = [];

      for (const search of searches) {
        const listings = await fetchListings(search, config.userAgent, maxResults);
        const seen = state[search.name] ?? {};
        const fresh = listings.filter((l) => !(String(l.id) in seen));

        if (markSeen) {
          for (const l of listings) {
            if (!(String(l.id) in seen)) seen[String(l.id)] = nowIso;
          }
          state[search.name] = seen;
        }

        perSearch.push({ search: search.name, newListings: fresh, total: listings.length });
        api.logger?.debug?.(
          `redfin_new_listings: "${search.name}" -> ${fresh.length} new of ${listings.length}`,
        );
      }

      if (markSeen) await saveSeen(state);

      const totalNew = perSearch.reduce((n, s) => n + s.newListings.length, 0);

      if (totalNew === 0) {
        return {
          content: [{ type: "text", text: "No new Redfin listings since the last check." }],
          details: { totalNew: 0, searches: perSearch.map((s) => ({ search: s.search, new: 0, total: s.total })) },
        };
      }

      const sections = perSearch
        .filter((s) => s.newListings.length > 0)
        .map((s) => {
          const body = s.newListings.map(formatListing).join("\n\n");
          return `=== ${s.search}: ${s.newListings.length} new ===\n\n${body}`;
        });

      return {
        content: [
          {
            type: "text",
            text: `${totalNew} new Redfin listing(s):\n\n${sections.join("\n\n")}`,
          },
        ],
        details: {
          totalNew,
          searches: perSearch.map((s) => ({
            search: s.search,
            new: s.newListings.length,
            total: s.total,
            listings: s.newListings,
          })),
        },
      };
    },
  };
}
