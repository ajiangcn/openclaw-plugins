# redfin

OpenClaw plugin that fetches **for-sale listings from Redfin** for one or more
saved searches and can surface **only the newly-listed homes** since the last
check. Pair it with a daily cron job to get a "new listings" digest pushed to
you automatically.

## Tools

| Tool | What it does |
| --- | --- |
| `redfin_search` | Run a Redfin search by `city` name, by saved `searchName`, or ad-hoc by `regionId`+`regionType`, and return matching active listings. |
| `redfin_new_listings` | Run your saved searches and return only listings that are **new** since the last run (deduped by Redfin property id, persisted to `~/.openclaw/redfin-seen.json`). Ideal for a daily digest. |

## Known cities

Redfin's location-autocomplete endpoint is bot-blocked, so the plugin ships a
cached city -> region map in [`src/regions.ts`](./src/regions.ts). Pass any of
these names as the `city` parameter to `redfin_search` and the region id is
resolved for you (no lookup needed):

| Region | Cities |
| --- | --- |
| New Jersey (Bergen County) | Closter, Demarest, Haworth, Tenafly |
| Washington (Puget Sound / Eastside) | Seattle, Bellevue, Kirkland, Redmond |

Add more by opening a city on redfin.com and reading the id from the URL
(`redfin.com/city/16163/WA/Seattle` => regionId 16163, regionType 6), or for a
single-ZIP town use the ZIP region (regionType 2) from its zipcode page.

## How it works

Redfin's location-autocomplete endpoint is bot-blocked, so you provide the
**region id + region type** directly from a Redfin search URL. Open the area you
want on redfin.com and read it off the URL:

```
https://www.redfin.com/city/16163/WA/Seattle
                            ^^^^^      regionId = 16163
                       ^^^^            regionType = 6  (city)
```

Region types: `2` = zip code, `6` = city, `5` = county, `4` = state,
`1` = neighborhood. The `market` slug (e.g. `seattle`) also appears in Redfin
URLs and is recommended.

The plugin reads Redfin's public map-data (`gis`) JSON endpoint with a browser
User-Agent, filters by your criteria, and normalizes each home (price, beds,
baths, sqft, days-on-market, URL, etc.).

> Note: this scrapes Redfin's unofficial endpoint. Keep request volume modest
> (a daily run per search is fine) and respect Redfin's Terms of Service.

## Layout

```
redfin/
  openclaw.plugin.json   # manifest: id, name, configSchema, uiHints
  package.json           # name/id aligned, runtime deps in "dependencies"
  index.ts               # plugin entry (registers the two tools)
  runtime-api.ts         # local barrel re-exporting openclaw/plugin-sdk
  src/types.ts           # config + listing types
  src/regions.ts         # cached city -> region id map (Closter, Tenafly, Seattle, ...)
  src/redfin-client.ts   # gis endpoint fetch, parse, format
  src/store.ts           # seen-listing dedupe state (~/.openclaw/redfin-seen.json)
  src/tools/search.ts        # redfin_search
  src/tools/new-listings.ts  # redfin_new_listings
  tsconfig.json
```

## Config

```json5
{
  plugins: {
    entries: {
      redfin: {
        enabled: true,
        config: {
          // optional: override the default browser User-Agent
          // userAgent: "Mozilla/5.0 ...",
          maxResults: 100,
          searches: [
            // New Jersey (Bergen County)
            { name: "Closter",  regionId: 2714,  regionType: 2, maxDaysOnMarket: 7 },
            { name: "Demarest", regionId: 2716,  regionType: 2, maxDaysOnMarket: 7 },
            { name: "Haworth",  regionId: 2722,  regionType: 2, maxDaysOnMarket: 7 },
            { name: "Tenafly",  regionId: 18484, regionType: 6, maxDaysOnMarket: 7 },
            // Washington (Puget Sound / Eastside)
            { name: "Seattle",  regionId: 16163, regionType: 6, market: "seattle", maxDaysOnMarket: 7 },
            { name: "Bellevue", regionId: 1387,  regionType: 6, market: "seattle", maxDaysOnMarket: 7 },
            { name: "Kirkland", regionId: 9148,  regionType: 6, market: "seattle", maxDaysOnMarket: 7 },
            { name: "Redmond",  regionId: 14913, regionType: 6, market: "seattle", maxDaysOnMarket: 7 },
            // add per-search filters as needed, e.g.:
            //   minPrice, maxPrice, minBeds, minBaths, propertyTypes: [1] (houses only)
          ],
        },
      },
    },
  },
}
```

## Install (development)

```bash
openclaw plugins install --link ./redfin
openclaw plugins enable redfin
openclaw plugins inspect redfin
```

Then try it from a chat or the CLI:

```bash
# search by known city name (region id resolved automatically)
openclaw agent --message 'Use redfin_search for city "Closter" with maxDaysOnMarket 7.'

# new listings since last run
openclaw agent --message 'Run redfin_new_listings and summarize anything new.'
```

## Daily new-listings push

Schedule a daily cron job on the gateway that runs `redfin_new_listings` and
delivers the result to your channel (Telegram in this example). Replace the
schedule, channel, and destination as needed.

```bash
openclaw cron add \
  --name "redfin-daily" \
  --cron "0 8 * * *" \
  --tz "America/Los_Angeles" \
  --agent main \
  --message "Call redfin_new_listings. If there are new listings, send me a concise digest grouped by search with price, beds/baths, address, and the Redfin link. If there are none, reply with a single short line saying no new listings today." \
  --expect-final \
  --announce \
  --channel telegram \
  --to <YOUR_TELEGRAM_CHAT_ID> \
  --best-effort-deliver
```

Useful follow-ups:

```bash
openclaw cron list                 # confirm it's scheduled
openclaw cron run redfin-daily     # run once now to test delivery
openclaw cron runs redfin-daily    # see run history
```

Because dedupe state persists in `~/.openclaw/redfin-seen.json`, the **first**
run reports everything currently listed; subsequent daily runs report only homes
that appeared since the previous run.

> If your `main` agent denies the `cron` tool, that only blocks the agent from
> managing cron jobs itself — you can still create the job from the CLI as above.
> Make sure the `redfin` tools are allowed for the agent the job runs as.
