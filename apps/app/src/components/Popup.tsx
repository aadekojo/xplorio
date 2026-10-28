import { useEffect, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, XStack, YStack } from "tamagui";

/**
 * Dialog laid over the current screen. Rendered inline (not in a portal) so it inherits the
 * Tamagui theme. Closes on the ✕ button, a backdrop tap or Escape on web.
 */
export function Popup({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <View style={StyleSheet.absoluteFill} role="dialog" aria-modal aria-label={label}>
      <Pressable style={styles.backdrop} onPress={onClose} aria-label="Close" />
      <YStack flex={1} justify="center" items="center" p="4" pointerEvents="box-none">
        <YStack
          w="100%"
          maxW={560}
          maxH="100%"
          bg="background"
          borderWidth={1}
          borderColor="border-color"
          rounded="xl"
          overflow="hidden"
        >
          <ScrollView>
            <YStack p="4" pt="2" gap="5">
              <XStack justify="flex-end" mb="-4">
                <Button size="sm" variant="quiet" onPress={onClose} aria-label="Close">
                  ✕
                </Button>
              </XStack>
              {children}
            </YStack>
          </ScrollView>
        </YStack>
      </YStack>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0, 0, 0, 0.5)" },
});
