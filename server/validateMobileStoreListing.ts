import fs from 'node:fs';
import path from 'node:path';
import { SUPPORTED_LOCALES, type ResolvedLanguage } from '../src/lib/languagePreference';

type StoreIcon = {
  id: string;
  path: string;
  width: number;
  height: number;
};

type Screenshot = {
  id: string;
  title: string;
  route: string;
};

type ScreenshotExport = {
  platform: 'ios' | 'android';
  directory: string;
  width: number;
  height: number;
};

type StoreListing = {
  release: string;
  applicationId: string;
  categories: { primary: string; secondary: string };
  apple: {
    name: string;
    subtitle: string;
    promotionalText: string;
    keywords: string;
  };
  googlePlay: {
    name: string;
    shortDescription: string;
  };
  fullDescription: string;
  reviewNotes: string[];
  storeIcons: StoreIcon[];
  screenshots: Screenshot[];
  screenshotExports: ScreenshotExport[];
};

type StoreLocalization = {
  locale: ResolvedLanguage;
  storeLocale: string;
  nativeReviewStatus: 'source_baseline' | 'pending_native_review' | 'approved';
  apple: { name: string; subtitle: string; promotionalText: string; keywords: string };
  googlePlay: { name: string; shortDescription: string };
  fullDescription: string;
  screenshots: Array<{ id: string; title: string }>;
};

const root = process.cwd();
const requireSubmission = process.argv.includes('--require-submission');
const listingPath = path.join(root, 'data/mobile-store-listing.json');
const listing = JSON.parse(fs.readFileSync(listingPath, 'utf8')) as StoreListing;
const localizationPath = path.join(root, 'data/mobile-store-listing-localizations.json');
const localizationBundle = JSON.parse(fs.readFileSync(localizationPath, 'utf8')) as { localizations: StoreLocalization[] };
const appRoutes = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const failures: string[] = [];
const checks: string[] = [];

const assert = (condition: boolean, message: string) => {
  if (condition) checks.push(message);
  else failures.push(message);
};

const readPngDimensions = (filePath: string) => {
  const header = fs.readFileSync(filePath).subarray(0, 24);
  const signature = '89504e470d0a1a0a';
  if (header.length < 24 || header.subarray(0, 8).toString('hex') !== signature) {
    throw new Error(`${path.relative(root, filePath)} is not a valid PNG.`);
  }
  return {
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20),
  };
};

