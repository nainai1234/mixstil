import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type StoreLocalization = {
  locale: string;
  storeLocale: string;
  nativeReviewStatus: 'source_baseline' | 'pending_native_review' | 'approved';
  apple: {
    name: string;
    subtitle: string;
    promotionalText: string;
    keywords: string;
  };
  fullDescription: string;
  screenshots: Array<{ id: string; title: string }>;
};

const root = process.cwd();
const inputPath = path.join(root, 'data', 'mobile-store-listing-localizations.json');
const outputPath = path.join(root, 'docs', 'app-store-connect-localization-review.md');
const bundle = JSON.parse(await readFile(inputPath, 'utf8')) as { localizations: StoreLocalization[] };

const sections = bundle.localizations.map((item) => `## ${item.storeLocale} (${item.locale})

Review status: \`${item.nativeReviewStatus}\`

- App name: \`${item.apple.name}\`
- Subtitle: ${item.apple.subtitle}
- Promotional text: ${item.apple.promotionalText}
- Keywords: \`${item.apple.keywords}\`

Description:

${item.fullDescription}

Screenshot titles:

${item.screenshots.map((shot, index) => `${index + 1}. ${shot.title} (\`${shot.id}\`)`).join('\n')}`);

const document = `# MixStil App Store Connect Localization Review

Generated from \`data/mobile-store-listing-localizations.json\`.

Release scope: Voice-free Beta  
Primary category: Health & Fitness  
Secondary category: Lifestyle  
Primary audience: adults using sound for bedtime, quiet relaxation, and focused work  
Age-rating direction: use Apple's current questionnaire truthfully; if a higher voluntary rating is desired, choose the nearest available higher override rather than changing questionnaire answers  
Native review rule: every non-English localization remains \`pending_native_review\` until a named native reviewer approves it

Do not claim diagnosis, treatment, cure, guaranteed sleep, anxiety treatment, or scientifically proven frequency effects.

${sections.join('\n\n')}
`;

await writeFile(outputPath, document);
console.log(JSON.stringify({ outputPath, localeCount: bundle.localizations.length }, null, 2));
