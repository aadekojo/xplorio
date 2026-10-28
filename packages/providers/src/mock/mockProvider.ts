import { flightKey, type Flight, type FlightStatus } from "@xplorio/core";
import type { FlightDataProvider } from "../types.js";

/**
 * Offline provider for development and tests. Costs zero API units.
 *
 * It invents a believable flight for any number and date, then moves it through
 * its lifecycle based on the clock, so the UI and poller can be exercised end to end.
 * Flight numbers ending in "X" are cancelled; numbers ending in "D" run 45 minutes late.
 */
export class MockFlightProvider implements FlightDataProvider {
  readonly name = "mock";
  readonly unitsPerLookup = 0;

  constructor(private readonly clock: () => Date = () => new Date()) {}

  async getFlights(number: string, localDate: string): Promise<Flight[]> {
    const num = number.toUpperCase();
    const departure = new Date(`${localDate}T14:00:00Z`);
    const arrival = new Date(departure.getTime() + 160 * 60_000);
    const delayMin = num.endsWith("D") ? 45 : 0;
    const estDeparture = new Date(departure.getTime() + delayMin * 60_000);
    const estArrival = new Date(arrival.getTime() + delayMin * 60_000);
    const now = this.clock().getTime();

    const status: FlightStatus = num.endsWith("X")
      ? "cancelled"
      : now >= estArrival.getTime() + 15 * 60_000
        ? "arrived"
        : now >= estArrival.getTime()
          ? "landed"
          : now >= estDeparture.getTime()
            ? "en_route"
            : now >= estDeparture.getTime() - 40 * 60_000
              ? "boarding"
              : delayMin > 0
                ? "delayed"
                : "scheduled";

    const departed = now >= estDeparture.getTime() && status !== "cancelled";
    const landed = status === "landed" || status === "arrived";

    return [
      {
        flightKey: flightKey(num, localDate),
        number: num,
        airlineName: "Mock Air",
        localDate,
        status,
        departure: {
          airport: {
            iata: "YWG",
            name: "Winnipeg Richardson",
            timeZone: "America/Winnipeg",
            lat: 49.91,
            lon: -97.24,
          },
          terminal: "Main",
          gate: "8",
          times: {
            scheduled: departure.toISOString(),
            ...(delayMin > 0 && { estimated: estDeparture.toISOString() }),
            ...(departed && { actual: estDeparture.toISOString() }),
          },
        },
        arrival: {
          airport: {
            iata: "YYZ",
            name: "Toronto Pearson",
            timeZone: "America/Toronto",
            lat: 43.68,
            lon: -79.63,
          },
          terminal: "1",
          times: {
            scheduled: arrival.toISOString(),
            ...(delayMin > 0 && { estimated: estArrival.toISOString() }),
            ...(landed && { actual: estArrival.toISOString() }),
          },
        },
        aircraft: { model: "Airbus A220-300" },
        fetchedAt: new Date(now).toISOString(),
      },
    ];
  }
}
