import { FlightSchema } from "@xplorio/core";
import { describe, expect, it } from "vitest";
import { MockFlightProvider } from "./mockProvider";

const MINUTE = 60_000;
const providerAt = (ms: number) => new MockFlightProvider(() => new Date(ms));

async function scheduleOf(number: string, date = "2026-11-02") {
  const [f] = await providerAt(0).getFlights(number, date);
  return {
    dep: Date.parse(f!.departure.times.scheduled!),
    arr: Date.parse(f!.arrival.times.scheduled!),
  };
}

describe("MockFlightProvider", () => {
  it("returns flights that satisfy the shared schema and cost no units", async () => {
    const provider = providerAt(Date.parse("2026-11-01T12:00:00Z"));
    const [flight] = await provider.getFlights("ac262", "2026-11-02");
    expect(provider.unitsPerLookup).toBe(0);
    expect(FlightSchema.parse(flight).number).toBe("AC262");
  });

  it("gives the same flight number the same route and times every time", async () => {
    const a = await providerAt(0).getFlights("WS123", "2026-11-02");
    const b = await providerAt(1).getFlights("WS123", "2026-11-02");
    expect(a[0]?.departure.airport.iata).toBe(b[0]?.departure.airport.iata);
    expect(a[0]?.departure.times.scheduled).toBe(b[0]?.departure.times.scheduled);
  });

  it("moves the flight through its lifecycle with the clock", async () => {
    const { dep, arr } = await scheduleOf("AC262");
    const statusAt = async (ms: number) =>
      (await providerAt(ms).getFlights("AC262", "2026-11-02"))[0]?.status;
    expect(await statusAt(dep - 4 * 60 * MINUTE)).toBe("scheduled");
    expect(await statusAt(dep - 30 * MINUTE)).toBe("boarding");
    expect(await statusAt(dep + 10 * MINUTE)).toBe("en_route");
    expect(await statusAt(arr + 5 * MINUTE)).toBe("landed");
    expect(await statusAt(arr + 60 * MINUTE)).toBe("arrived");
  });

  it("reports a position between the airports while en route", async () => {
    const { dep } = await scheduleOf("AC262");
    const [f] = await providerAt(dep + 30 * MINUTE).getFlights("AC262", "2026-11-02");
    expect(f?.position?.lat).toBeTypeOf("number");
  });

  it("supports cancelled and delayed test flights", async () => {
    const provider = providerAt(Date.parse("2026-11-01T00:00:00Z"));
    expect((await provider.getFlights("AC1X", "2026-11-02"))[0]?.status).toBe("cancelled");
    expect((await provider.getFlights("AC1D", "2026-11-02"))[0]?.status).toBe("delayed");
  });
});
