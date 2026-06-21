import { definePluginEntry, type AnyAgentTool, type OpenClawPluginApi } from "./runtime-api.js";
import { createSearchTool } from "./src/tools/search.js";
import { createNewListingsTool } from "./src/tools/new-listings.js";

export default definePluginEntry({
  id: "redfin",
  name: "Redfin Listings",
  description: "Fetch Redfin for-sale listings and surface newly-listed homes for saved searches.",
  register(api: OpenClawPluginApi) {
    api.registerTool(createSearchTool(api) as AnyAgentTool, { optional: true });
    api.registerTool(createNewListingsTool(api) as AnyAgentTool, { optional: true });
  },
});
