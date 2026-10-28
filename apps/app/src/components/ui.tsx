import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { SizableText, Theme, XStack, YStack, type YStackProps } from "tamagui";
import { toneTheme, type Tone } from "@/lib/status";

/** Page wrapper: full-height background, centred column capped at phone-ish width on desktop. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <YStack flex={1} bg="background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack w="100%" maxW={640} self="center" px="4" pt="6" pb="12" gap="5">
          {children}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

/** Small rounded label coloured by tone (green on time, yellow delayed, red cancelled, blue live). */
export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const theme = toneTheme[tone];
  const pill = (
    <XStack bg="color-3" px="3" py="1" rounded="full" items="center" gap="2">
      {tone === "live" && <YStack w={6} h={6} rounded="full" bg="color-9" />}
      <SizableText size="sm" fontWeight="600" color="color-11">
        {children}
      </SizableText>
    </XStack>
  );
  return theme ? <Theme name={theme}>{pill}</Theme> : pill;
}

/** Bordered surface used for flight cards and detail panels. */
export function Card({ children, ...rest }: YStackProps) {
  return (
    <YStack
      bg="color-2"
      borderWidth={1}
      borderColor="border-color"
      rounded="xl"
      p="4"
      gap="3"
      {...rest}
    >
      {children}
    </YStack>
  );
}

/** Quiet label over a value, e.g. "Gate" / "B23". */
export function Stat({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <YStack items={align === "right" ? "flex-end" : "flex-start"} gap="1">
      <SizableText size="xs" color="color-10" textTransform="uppercase" letterSpacing={0.6}>
        {label}
      </SizableText>
      <SizableText size="lg" fontWeight="600" color="color">
        {value}
      </SizableText>
    </YStack>
  );
}
