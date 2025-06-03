import Constants from 'expo-constants';

interface ExtraConfig {
  // Add any additional config options here
}

// Access environment variables through Expo's Constants
const extra = Constants.expoConfig?.extra as ExtraConfig;

export const Config = {
  // Add any configuration values here
}; 