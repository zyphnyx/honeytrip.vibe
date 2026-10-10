import { NextResponse } from "next/server";

// Simple in-memory cache to save Geoapify free credits (TTL: 10 minutes)
interface CacheEntry {
  data: unknown;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

const CACHE_TTL_MS = 10 * 60 * 1000;

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown) {
  // Simple eviction if cache grows too large
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function GET(request: Request) {
  const apiKey = process.env.GEOAPIFY_API_KEY;

  // Graceful degradation when API key is missing
  if (!apiKey || apiKey.trim() === "") {
    return NextResponse.json({
      enabled: false,
      reason: "MISSING_KEY",
      message: "ระบบค้นหาอัตโนมัติยังไม่เปิดใช้งาน สามารถเสนอสถานที่ด้วยตนเองได้ทันทีครับ",
      places: [],
    });
  }

  const { searchParams } = new URL(request.url);
  const destination = searchParams.get("destination")?.trim() || "";
  const category = (searchParams.get("category") || "stay") as "stay" | "attraction";
  const query = searchParams.get("query")?.trim() || "";
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");

  if (!destination && (!latParam || !lonParam) && !query) {
    return NextResponse.json(
      { error: "กรุณาระบุจุดหมายปลายทางหรือคำค้นหา" },
      { status: 400 },
    );
  }

  const cacheKey = `${destination}|${category}|${query}|${latParam}|${lonParam}`;
  const cachedData = getCached(cacheKey);
  if (cachedData) {
    return NextResponse.json(cachedData);
  }

  try {
    let lat: number | null = latParam ? parseFloat(latParam) : null;
    let lon: number | null = lonParam ? parseFloat(lonParam) : null;

    // 1. If no coordinates provided, resolve destination via Geoapify Geocoding
    if ((lat === null || lon === null || isNaN(lat) || isNaN(lon)) && destination) {
      const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(destination)}&limit=1&apiKey=${apiKey}`;
      const geoRes = await fetch(geoUrl, {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 }, // Next.js cache 1 hour
      });

      if (geoRes.ok) {
        const geoJson = await geoRes.json();
        const first = geoJson?.features?.[0];
        if (first && first.properties) {
          lat = first.properties.lat;
          lon = first.properties.lon;
        }
      }
    }

    // 2. Build Geoapify Places search categories
    // Stay: hotels, motels, guest houses
    // Attraction: sights, tourism attractions, natural, parks, cafes, entertainment
    const categories =
      category === "stay"
        ? "accommodation.hotel,accommodation.guest_house,accommodation.motel,accommodation.chalet"
        : "tourism.sights,tourism.attraction,natural,leisure.park,catering.cafe,entertainment";

    let placesUrl = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(categories)}&limit=15&apiKey=${apiKey}`;

    if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
      // Circle filter 25km radius
      placesUrl += `&filter=circle:${lon},${lat},25000&bias=proximity:${lon},${lat}`;
    }

    if (query) {
      placesUrl += `&name=${encodeURIComponent(query)}`;
    }

    const res = await fetch(placesUrl, {
      headers: { Accept: "application/json" },
    });

    if (res.status === 401 || res.status === 403 || res.status === 429) {
      // Quota exceeded or invalid key -> Fail-closed gracefully
      return NextResponse.json({
        enabled: false,
        reason: "QUOTA_OR_AUTH_ERROR",
        message: "การค้นหาอัตโนมัติถึงขีดจำกัดชั่วคราว คุณยังสามารถเพิ่มสถานที่ด้วยตนเองได้เลย",
        places: [],
      });
    }

    if (!res.ok) {
      throw new Error(`Geoapify error status: ${res.status}`);
    }

    const data = await res.json();
    const features = data?.features || [];

    interface GeoFeature {
      properties?: {
        place_id?: string;
        name?: string;
        formatted?: string;
        city?: string;
        suburb?: string;
        state?: string;
        country?: string;
        lat?: number;
        lon?: number;
        categories?: string[];
      };
    }

    const places = (features as GeoFeature[])
      .filter((f) => f.properties?.name) // เอาเฉพาะที่มีชื่อชัดเจน
      .map((f) => {
        const p = f.properties!;
        const placeName = p.name!;
        const locationStr =
          p.formatted || [p.suburb, p.city, p.state].filter(Boolean).join(", ") || "";
        const pLat = p.lat ?? 0;
        const pLon = p.lon ?? 0;

        // External Google Maps outbound search link for convenience
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + (locationStr ? " " + locationStr : ""))}`;

        return {
          providerPlaceId: p.place_id || `${pLat}_${pLon}`,
          name: placeName,
          category,
          source: "geoapify",
          location: locationStr,
          coords: pLat && pLon ? { lat: pLat, lon: pLon } : null,
          externalUrl: googleMapsUrl,
        };
      });

    const responsePayload = {
      enabled: true,
      places,
      destinationCoords: lat && lon ? { lat, lon } : null,
      attributions: {
        geoapify: "Powered by Geoapify",
        geoapifyUrl: "https://www.geoapify.com/",
        osm: "© OpenStreetMap contributors",
        osmUrl: "https://www.openstreetmap.org/copyright",
      },
    };

    setCache(cacheKey, responsePayload);

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Geoapify search route error:", error);
    return NextResponse.json({
      enabled: false,
      reason: "SERVER_ERROR",
      message: "ไม่สามารถค้นหาได้ในขณะนี้ สามารถเสนอสถานที่ด้วยตนเองได้เลยครับ",
      places: [],
    });
  }
}
