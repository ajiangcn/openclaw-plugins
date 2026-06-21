/** A single saved search definition (mirrors the plugin configSchema). */
export interface RedfinSearch {
  /** Friendly label used in output and dedupe state keys. */
  name: string;
  /** Redfin region id from the search URL. */
  regionId: number;
  /** Redfin region type (2=zip, 6=city, 5=county, 4=state, 1=neighborhood). */
  regionType: number;
  /** Redfin market slug, e.g. "seattle". */
  market?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  /** 1=House, 2=Condo, 3=Townhouse, 4=Multi-family, 5=Land, 6=Other, 7=Mobile, 8=Co-op. */
  propertyTypes?: number[];
  /** Only include listings on the market <= this many days. */
  maxDaysOnMarket?: number;
}

/** This plugin's own config (api.pluginConfig). */
export interface RedfinConfig {
  userAgent?: string;
  maxResults?: number;
  searches?: RedfinSearch[];
}

/** Normalized listing returned by the client. */
export interface Listing {
  /** Stable Redfin property id; used as the dedupe key. */
  id: number;
  listingId?: number;
  mlsId?: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqFt?: number;
  lotSize?: number;
  yearBuilt?: number;
  pricePerSqFt?: number;
  hoa?: number;
  propertyType?: string;
  daysOnMarket?: number;
  /** Milliseconds the listing has been live on Redfin (duration, not a timestamp). */
  onRedfinMs?: number;
  status?: string;
  lat?: number;
  lng?: number;
  url: string;
}
