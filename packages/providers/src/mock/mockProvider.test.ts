import { FlightSchema } from "@xplorio/core";
import { describe, expect, it } from "vitest";
import { MockFlightProvider } from "./mockProvider.js";

const providerAt = (iso: string) => new MockFlightProvider(() => new Date(iso));

describe("MockFlightProvider", () => {
  it("returns flights that satisfy the shared schema and cost no units", async () => {
    const provider = providerAt("2026-11-01T12:00:00Z");
    const [flight] = await provider.getFlights("ac262", "2026-11-02");
    expect(provider.unitsPerLookup).toBe(0);
    expect(FlightSchema.parse(flight).number).toBe("AC262");
  });

  it("moves the flight through its lifecycle with the clock", async () => {
    const statusAt = async (iso: string) =>
      (await providerAt(iso).getFlights("AC262", "2026-11-02"))[0]?.status;
    expect(await statusAt("2026-11-02T10:00:00Z")).toBe("scheduled");
    expect(await statusAt("2026-11-02T13:30:00Z")).toBe("boarding");
    expect(await statusAt("2026-11-02T15:00:00Z")).toBe("en_route");
    expect(await statusAt("2026-11-02T18:00:00Z")).toBe("arrived");
  });

  it("supports cancelled and delayed test flights", async () => {
    const provider = providerAt("2026-11-02T10:00:00Z");
    expect((await provider.getFlights("AC1X", "2026-11-02"))[0]?.status).toBe("cancelled");
    expect((await provider.getFlights("AC1D", "2026-11-02"))[0]?.status).toBe("delayed");
  });
});
