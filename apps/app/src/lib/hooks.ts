import type { TrackedFlightView } from "@xplorio/core";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

const REFRESH_MS = 30_000;

/** Current time, ticking every `everyMs` so countdowns stay live. */
export function useNow(everyMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

interface Loadable<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => Promise<void>;
}

/** Fetches with `load`, then refreshes every 30 seconds while mounted. */
function usePolling<T>(load: () => Promise<T>, deps: unknown[]): Loadable<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach Xplorio.");
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), REFRESH_MS);
    return () => clearInterval(t);
  }, [reload]);

  return { data, error, loading, reload };
}

export function useFlightList() {
  return usePolling<TrackedFlightView[]>(() => api.listFlights(), []);
}

export function useFlight(id: string) {
  return usePolling<TrackedFlightView>(() => api.getFlight(id), [id]);
}
