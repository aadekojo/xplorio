import { bestTime, type Flight, type FlightEndpoint } from "@xplorio/core";
import { useState } from "react";
import { Button, H2, Paragraph, Separator, SizableText, Theme, XStack, YStack } from "tamagui";
import { Card, Pill, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { dateAt, duration, formatLocalDate, minutesLate, relative, timeAt } from "@/lib/format";
import { useFlight, useNow } from "@/lib/hooks";
import { hasDeparted, progress, statusMeta } from "@/lib/status";

/** Full status for one tracked flight, shown in a popup over My flights. */
export function FlightDetail({ id, onRemoved }: { id: string; onRemoved: () => void }) {
  const { data, error, loading } = useFlight(id);
  const now = useNow(10_000);
  const [confirming, setConfirming] = useState(false);

  async function remove() {
    if (!confirming) return setConfirming(true);
    await api.removeFlight(id);
    onRemoved();
  }

  if (loading && !data) return <Paragraph color="color-10">Loading…</Paragraph>;

  if (error || !data) {
    return (
      <Card>
        <Paragraph>{error ?? "Flight not found."}</Paragraph>
      </Card>
    );
  }

  const { tracked, flight } = data;

  return (
    <>
      <YStack gap="1">
        <XStack items="center" gap="3" flexWrap="wrap">
          <H2>{tracked.number}</H2>
          {flight && <Pill tone={statusMeta(flight).tone}>{statusMeta(flight).label}</Pill>}
        </XStack>
        <SizableText color="color-10">
          {[tracked.nickname, flight?.airlineName, formatLocalDate(tracked.localDate)]
            .filter(Boolean)
            .join(" · ")}
        </SizableText>
      </YStack>

      {!flight ? (
        <Card>
          <Paragraph>Status isn't available right now. We'll keep checking.</Paragraph>
        </Card>
      ) : (
        <>
          <Card gap="5">
            <XStack justify="space-between" items="flex-start">
              <Endpoint label="Departs" end={flight.departure} />
              <Endpoint label="Arrives" end={flight.arrival} align="right" />
            </XStack>

            {flight.status !== "cancelled" && (
              <YStack gap="2">
                <YStack h={6} rounded="full" bg="color-4" overflow="hidden">
                  <YStack
                    h="100%"
                    w={`${Math.round(progress(flight, now) * 100)}%`}
                    bg="color-9"
                    rounded="full"
                    theme="accent"
                  />
                </YStack>
                <XStack justify="space-between">
                  <SizableText size="sm" color="color-10">
                    {headline(flight, now)}
                  </SizableText>
                  <SizableText size="sm" color="color-10">
                    {blockTime(flight.departure, flight.arrival)}
                  </SizableText>
                </XStack>
              </YStack>
            )}
          </Card>

          <Card>
            <XStack justify="space-between" flexWrap="wrap" gap="4">
              <Stat label="Terminal" value={flight.departure.terminal ?? "–"} />
              <Stat label="Gate" value={flight.departure.gate ?? "TBA"} />
              <Stat label="Arr. terminal" value={flight.arrival.terminal ?? "–"} />
              <Stat label="Baggage" value={flight.arrival.baggageBelt ?? "–"} align="right" />
            </XStack>
            {flight.aircraft?.model && (
              <>
                <Separator />
                <Stat label="Aircraft" value={flight.aircraft.model} />
              </>
            )}
          </Card>

          <SizableText size="xs" color="color-9">
            Updated {relative(Date.parse(flight.fetchedAt), now)}
          </SizableText>
        </>
      )}

      <Button
        theme={confirming ? "red" : undefined}
        self="flex-start"
        onPress={() => void remove()}
      >
        {confirming ? "Tap again to remove" : "Remove flight"}
      </Button>
    </>
  );
}

function Endpoint({
  label,
  end,
  align = "left",
}: {
  label: string;
  end: FlightEndpoint;
  align?: "left" | "right";
}) {
  const best = bestTime(end);
  const late = minutesLate(end.times.scheduled, best);
  const tz = end.airport.timeZone;
  const items = align === "right" ? "flex-end" : "flex-start";
  return (
    <YStack items={items} gap="1" flex={1}>
      <SizableText size="xs" color="color-10" textTransform="uppercase" letterSpacing={0.6}>
        {label}
      </SizableText>
      <SizableText size="4xl" fontWeight="800" letterSpacing={-1}>
        {end.airport.iata}
      </SizableText>
      <SizableText size="sm" color="color-10" text={align}>
        {end.airport.city ?? end.airport.name}
      </SizableText>
      <SizableText size="2xl" fontWeight="700" mt="2">
        {timeAt(best, tz)}
      </SizableText>
      {late >= 5 ? (
        <Theme name="yellow">
          <SizableText size="sm" color="color-11">
            {late}m late · was {timeAt(end.times.scheduled, tz)}
          </SizableText>
        </Theme>
      ) : (
        <SizableText size="sm" color="color-10">
          {dateAt(best, tz)}
        </SizableText>
      )}
    </YStack>
  );
}

function headline(flight: Flight, now: number): string {
  const dep = bestTime(flight.departure);
  const arr = bestTime(flight.arrival);
  if (flight.status === "arrived" || flight.status === "landed") {
    return arr ? `Landed ${relative(Date.parse(arr), now)}` : "Landed";
  }
  if (hasDeparted(flight)) return arr ? `Lands ${relative(Date.parse(arr), now)}` : "In the air";
  return dep ? `Departs ${relative(Date.parse(dep), now)}` : "Scheduled";
}

function blockTime(dep: FlightEndpoint, arr: FlightEndpoint): string {
  const d = bestTime(dep);
  const a = bestTime(arr);
  return d && a ? duration(Date.parse(a) - Date.parse(d)) : "";
}
