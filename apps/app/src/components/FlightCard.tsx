import { bestTime, type TrackedFlightView } from "@xplorio/core";
import { SizableText, XStack, YStack } from "tamagui";
import { formatLocalDate, minutesLate, relative, timeAt } from "@/lib/format";
import { hasDeparted, statusMeta } from "@/lib/status";
import { Card, Pill } from "./ui";

/** One row in "My flights": route, times and status at a glance. Tapping opens the detail. */
export function FlightCard({
  view,
  now,
  onPress,
}: {
  view: TrackedFlightView;
  now: number;
  onPress: () => void;
}) {
  const { tracked, flight } = view;

  if (!flight) {
    return (
      <Card>
        <SizableText size="lg" fontWeight="700">
          {tracked.number}
        </SizableText>
        <SizableText color="color-10">
          {formatLocalDate(tracked.localDate)} · status unavailable
        </SizableText>
      </Card>
    );
  }

  const dep = flight.departure;
  const arr = flight.arrival;
  const status = statusMeta(flight);
  const depBest = bestTime(dep);
  const arrBest = bestTime(arr);
  const late = minutesLate(dep.times.scheduled, depBest);
  const next = hasDeparted(flight) ? arrBest : depBest;
  const nextLabel = hasDeparted(flight) ? "Arrives" : "Departs";

  return (
    <Card
      cursor="pointer"
      borderColor="border-color hover:border-color-hover"
      onPress={onPress}
      role="button"
      aria-label={`${tracked.number} from ${dep.airport.iata} to ${arr.airport.iata}, ${status.label}`}
    >
      <XStack justify="space-between" items="center">
        <XStack gap="2" items="baseline">
          <SizableText size="base" fontWeight="700">
            {tracked.number}
          </SizableText>
          <SizableText size="sm" color="color-10">
            {tracked.nickname ?? formatLocalDate(tracked.localDate)}
          </SizableText>
        </XStack>
        <Pill tone={status.tone}>{status.label}</Pill>
      </XStack>

      <XStack justify="space-between" items="flex-end">
        <YStack>
          <SizableText size="3xl" fontWeight="800" letterSpacing={-0.5}>
            {dep.airport.iata}
          </SizableText>
          <XStack gap="2" items="baseline">
            <SizableText size="base" fontWeight="600">
              {timeAt(depBest, dep.airport.timeZone)}
            </SizableText>
            {late >= 5 && (
              <SizableText size="sm" color="color-10" textDecorationLine="line-through">
                {timeAt(dep.times.scheduled, dep.airport.timeZone)}
              </SizableText>
            )}
          </XStack>
        </YStack>

        <SizableText size="xl" color="color-8" pb="5">
          →
        </SizableText>

        <YStack items="flex-end">
          <SizableText size="3xl" fontWeight="800" letterSpacing={-0.5}>
            {arr.airport.iata}
          </SizableText>
          <SizableText size="base" fontWeight="600">
            {timeAt(arrBest, arr.airport.timeZone)}
          </SizableText>
        </YStack>
      </XStack>

      {flight.status !== "cancelled" && next && flight.status !== "arrived" && (
        <SizableText size="sm" color="color-10">
          {nextLabel} {relative(Date.parse(next), now)}
          {dep.gate && !hasDeparted(flight) ? ` · Gate ${dep.gate}` : ""}
        </SizableText>
      )}
    </Card>
  );
}
