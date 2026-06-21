import type { Listing, RedfinSearch } from "./types.js";

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const GIS_ENDPOINT = "https://www.redfin.com/stingray/api/gis";

const PROPERTY_TYPE_LABELS: Record<number, string> = {
  1: "House",
  2: "Condo",
  3: "Townhouse",
  4: "Multi-family",
  5: "Land",
  6: "Other",
  7: "Mobile",
  8: "Co-op",
};

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Redfin wraps many fields as { value, level }; unwrap to the inner value. */
function unwrap(home: Record<string, unknown>, key: string): unknown {
  const v = home[key];
  if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    return (v as Record<string, unknown>).value;
  }
  return v;
}

/** Build the Redfin gis (map data) endpoint URL for a search. */
export function buildGisUrl(search: RedfinSearch, maxResults: number): string {
  const params = new URLSearchParams();
  params.set("al", "1");
  params.set("v", "8");
  params.set("status", "9"); // for-sale / active
  params.set("sf", "1,2,3,5,6,7");
  params.set("ord", "days-on-redfin-asc"); // newest first
  params.set("page_number", "1");
  params.set("region_id", String(search.regionId));
  params.set("region_type", String(search.regionType));
  if (search.market) params.set("market", search.market);
  params.set("num_homes", String(maxResults > 0 ? maxResults : 100));
  if (search.minPrice != null) params.set("min_price", String(search.minPrice));
  if (search.maxPrice != null) params.set("max_price", String(search.maxPrice));
  if (search.minBeds != null) params.set("num_beds", String(search.minBeds));
  if (search.minBaths != null) params.set("num_baths", String(search.minBaths));
  const uipt =
    search.propertyTypes && search.propertyTypes.length > 0
      ? search.propertyTypes.join(",")
      : "1,2,3,4,5,6,7,8";
  params.set("uipt", uipt);
  return `${GIS_ENDPOINT}?${params.toString()}`;
}

function mapHome(raw: unknown): Listing | null {
  if (!raw || typeof raw !== "object") return null;
  const home = raw as Record<string, unknown>;

  const id = asNumber(home.propertyId);
  if (id == null) return null;

  const urlPath = asString(home.url);
  const url = urlPath ? `https://www.redfin.com${urlPath}` : "";

  const uiType = asNumber(home.uiPropertyType);
  const propertyType = uiType != null ? (PROPERTY_TYPE_LABELS[uiType] ?? `Type ${uiType}`) : undefined;

  let lat: number | undefined;
  let lng: number | undefined;
  const latLong = unwrap(home, "latLong");
  if (latLong && typeof latLong === "object") {
    const ll = latLong as Record<string, unknown>;
    lat = asNumber(ll.latitude);
    lng = asNumber(ll.longitude);
  }

  return {
    id,
    listingId: asNumber(unwrap(home, "listingId")),
    mlsId: asString(unwrap(home, "mlsId")),
    address: asString(unwrap(home, "streetLine")) ?? "(address withheld)",
    city: asString(home.city),
    state: asString(home.state),
    zip: asString(home.zip),
    price: asNumber(unwrap(home, "price")),
    beds: asNumber(home.beds),
    baths: asNumber(home.baths),
    sqFt: asNumber(unwrap(home, "sqFt")),
    lotSize: asNumber(unwrap(home, "lotSize")),
    yearBuilt: asNumber(unwrap(home, "yearBuilt")),
    pricePerSqFt: asNumber(unwrap(home, "pricePerSqFt")),
    hoa: asNumber(unwrap(home, "hoa")),
    propertyType,
    daysOnMarket: asNumber(unwrap(home, "dom")),
    onRedfinMs: asNumber(unwrap(home, "timeOnRedfin")),
    status: asString(home.mlsStatus),
    lat,
    lng,
    url,
  };
}

/** Fetch and normalize listings for a single search. */
export async function fetchListings(
  search: RedfinSearch,
  userAgent: string | undefined,
  maxResults: number,
): Promise<Listing[]> {
  const url = buildGisUrl(search, maxResults);
  const res = await fetch(url, {
    headers: {
      "User-Agent": userAgent && userAgent.length > 0 ? userAgent : DEFAULT_UA,
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.redfin.com/",
    },
  });
  if (!res.ok) {
    throw new Error(
      `Redfin request failed (${res.status}) for "${search.name}". ` +
        `Verify regionId/regionType from the Redfin search URL, or Redfin may be rate-limiting.`,
    );
  }

  const text = await res.text();
  // Redfin prefixes JSON with `{}&&` to defeat JSON hijacking; strip it.
  const payloadText = text.replace(/^\{\}&&/, "");
  let data: unknown;
  try {
    data = JSON.parse(payloadText);
  } catch {
    throw new Error(`Could not parse Redfin response for "${search.name}".`);
  }

  const root = (data ?? {}) as Record<string, unknown>;
  if (asNumber(root.resultCode) !== 0) {
    throw new Error(`Redfin error for "${search.name}": ${asString(root.errorMessage) ?? "unknown error"}`);
  }
  const payload = (root.payload ?? {}) as Record<string, unknown>;
  const homes = Array.isArray(payload.homes) ? payload.homes : [];

  let listings = homes
    .map(mapHome)
    .filter((l): l is Listing => l !== null);

  if (search.maxDaysOnMarket != null) {
    const max = search.maxDaysOnMarket;
    listings = listings.filter((l) => l.daysOnMarket == null || l.daysOnMarket <= max);
  }

  return listings;
}

/** Render a single listing as a compact human-readable line block. */
export function formatListing(l: Listing): string {
  const price = l.price != null ? `$${l.price.toLocaleString("en-US")}` : "$?";
  const bedBath = `${l.beds ?? "?"}bd/${l.baths ?? "?"}ba`;
  const size = l.sqFt != null ? `${l.sqFt.toLocaleString("en-US")} sqft` : "";
  const loc = [l.city, l.state, l.zip].filter(Boolean).join(", ");
  const dom = l.daysOnMarket != null ? `${l.daysOnMarket}d on market` : "";
  const type = l.propertyType ? ` · ${l.propertyType}` : "";
  const meta = [bedBath, size, dom].filter((s) => s.length > 0).join(" · ");
  return `${price} — ${l.address}${type}\n  ${loc}${meta ? ` · ${meta}` : ""}\n  ${l.url}`;
}
