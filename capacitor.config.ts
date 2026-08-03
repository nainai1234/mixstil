import type { CapacitorConfig } from '@capacitor/cli';

const localDeviceDebug = process.env.CAPACITOR_LOCAL_DEV === '1';

const config: CapacitorConfig = {
  appId: 'com.snooze.soundscapes',
  appName: 'MixStil',
  webDir: 'dist-mobile',
  backgroundColor: '#09090d',
  server: {
    androidScheme: localDeviceDebug ? 'http' : 'https',
    cleartext: localDeviceDebug,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
