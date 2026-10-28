import { z } from "zod";

/** Airline flight number as people type it: 2-3 char airline code + 1-4 digits, e.g. "AC262", "WS 123". */
export const FlightNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((s) => s.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/, "Enter a flight number like AC262"));

/** Calendar date of departure in the departure airport's local time (YYYY-MM-DD). */
export const LocalDateSchema = z.iso.date();

export const FlightStatusSchema = z.enum([
  "scheduled",
  "boarding",
  "departed",
  "en_route",
  "landed",
  "arrived",
  "delayed",
  "diverted",
  "cancelled",
  "unknown",
]);

/** Scheduled / estimated / actual times for one end of a flight, all ISO-8601 UTC. */
export const FlightTimesSchema = z.object({
  scheduled: z.iso.datetime().optional(),
  estimated: z.iso.datetime().optional(),
  actual: z.iso.datetime().optional(),
});

export const AirportRefSchema = z.object({
  iata: z.string().length(3),
  icao: z.string().length(4).optional(),
  name: z.string().optional(),
  city: z.string().optional(),
  timeZone: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
});

export const FlightEndpointSchema = z.object({
  airport: AirportRefSchema,
  terminal: z.string().optional(),
  gate: z.string().optional(),
  baggageBelt: z.string().optional(),
  times: FlightTimesSchema,
});

/** A flight as normalized from any data provider. Stored in flightCache, returned to the app. */
export const FlightSchema = z.object({
  /** Stable key for the cache: `${number}_${localDate}`, plus leg suffix when a number has several legs. */
  flightKey: z.string(),
  number: z.string(),
  airlineName: z.string().optional(),
  localDate: LocalDateSchema,
  status: FlightStatusSchema,
  departure: FlightEndpointSchema,
  arrival: FlightEndpointSchema,
  aircraft: z
    .object({
      model: z.string().optional(),
      registration: z.string().optional(),
    })
    .optional(),
  position: z
    .object({
      lat: z.number(),
      lon: z.number(),
      altitudeFt: z.number().optional(),
      groundSpeedKt: z.number().optional(),
      reportedAt: z.iso.datetime(),
    })
    .optional(),
  /** When the provider data was fetched (UTC). */
  fetchedAt: z.iso.datetime(),
});

export const AlertPrefsSchema = z.object({
  delay: z.boolean().default(true),
  gateChange: z.boolean().default(true),
  departed: z.boolean().default(true),
  landed: z.boolean().default(true),
  cancelled: z.boolean().default(true),
});

/** A user's saved flight. Stored in trackedFlights, partitioned by userId. */
export const TrackedFlightSchema = z.object({
  id: z.uuid(),
  userId: z.string().min(1),
  flightKey: z.string(),
  number: z.string(),
  localDate: LocalDateSchema,
  nickname: z.string().max(60).optional(),
  alerts: AlertPrefsSchema,
  createdAt: z.iso.datetime(),
});

/** Body of POST /flights. userId is never accepted from the client; it comes from the token. */
export const AddFlightRequestSchema = z.object({
  number: FlightNumberSchema,
  localDate: LocalDateSchema,
  nickname: z.string().trim().max(60).optional(),
  /** Which leg to track when one flight number operates several legs that day. */
  legIndex: z.number().int().min(0).max(9).optional(),
});

export type FlightStatus = z.infer<typeof FlightStatusSchema>;
export type FlightTimes = z.infer<typeof FlightTimesSchema>;
export type AirportRef = z.infer<typeof AirportRefSchema>;
export type FlightEndpoint = z.infer<typeof FlightEndpointSchema>;
export type Flight = z.infer<typeof FlightSchema>;
export type AlertPrefs = z.infer<typeof AlertPrefsSchema>;
export type TrackedFlight = z.infer<typeof TrackedFlightSchema>;
export type AddFlightRequest = z.infer<typeof AddFlightRequestSchema>;

/** What the API returns for a saved flight: the user's entry plus the latest known status. */
export interface TrackedFlightView {
  tracked: TrackedFlight;
  flight: Flight | null;
}
