import type { Flight } from "@xplorio/core";

/**
 * Every flight data source implements this. The API depends only on this interface,
 * so swapping AeroDataBox's free tier for a paid plan or FlightAware is a config change.
 */
export interface FlightDataProvider {
  /** Short identifier used in logs and the usage ledger, e.g. "mock" or "aerodatabox". */
  readonly name: string;

  /**
   * All legs operated under a flight number on a local date (usually one).
   * Returns an empty array when the provider has no such flight.
   */
  getFlights(number: string, localDate: string): Promise<Flight[]>;

  /** API units one getFlights call costs on this provider, for the monthly budget guard. */
  readonly unitsPerLookup: number;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProviderError";
  }
}
