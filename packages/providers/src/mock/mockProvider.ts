import { flightKey, type AirportRef, type Flight, type FlightStatus } from "@xplorio/core";
import type { FlightDataProvider } from "../types";

const MINUTE = 60_000;

const AIRPORTS: Record<string, AirportRef> = {
  YWG: {
    iata: "YWG",
    name: "Winnipeg Richardson",
    city: "Winnipeg",
    timeZone: "America/Winnipeg",
    lat: 49.91,
    lon: -97.24,
  },
  YYZ: {
    iata: "YYZ",
    name: "Toronto Pearson",
    city: "Toronto",
    timeZone: "America/Toronto",
    lat: 43.68,
    lon: -79.63,
  },
  YVR: {
    iata: "YVR",
    name: "Vancouver International",
    city: "Vancouver",
    timeZone: "America/Vancouver",
    lat: 49.19,
    lon: -123.18,
  },
  YYC: {
    iata: "YYC",
    name: "Calgary International",
    city: "Calgary",
    timeZone: "America/Edmonton",
    lat: 51.13,
    lon: -114.01,
  },
  YUL: {
    iata: "YUL",
    name: "Montréal-Trudeau",
    city: "Montréal",
    timeZone: "America/Toronto",
    lat: 45.47,
    lon: -73.74,
  },
  LAX: {
    iata: "LAX",
    name: "Los Angeles International",
    city: "Los Angeles",
    timeZone: "America/Los_Angeles",
    lat: 33.94,
    lon: -118.41,
  },
  JFK: {
    iata: "JFK",
    name: "John F. Kennedy International",
    city: "New York",
    timeZone: "America/New_York",
    lat: 40.64,
    lon: -73.78,
  },
  LHR: {
    iata: "LHR",
    name: "London Heathrow",
    city: "London",
    timeZone: "Europe/London",
    lat: 51.47,
    lon: -0.45,
  },
  CUN: {
    iata: "CUN",
    name: "Cancún International",
    city: "Cancún",
    timeZone: "America/Cancun",
    lat: 21.04,
    lon: -86.87,
  },
};

// [origin, destination, block time in minutes, aircraft]
const ROUTES: Array<[string, string, number, string]> = [
  ["YWG", "YYZ", 155, "Airbus A220-300"],
  ["YWG", "YVR", 175, "Boeing 737 MAX 8"],
  ["YYC", "YWG", 95, "De Havilland Dash 8-400"],
  ["YYZ", "LHR", 415, "Boeing 787-9"],
  ["YVR", "LAX", 170, "Boeing 737-800"],
  ["YUL", "CUN", 260, "Airbus A321neo"],
  ["YYZ", "JFK", 95, "Embraer E175"],
  ["YWG", "YYC", 105, "Boeing 737-700"],
];

const GATES = ["4", "7", "8", "12", "15", "21", "B23", "C31", "D40"];

/** Small stable hash so the same flight number always gets the same route and times. */
function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Offline provider for development and tests. Costs zero API units.
 *
 * Every flight number maps to a stable route, departure time and gate, and the flight moves
 * through its lifecycle as the clock passes, so the UI and poller can be exercised end to end.
 * Flight numbers ending in "X" are cancelled; numbers ending in "D" run 45 minutes late.
 */
export class MockFlightProvider implements FlightDataProvider {
  readonly name = "mock";
  readonly unitsPerLookup = 0;

  constructor(private readonly clock: () => Date = () => new Date()) {}

  async getFlights(number: string, localDate: string): Promise<Flight[]> {
    const num = number.toUpperCase();
    const h = hash(num);
    const [from, to, blockMin, aircraft] = ROUTES[h % ROUTES.length]!;
    const origin = AIRPORTS[from]!;
    const destination = AIRPORTS[to]!;

    // Departs between 06:00 and 21:45 UTC on the given date, in 15-minute steps.
    const depMinutes = 6 * 60 + ((h >>> 8) % 64) * 15;
    const departure = new Date(Date.parse(`${localDate}T00:00:00Z`) + depMinutes * MINUTE);
    const arrival = new Date(departure.getTime() + blockMin * MINUTE);
    const delayMin = num.endsWith("D") ? 45 : 0;
    const estDeparture = new Date(departure.getTime() + delayMin * MINUTE);
    const estArrival = new Date(arrival.getTime() + delayMin * MINUTE);
    const now = this.clock().getTime();

    const status: FlightStatus = num.endsWith("X")
      ? "cancelled"
      : now >= estArrival.getTime() + 15 * MINUTE
        ? "arrived"
        : now >= estArrival.getTime()
          ? "landed"
          : now >= estDeparture.getTime()
            ? "en_route"
            : now >= estDeparture.getTime() - 40 * MINUTE
              ? "boarding"
              : delayMin > 0
                ? "delayed"
                : "scheduled";

    const departed = now >= estDeparture.getTime() && status !== "cancelled";
    const landed = status === "landed" || status === "arrived";
    const gateKnown = now >= departure.getTime() - 24 * 60 * MINUTE;

    let position: Flight["position"];
    if (status === "en_route" && origin.lat !== undefined && destination.lat !== undefined) {
      const t = (now - estDeparture.getTime()) / (estArrival.getTime() - estDeparture.getTime());
      position = {
        lat: origin.lat + (destination.lat - origin.lat) * t,
        lon: origin.lon! + (destination.lon! - origin.lon!) * t,
        altitudeFt: 36000,
        groundSpeedKt: 450,
        reportedAt: new Date(now).toISOString(),
      };
    }

    return [
      {
        flightKey: flightKey(num, localDate),
        number: num,
        airlineName: "Mock Air",
        localDate,
        status,
        departure: {
          airport: origin,
          terminal: String(1 + (h % 3)),
          ...(gateKnown && { gate: GATES[(h >>> 4) % GATES.length]! }),
          times: {
            scheduled: departure.toISOString(),
            ...(delayMin > 0 && { estimated: estDeparture.toISOString() }),
            ...(departed && { actual: estDeparture.toISOString() }),
          },
        },
        arrival: {
          airport: destination,
          terminal: String(1 + ((h >>> 2) % 3)),
          ...(landed && { baggageBelt: String(1 + (h % 9)) }),
          times: {
            scheduled: arrival.toISOString(),
            ...(delayMin > 0 && { estimated: estArrival.toISOString() }),
            ...(landed && { actual: estArrival.toISOString() }),
          },
        },
        aircraft: { model: aircraft },
        ...(position && { position }),
        fetchedAt: new Date(now).toISOString(),
      },
    ];
  }
}
