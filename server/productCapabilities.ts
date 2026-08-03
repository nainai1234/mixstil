export const productCapabilities = {
  releaseChannel: 'voice-free-beta' as const,
  guidedVoice: process.env.GUIDED_VOICE_ENABLED === 'true',
};
