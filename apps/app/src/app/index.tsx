import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { Button, H2, Paragraph, SizableText, XStack, YStack } from "tamagui";
import { AddFlightForm } from "@/components/AddFlightForm";
import { FlightCard } from "@/components/FlightCard";
import { FlightDetail } from "@/components/FlightDetail";
import { Popup } from "@/components/Popup";
import { Card, Screen } from "@/components/ui";
import { useFlightList, useNow } from "@/lib/hooks";
import { isFinished } from "@/lib/status";

/**
 * My flights: the home screen. Flight detail and Add flight open as popups on top of it,
 * tracked in the URL (`/?flight=<id>`, `/?add=1`) so a refresh or shared link reopens them.
 */
export default function MyFlights() {
  const { data, error, loading, reload } = useFlightList();
  const now = useNow();
  const { flight: openId, add } = useLocalSearchParams<{ flight?: string; add?: string }>();

  const openFlight = (id: string) => router.setParams({ flight: id, add: undefined });
  const openAdd = () => router.setParams({ add: "1", flight: undefined });
  const close = useCallback(() => router.setParams({ flight: undefined, add: undefined }), []);

  const upcoming = (data ?? []).filter((v) => !v.flight || !isFinished(v.flight));
  const past = (data ?? []).filter((v) => v.flight && isFinished(v.flight)).reverse();

  return (
    <YStack flex={1}>
      <Screen>
        <XStack justify="space-between" items="center">
          <YStack>
            <SizableText size="sm" color="color-10" fontWeight="600" letterSpacing={1}>
              XPLORIO
            </SizableText>
            <H2>My flights</H2>
          </YStack>
          <Button theme="accent" onPress={openAdd}>
            Add flight
          </Button>
        </XStack>

        {error && (
          <Card>
            <Paragraph>Couldn't load your flights: {error}</Paragraph>
            <Button size="sm" self="flex-start" onPress={() => void reload()}>
              Try again
            </Button>
          </Card>
        )}

        {loading && !data && <Paragraph color="color-10">Loading…</Paragraph>}

        {data && data.length === 0 && (
          <Card items="center" py="10" gap="3">
            <SizableText size="xl" fontWeight="700">
              No flights yet
            </SizableText>
            <Paragraph color="color-10" text="center" maxW={320}>
              Add a flight by its number and date to see live status, gates and delays.
            </Paragraph>
            <Button theme="accent" onPress={openAdd}>
              Add your first flight
            </Button>
          </Card>
        )}

        {upcoming.length > 0 && (
          <YStack gap="3">
            <SizableText size="sm" fontWeight="700" color="color-10">
              UPCOMING
            </SizableText>
            {upcoming.map((v) => (
              <FlightCard
                key={v.tracked.id}
                view={v}
                now={now}
                onPress={() => openFlight(v.tracked.id)}
              />
            ))}
          </YStack>
        )}

        {past.length > 0 && (
          <YStack gap="3">
            <SizableText size="sm" fontWeight="700" color="color-10">
              PAST
            </SizableText>
            {past.map((v) => (
              <FlightCard
                key={v.tracked.id}
                view={v}
                now={now}
                onPress={() => openFlight(v.tracked.id)}
              />
            ))}
          </YStack>
        )}
      </Screen>

      {openId && (
        <Popup label="Flight details" onClose={close}>
          <FlightDetail
            key={openId}
            id={openId}
            onRemoved={() => {
              close();
              void reload();
            }}
          />
        </Popup>
      )}

      {add && !openId && (
        <Popup label="Add a flight" onClose={close}>
          <AddFlightForm
            onAdded={(id) => {
              void reload();
              openFlight(id);
            }}
          />
        </Popup>
      )}
    </YStack>
  );
}
