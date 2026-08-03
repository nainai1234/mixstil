const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
export {};

const mixIds: string[] = [];
let renderedAudioUrl = '';
let authToken = '';

const request = async (pathname: string, init?: RequestInit, expectedStatus?: number) => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (expectedStatus != null) {
    if (response.status !== expectedStatus) throw new Error(`${init?.method ?? 'GET'} ${pathname}: expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(body)}`);
    return body;
  }
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${pathname}: ${body.error ?? response.statusText}`);
  return body;
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

try {
  const guest = await request('/api/auth/guest', { method: 'POST' });
  authToken = String(guest.token ?? '');
  assert(authToken, 'Voice-free Beta validation could not create a guest session.');
  const capabilities = await request('/api/product-capabilities');
  assert(capabilities.releaseChannel === 'voice-free-beta' && capabilities.guidedVoice === false, 'Runtime is not in voice-free beta mode.');

  const created = await request('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      goal: 'sleep',
      prompt: '睡前需要几句柔和中文人声，然后进入安静温暖的背景，不要水声',
      durationSeconds: 300,
      guidedVoice: true,
      voiceIntensity: 100,
    }),
  });
  const mixId = String(created.mix?.id ?? '');
  assert(mixId, 'Voice-free beta did not create a fallback mix.');
  mixIds.push(mixId);
  assert(created.audioIntent?.guidedVoice?.enabled === false, 'Voice request was not downgraded.');
  assert(created.audioIntent?.intensity?.voice === 0, 'Voice intensity was not forced to zero.');
  assert(created.audioIntent?.excludedSounds?.includes('voice'), 'Voice exclusion was not recorded in AudioIntent.');
  assert(!String(created.mix.description ?? '').includes('睡前需要几句柔和中文人声'), 'Private creation prompt leaked into the default work description.');
  assert(created.mix.recipeData.contentMode === 'pure_soundscape', 'Voice-only request did not downgrade to a pure soundscape.');
  assert(!created.mix.recipeData.tracks.some((track: any) => track.role === 'voice' && !track.isMuted), 'Voice-free Recipe contains an audible Voice track.');
  assert(!created.tracks.some((track: any) => track.role === 'voice'), 'Live Mix contains a Voice track.');

  const voiceAttempt = await request(`/api/mixes/${mixId}/voice-preview/ensure`, { method: 'POST' }, 409);
  assert(voiceAttempt.code === 'guided_voice_disabled' && voiceAttempt.fallback === 'voice_off', 'Voice endpoint did not return the controlled beta fallback.');

  const adjusted = await request(`/api/mixes/${mixId}/recipe-edits`, {
    method: 'POST',
    body: JSON.stringify({ instruction: '整体更安静' }),
  });
  const published = await request(`/api/mixes/${mixId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: 'Voice-free Beta Validation',
      description: 'A voice-free personalized soundscape.',
      status: 'published',
      recipeData: adjusted.mix.recipeData,
    }),
  });
  assert(published.publishedVersionId && published.recipeData.versionState === 'frozen', 'Voice-free Recipe did not freeze on publish.');

  const exportCheck = await request(`/api/mixes/${mixId}/export-check`);
  assert(exportCheck.exportReady, `Approved voice-free mix failed export checks: ${JSON.stringify(exportCheck.blockedStems)}`);
  const rendered = await request(`/api/mixes/${mixId}/render`, { method: 'POST', body: '{}' });
  renderedAudioUrl = String(rendered.renderedAudioUrl ?? '');
  assert(renderedAudioUrl && rendered.mix.renderStatus === 'ready', 'Voice-free frozen Recipe did not render.');

  const share = await request(`/api/mixes/${mixId}/share-links`, {
    method: 'POST',
    body: JSON.stringify({ intent: 'tonight', visibility: 'public', title: 'Voice-free Beta Validation' }),
  });
  const shared = await request(`/api/share-links/${share.slug}`);
  assert(shared.tracks.length > 0 && !shared.tracks.some((track: any) => track.role === 'voice'), 'Shared playback contains Voice or has no playable tracks.');
  assert(!String(shared.shareLink.description ?? '').includes('睡前需要几句柔和中文人声'), 'Private creation prompt leaked into shared metadata.');

  const blockedCreated = await request('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({ goal: 'focus', prompt: '安静专注音乐，不要人声', durationSeconds: 300 }),
  });
  const blockedMixId = String(blockedCreated.mix.id);
  mixIds.push(blockedMixId);
  const injectedRecipe = structuredClone(blockedCreated.mix.recipeData);
  injectedRecipe.tracks.push({
    ...injectedRecipe.tracks[0],
    stemId: 'stem_liaoyu_voice_zh_bedtime_release',
    role: 'voice',
    volume: 30,
    isMuted: false,
    startTime: 5,
    duration: 12,
    trimStart: 0,
    trimEnd: 12,
    loop: { enabled: false, crossfadeSeconds: 0 },
  });
  await request(`/api/mixes/${blockedMixId}`, { method: 'PATCH', body: JSON.stringify({ recipeData: injectedRecipe }) });
  const blockedCheck = await request(`/api/mixes/${blockedMixId}/export-check`);
  const blockedVoice = blockedCheck.blockedStems?.find((stem: any) => stem.stemId === 'stem_liaoyu_voice_zh_bedtime_release');
  assert(!blockedCheck.exportReady && blockedVoice?.reasons?.includes('voice_disabled_in_beta'), 'Injected Voice track was not blocked by the beta release gate.');

  console.log(JSON.stringify({
    passed: true,
    releaseChannel: capabilities.releaseChannel,
    fallbackContentMode: created.mix.recipeData.contentMode,
    trackCount: created.tracks.length,
    publishedVersionId: published.publishedVersionId,
    renderedAudioUrl,
    shareSlug: share.slug,
    voiceEndpointStatus: 409,
    injectedVoiceBlocked: true,
  }, null, 2));
} finally {
  if (authToken) {
    await fetch(`${API_BASE}/api/me`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${authToken}`, 'x-confirm-account-deletion': 'DELETE' },
    }).catch(() => undefined);
  }
}
