import { defaultConfig } from "@tamagui/config/v6";
import { createTamagui } from "tamagui";

// Tamagui's default v6 config: light/dark themes plus accent, green, red and yellow sub-themes,
// which the app uses for flight status colours. Customise tokens here when the design settles.
export const tamaguiConfig = createTamagui(defaultConfig);

export default tamaguiConfig;

export type Conf = typeof tamaguiConfig;

declare module "tamagui" {
  // Tamagui's required pattern for typing tokens and themes app-wide.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends Conf {}
}
