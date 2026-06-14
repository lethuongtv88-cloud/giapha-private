import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsOpenUrl,
  buildPlaceAddress,
} from "@/components/places/PlaceMapLinks";

describe("PlaceMapLinks helpers", () => {
  it("builds two-level Vietnamese address", () => {
    expect(
      buildPlaceAddress({
        address_detail: "Ấp 1",
        commune: "Xã Tân Thành",
        province: "Cà Mau",
      }),
    ).toBe("Ấp 1, Xã Tân Thành, Cà Mau, Việt Nam");
  });

  it("uses custom Google Maps URL when provided", () => {
    expect(
      buildGoogleMapsOpenUrl({
        name: "Nhà thờ họ",
        google_maps_url: "https://maps.google.com/example",
      }),
    ).toBe("https://maps.google.com/example");
  });

  it("uses coordinates for directions when available", () => {
    expect(
      buildGoogleMapsDirectionsUrl({
        latitude: 9.176,
        longitude: 105.15,
      }),
    ).toContain("destination=9.176%2C105.15");
  });

  it("falls back to address for directions", () => {
    const url = buildGoogleMapsDirectionsUrl({
      address_detail: "Ấp 1",
      commune: "Xã Tân Thành",
      province: "Cà Mau",
    });

    expect(url).toContain("https://www.google.com/maps/dir/");
    expect(decodeURIComponent(url)).toContain("Ấp 1, Xã Tân Thành, Cà Mau, Việt Nam");
  });
});
