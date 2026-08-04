type FinishedContentLoudness = {
  integratedLufs: number;
  truePeakDb: number;
};

const measurements: Record<string, FinishedContentLoudness> = {
  calm_014_saveable_warm_room: { integratedLufs: -35.0, truePeakDb: -22.7 },
  calm_015_warm_room_extended: { integratedLufs: -33.4, truePeakDb: -20.9 },
  calm_016_after_work_settle: { integratedLufs: -33.7, truePeakDb: -21.2 },
  calm_017_morning_clear_room: { integratedLufs: -32.2, truePeakDb: -19.6 },
  calm_018_evening_release: { integratedLufs: -32.3, truePeakDb: -19.4 },
  calm_019_midday_recenter: { integratedLufs: -30.9, truePeakDb: -18.3 },
  calm_020_before_meeting_settle: { integratedLufs: -32.3, truePeakDb: -18.8 },
  calm_021_emotional_buffer: { integratedLufs: -29.8, truePeakDb: -17.1 },
  calm_022_weekend_unwind: { integratedLufs: -32.7, truePeakDb: -18.6 },
  calm_023_after_work_release: { integratedLufs: -32.8, truePeakDb: -18.1 },
  focus_017_saveable_low_workbed: { integratedLufs: -42.9, truePeakDb: -30.7 },
  focus_018_low_workbed_clear: { integratedLufs: -40.2, truePeakDb: -28.1 },
  focus_019_open_low_attention: { integratedLufs: -41.0, truePeakDb: -28.4 },
  focus_020_reading_low_light: { integratedLufs: -38.9, truePeakDb: -26.3 },
  focus_021_deep_work_stable: { integratedLufs: -37.7, truePeakDb: -25.4 },
  focus_022_writing_flow_low: { integratedLufs: -36.8, truePeakDb: -24.1 },
  focus_023_low_energy_admin: { integratedLufs: -36.6, truePeakDb: -23.9 },
  focus_024_coding_low_loop: { integratedLufs: -34.5, truePeakDb: -22.1 },
  focus_025_study_long_arc: { integratedLufs: -35.3, truePeakDb: -22.1 },
  focus_026_reading_low_distraction: { integratedLufs: -34.6, truePeakDb: -20.4 },
  sleep_018_saveable_soft_descent: { integratedLufs: -35.6, truePeakDb: -19.6 },
  sleep_019_soft_descent_deeper: { integratedLufs: -33.5, truePeakDb: -17.6 },
  sleep_020_return_sleep_soft_floor: { integratedLufs: -35.5, truePeakDb: -19.7 },
  sleep_021_nap_soft_hold: { integratedLufs: -34.1, truePeakDb: -18.7 },
  sleep_022_late_night_blanket: { integratedLufs: -32.9, truePeakDb: -17.4 },
  sleep_023_travel_rest_shell: { integratedLufs: -32.1, truePeakDb: -17.0 },
  sleep_024_restless_mind_downshift: { integratedLufs: -33.8, truePeakDb: -18.4 },
  sleep_025_anxious_bedtime_soften: { integratedLufs: -32.7, truePeakDb: -17.8 },
  sleep_026_early_morning_return: { integratedLufs: -33.0, truePeakDb: -17.5 },
  sleep_027_phone_down_bedtime: { integratedLufs: -32.6, truePeakDb: -17.5 },
};

const dbForVolume = (volume: number) => 20 * Math.log10(Math.max(0.01, volume / 100));

export const finishedContentSourceGainDb = (id: string, goal: string, volume: number) => {
  const measurement = measurements[id];
  if (!measurement) throw new Error(`Missing loudness measurement for finished content ${id}`);
  const targetLufs = goal === 'focus' ? -27 : -28;
  const volumeDb = dbForVolume(volume);
  const loudnessGain = targetLufs - measurement.integratedLufs - volumeDb;
  const peakLimitedGain = -6 - measurement.truePeakDb - volumeDb;
  return Math.round(Math.max(0, Math.min(18, loudnessGain, peakLimitedGain)) * 10) / 10;
};

export const finishedContentLoudnessMeasurements = measurements;
