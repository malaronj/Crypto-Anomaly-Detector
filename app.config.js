import 'dotenv/config';

export default {
  expo: {
    name: "crypto-anomaly-detector",
    slug: "crypto-anomaly-detector",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    scheme: "crypto-anomaly-detector",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.cryptoanomalydetector"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.cryptoanomalydetector"
    },
    web: {
      favicon: "./assets/favicon.png"
    }
  }
}; 