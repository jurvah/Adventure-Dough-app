import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.heather.adventuredough",
  appName: "Adventure Dough",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
