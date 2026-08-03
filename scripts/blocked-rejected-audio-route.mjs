const routeName = process.argv[2] || 'this audio generation route';

console.error(`${routeName} is blocked as a SNOOZE product-content route.`);
console.error('Reason: user listening QA rejected the song-prior/local-model outputs as not suitable for sleep, meditation, or focus.');
console.error('Run `pnpm check:open-audio-route` and use the controlled stem factory route instead.');

process.exit(1);
