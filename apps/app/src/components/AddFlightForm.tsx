import { useState } from "react";
import { Button, H2, Input, Label, Paragraph, SizableText, Theme, XStack, YStack } from "tamagui";
import { api } from "@/lib/api";
import { localDateOffset } from "@/lib/format";

const QUICK_DATES = [
  { label: "Today", offset: 0 },
  { label: "Tomorrow", offset: 1 },
  { label: "In 2 days", offset: 2 },
];

/** Add-a-flight form shown in a popup over My flights. Calls `onAdded` with the new tracked id. */
export function AddFlightForm({ onAdded }: { onAdded: (id: string) => void }) {
  const [number, setNumber] = useState("");
  const [localDate, setLocalDate] = useState(() => localDateOffset(0));
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(undefined);
    try {
      const view = await api.addFlight({
        number,
        localDate,
        ...(nickname.trim() && { nickname: nickname.trim() }),
      });
      onAdded(view.tracked.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that flight.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <H2>Add a flight</H2>

      <YStack gap="4">
        <YStack gap="2">
          <Label htmlFor="number">Flight number</Label>
          <Input
            id="number"
            size="lg"
            placeholder="AC262"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            value={number}
            onChangeText={(t) => setNumber(t.toUpperCase())}
            onSubmitEditing={() => void submit()}
          />
        </YStack>

        <YStack gap="2">
          <Label htmlFor="date">Departure date</Label>
          <Input id="date" placeholder="YYYY-MM-DD" value={localDate} onChangeText={setLocalDate} />
          <XStack gap="2" flexWrap="wrap">
            {QUICK_DATES.map((d) => {
              const value = localDateOffset(d.offset);
              return (
                <Button
                  key={d.label}
                  size="sm"
                  theme={value === localDate ? "accent" : undefined}
                  onPress={() => setLocalDate(value)}
                >
                  {d.label}
                </Button>
              );
            })}
          </XStack>
        </YStack>

        <YStack gap="2">
          <Label htmlFor="nickname">Nickname (optional)</Label>
          <Input
            id="nickname"
            placeholder="Trip to Toronto"
            value={nickname}
            onChangeText={setNickname}
            maxLength={60}
          />
        </YStack>

        {error && (
          <Theme name="red">
            <SizableText color="color-11" size="sm" role="alert">
              {error}
            </SizableText>
          </Theme>
        )}

        <Button
          theme="accent"
          size="lg"
          disabled={saving || !number.trim()}
          opacity={saving || !number.trim() ? 0.6 : 1}
          onPress={() => void submit()}
        >
          {saving ? "Adding…" : "Track this flight"}
        </Button>
      </YStack>

      <Paragraph size="sm" color="color-10">
        Using sample flight data while Xplorio is being designed. Numbers ending in D show a delay;
        numbers ending in X show a cancellation.
      </Paragraph>
    </>
  );
}
