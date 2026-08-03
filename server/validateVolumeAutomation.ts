import {
  addVolumeAutomationPoint,
  createVolumeAutomationPreset,
  normalizeVolumeAutomation,
  updateVolumeAutomationPoint,
} from '../src/lib/volumeAutomation.js';

const duration = 600;
const rise = createVolumeAutomationPreset('rise', duration, 80);
if (rise.length !== 5 || rise[0].atSeconds !== 0 || rise.at(-1)?.atSeconds !== duration) {
  throw new Error('Rise preset must cover the complete track duration.');
}
if (!rise.every((point, index) => index === 0 || point.volume > rise[index - 1].volume)) {
  throw new Error('Rise preset must increase monotonically.');
}

const dip = createVolumeAutomationPreset('dip', duration, 80);
if (dip[2].volume >= dip[0].volume || dip[2].volume >= dip.at(-1)!.volume) {
  throw new Error('Center dip preset must lower the middle of the track.');
}

const normalized = normalizeVolumeAutomation([{ atSeconds: 200, volume: 140 }], duration, 50);
if (normalized.length !== 5 || normalized[0].atSeconds !== 0 || normalized.at(-1)?.atSeconds !== duration || normalized.some((point) => point.volume !== 100)) {
  throw new Error('Automation normalization did not produce five draggable points or clamp volume.');
}

const added = addVolumeAutomationPoint(rise, duration);
if (added.points.length !== 6 || added.selectedIndex <= 0 || added.selectedIndex >= added.points.length - 1) {
  throw new Error('Adding an automation point did not create a selectable interior point.');
}

const moved = updateVolumeAutomationPoint(added.points, added.selectedIndex, { atSeconds: duration * 0.6, volume: 33 }, duration);
if (moved[added.selectedIndex].volume !== 33 || moved[added.selectedIndex].atSeconds <= moved[added.selectedIndex - 1].atSeconds || moved[added.selectedIndex].atSeconds >= moved[added.selectedIndex + 1].atSeconds) {
  throw new Error('Automation point editing broke chronological ordering.');
}

console.log('Volume automation validation passed for presets, normalization, insertion, and point editing.');
