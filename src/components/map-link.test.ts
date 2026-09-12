import { describe, expect, it } from "vitest";
import { mapsUrl } from "./map-link";

describe("mapsUrl", () => {
  it("prefers the place id, which pins the exact place", () => {
    const url = mapsUrl({ formatted: "High Street, Esher", placeId: "ChIJ123", lat: 51.37, lng: -0.36 });
    expect(url).toContain("query_place_id=ChIJ123");
    expect(url).toContain("query=High%20Street%2C%20Esher");
  });

  it("falls back to coordinates when there is no place id", () => {
    const url = mapsUrl({ formatted: "High Street, Esher", placeId: null, lat: 51.37, lng: -0.36 });
    expect(url).toContain("query=51.37,-0.36");
    expect(url).not.toContain("query_place_id");
  });

  it("falls back to the address when there are no coordinates", () => {
    expect(mapsUrl({ formatted: "Thames Ditton, Surrey" })).toContain("query=Thames%20Ditton%2C%20Surrey");
  });

  it("escapes characters that would break the query string", () => {
    const url = mapsUrl({ formatted: "Flat 2/3, King's Road & Mews" });
    // The ampersand and slash must not survive literally, or they would split
    // the query or read as a path. An apostrophe is legal and stays as-is.
    expect(url).toContain("%26");
    expect(url).toContain("2%2F3");
    expect(url).not.toMatch(/query=[^&]*&(?!query_place_id)/);
  });

  it("treats zero coordinates as real, not missing", () => {
    // lat 0 / lng 0 is a valid point; a truthiness check would drop it.
    expect(mapsUrl({ formatted: "Null Island", lat: 0, lng: 0 })).toContain("query=0,0");
  });

  it("ignores a half-set coordinate pair", () => {
    const url = mapsUrl({ formatted: "Somewhere", lat: 51.5, lng: null });
    expect(url).toContain("query=Somewhere");
  });
});