const validatePng = (relativePath: string, width: number, height: number, label: string) => {
  const filePath = path.join(root, relativePath);
  assert(fs.existsSync(filePath), `${label} exists`);
  if (!fs.existsSync(filePath)) return;
  try {
    const dimensions = readPngDimensions(filePath);
    assert(
      dimensions.width === width && dimensions.height === height,
      `${label} is ${width}x${height} PNG`,
    );
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
};

assert(listing.release === 'Voice-free Beta', 'Listing is scoped to Voice-free Beta');
assert(listing.applicationId === 'com.snooze.soundscapes', 'Listing uses the canonical application ID');
assert(listing.apple.name.length > 0 && listing.apple.name.length <= 30, 'Apple app name fits the 30-character limit');
assert(listing.apple.subtitle.length > 0 && listing.apple.subtitle.length <= 30, 'Apple subtitle fits the 30-character limit');
assert(listing.apple.promotionalText.length <= 170, 'Apple promotional text fits the 170-character limit');
assert(listing.apple.keywords.length <= 100, 'Apple keywords fit the 100-character limit');
assert(listing.googlePlay.name.length > 0 && listing.googlePlay.name.length <= 30, 'Play app name fits the 30-character limit');
assert(
  listing.googlePlay.shortDescription.length > 0 && listing.googlePlay.shortDescription.length <= 80,
  'Play short description fits the 80-character limit',
);

assert(
  JSON.stringify(localizationBundle.localizations.map((item) => item.locale)) === JSON.stringify(SUPPORTED_LOCALES),
  'Store localization bundle covers every active consumer locale in canonical order',
);
assert(
  new Set(localizationBundle.localizations.map((item) => item.storeLocale)).size === SUPPORTED_LOCALES.length,
  'Store locale identifiers are unique',
);

const englishLocalization = localizationBundle.localizations.find((item) => item.locale === 'en');
const screenshotIds = listing.screenshots.map((item) => item.id);
for (const item of localizationBundle.localizations) {
  assert(item.apple.name.length > 0 && item.apple.name.length <= 30, `${item.locale} Apple name fits limit`);
  assert(item.apple.subtitle.length > 0 && item.apple.subtitle.length <= 30, `${item.locale} Apple subtitle fits limit`);
  assert(item.apple.promotionalText.length > 0 && item.apple.promotionalText.length <= 170, `${item.locale} Apple promotional text fits limit`);
  assert(item.apple.keywords.length > 0 && item.apple.keywords.length <= 100, `${item.locale} Apple keywords fit limit`);
  assert(item.googlePlay.name.length > 0 && item.googlePlay.name.length <= 30, `${item.locale} Play name fits limit`);
  assert(item.googlePlay.shortDescription.length > 0 && item.googlePlay.shortDescription.length <= 80, `${item.locale} Play short description fits limit`);
  assert(item.fullDescription.length > 0 && item.fullDescription.length <= 4000, `${item.locale} full description fits limit`);
  assert(item.fullDescription.split('\n\n').length === 4, `${item.locale} full description includes product, supply, save, and safety paragraphs`);
  assert(JSON.stringify(item.screenshots.map((shot) => shot.id)) === JSON.stringify(screenshotIds), `${item.locale} screenshot titles cover the canonical journey`);
  assert(item.screenshots.every((shot) => shot.title.trim().length > 0 && shot.title.length <= 80), `${item.locale} screenshot titles fit limits`);
  if (item.locale !== 'en' && englishLocalization) {
    assert(item.apple.subtitle !== englishLocalization.apple.subtitle, `${item.locale} Apple subtitle does not fall back to English`);
    assert(item.googlePlay.shortDescription !== englishLocalization.googlePlay.shortDescription, `${item.locale} Play description does not fall back to English`);
    assert(item.fullDescription !== englishLocalization.fullDescription, `${item.locale} full description does not fall back to English`);
    assert(item.nativeReviewStatus !== 'source_baseline', `${item.locale} does not claim English source approval`);
  }
}
assert(listing.fullDescription.length > 0 && listing.fullDescription.length <= 4000, 'Full description fits the 4000-character limit');
assert(
  listing.fullDescription.includes('does not diagnose, treat, cure, or guarantee health outcomes'),
  'Full description includes the non-medical boundary',
);
assert(listing.reviewNotes.some((note) => note.includes('Voice-free Beta')), 'Review notes disclose the Voice-free Beta boundary');
assert(listing.reviewNotes.some((note) => note.includes('Account deletion')), 'Review notes explain account deletion');
assert(listing.screenshots.length === 6, 'Six consumer-journey screenshots are planned');
assert(new Set(listing.screenshots.map((item) => item.id)).size === listing.screenshots.length, 'Screenshot identifiers are unique');
assert(
  listing.screenshots.every((item) => (
    item.route.startsWith('/')
    && appRoutes.includes(`path="${item.route.slice(1)}"`)
    && !/voice|subscription|payment/i.test(item.title)
  )),
  'Screenshot plan uses existing app routes and avoids deferred claims',
);
assert(
  listing.screenshotExports.some((item) => item.platform === 'ios')
    && listing.screenshotExports.some((item) => item.platform === 'android'),
  'Screenshot exports cover iOS and Android',
);

for (const icon of listing.storeIcons) {
  validatePng(icon.path, icon.width, icon.height, `${icon.id} store icon`);
}

if (requireSubmission) {
  const supportUrl = process.env.SNOOZE_SUPPORT_URL ?? '';
  const privacyUrl = process.env.SNOOZE_PRIVACY_URL ?? '';
  const supportEmail = process.env.VITE_SUPPORT_EMAIL ?? '';
  for (const [label, value] of [['Support URL', supportUrl], ['Privacy URL', privacyUrl]] as const) {
    try {
      const url = new URL(value);
      assert(url.protocol === 'https:' && !/example\.(com|org|net)$/i.test(url.hostname), `${label} is a real HTTPS URL`);
    } catch {
      failures.push(`${label} is a real HTTPS URL`);
    }
  }
  assert(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) && !supportEmail.endsWith('@example.com'),
    'Support email is configured and non-placeholder',
  );

  for (const exportSpec of listing.screenshotExports) {
    for (const screenshot of listing.screenshots) {
      const relativePath = path.join(exportSpec.directory, `${screenshot.id}.png`);
      validatePng(
        relativePath,
        exportSpec.width,
        exportSpec.height,
        `${exportSpec.platform} ${screenshot.id} screenshot`,
      );
    }
  }
}

if (failures.length) {
  throw new Error(`Mobile store listing validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  mode: requireSubmission ? 'submission' : 'repository-baseline',
  checks,
  screenshotCount: listing.screenshots.length,
  localizedStoreListings: localizationBundle.localizations.length,
  pendingNativeStoreReviews: localizationBundle.localizations.filter((item) => item.nativeReviewStatus === 'pending_native_review').length,
  submissionAssets: requireSubmission ? 'verified' : 'pending-external-evidence',
}, null, 2));
