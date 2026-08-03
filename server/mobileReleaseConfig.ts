import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type MobileReleaseConfig = {
  apiBaseUrl: string;
  versionName: string;
  buildNumber: number;
  iosDevelopmentTeam: string;
  androidKeystorePath: string;
  androidKeystorePassword: string;
  androidKeyAlias: string;
  androidKeyPassword: string;
};

const parseEnvFile = (filePath: string) => {
  if (!existsSync(filePath)) return {} as Record<string, string>;
  return Object.fromEntries(readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2')];
    }));
};

export const loadMobileReleaseConfig = (
  root = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): MobileReleaseConfig => {
  const fileEnv = parseEnvFile(path.join(root, '.env.mobile'));
  const value = (key: string) => String(env[key] ?? fileEnv[key] ?? '').trim();
  return {
    apiBaseUrl: value('VITE_API_BASE_URL').replace(/\/$/, ''),
    versionName: value('SNOOZE_VERSION'),
    buildNumber: Number(value('SNOOZE_BUILD_NUMBER')),
    iosDevelopmentTeam: value('IOS_DEVELOPMENT_TEAM'),
    androidKeystorePath: value('ANDROID_KEYSTORE_PATH'),
    androidKeystorePassword: value('ANDROID_KEYSTORE_PASSWORD'),
    androidKeyAlias: value('ANDROID_KEY_ALIAS'),
    androidKeyPassword: value('ANDROID_KEY_PASSWORD'),
  };
};

export const validateMobileReleaseConfig = (
  config: MobileReleaseConfig,
  options: { requireIosSigning?: boolean; requireAndroidSigning?: boolean } = {},
) => {
  const errors: string[] = [];
  try {
    const url = new URL(config.apiBaseUrl);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') errors.push('VITE_API_BASE_URL must use HTTPS.');
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '10.0.2.2' || hostname.endsWith('.local')) {
      errors.push('VITE_API_BASE_URL must not use a local hostname.');
    }
    if (hostname === 'example.com' || hostname.endsWith('.example.com')) errors.push('VITE_API_BASE_URL must not use an example domain.');
    if (url.username || url.password || url.search || url.hash) errors.push('VITE_API_BASE_URL must not contain credentials, query parameters, or fragments.');
  } catch {
    errors.push('VITE_API_BASE_URL must be a valid absolute URL.');
  }
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(config.versionName)) errors.push('SNOOZE_VERSION must be a numeric release version such as 1.0.0.');
  if (!Number.isSafeInteger(config.buildNumber) || config.buildNumber < 1) errors.push('SNOOZE_BUILD_NUMBER must be a positive integer.');
  if (options.requireIosSigning && !/^[A-Z0-9]{10}$/.test(config.iosDevelopmentTeam)) {
    errors.push('IOS_DEVELOPMENT_TEAM must be the 10-character Apple team ID.');
  }
  if (options.requireAndroidSigning) {
    if (!config.androidKeystorePath) errors.push('ANDROID_KEYSTORE_PATH is required.');
    else if (!existsSync(path.resolve(config.androidKeystorePath))) errors.push('ANDROID_KEYSTORE_PATH does not exist.');
    if (!config.androidKeystorePassword) errors.push('ANDROID_KEYSTORE_PASSWORD is required.');
    if (!config.androidKeyAlias) errors.push('ANDROID_KEY_ALIAS is required.');
    if (!config.androidKeyPassword) errors.push('ANDROID_KEY_PASSWORD is required.');
  }
  if (errors.length) throw new Error(`Invalid mobile release configuration:\n- ${errors.join('\n- ')}`);
  return config;
};
