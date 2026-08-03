import { pool, query } from './db';
import { planRecipeRenderTracks } from './renderRecipeV2';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';

type JsonObject = Record<string, any>;

const request = async <T extends JsonObject>(pathname: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${pathname} failed (${response.status}): ${body.error ?? JSON.stringify(body)}`);
  }
  return body as T;
};

const requestWithToken = async <T extends JsonObject>(pathname: string, token: string, init?: RequestInit): Promise<T> => request<T>(pathname, {
  ...init,
  headers: { authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
});

const requestExpecting = async (pathname: string, expectedStatus: number, token = '') => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  const body = await response.json().catch(() => ({}));
  assert(response.status === expectedStatus, `Expected ${expectedStatus} for ${pathname}, received ${response.status}.`);
  return body as JsonObject;
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const comparableTracks = (tracks: JsonObject[]) => tracks.map((track) => ({
  stemId: track.stemId,
  role: track.role,
  eventId: track.eventId,
  startTime: track.startTime,
  duration: track.duration,
  volume: track.volume,
  isMuted: track.isMuted,
}));

let mixId = '';
const validationUserIds: string[] = [];

try {
  const creatorGuest = await request<JsonObject>('/api/auth/guest', { method: 'POST' });
  const creatorToken = String(creatorGuest.token ?? '');
  assert(creatorToken, 'Share validation did not create a guest session.');
  validationUserIds.push(String(creatorGuest.user.id));

  const created = await requestWithToken<JsonObject>('/api/quick-create', creatorToken, {
    method: 'POST',
    body: JSON.stringify({
      goal: 'sleep',
      prompt: 'Gentle rain and soft brown noise for sleep, without voice or sudden sounds',
      durationSeconds: 300,
      guidedVoice: false,
    }),
  });
  mixId = String(created.mix?.id ?? '');
  assert(mixId, 'Share validation did not create a mix.');

  const published = await requestWithToken<JsonObject>(`/api/mixes/${mixId}`, creatorToken, {
    method: 'PATCH',
    body: JSON.stringify({
      title: 'Rain for Tonight',
      description: 'A quiet soundscape for winding down.',
      status: 'published',
      recipeData: created.mix.recipeData,
    }),
  });
  const frozenVersionId = String(published.publishedVersionId ?? '');
  assert(frozenVersionId, 'Publishing did not create a frozen recipe version.');
  assert(published.recipeData?.versionState === 'frozen', 'Published recipe is not frozen.');

  const tonight = await requestWithToken<JsonObject>(`/api/mixes/${mixId}/share-links`, creatorToken, {
    method: 'POST',
    body: JSON.stringify({
      intent: 'tonight',
      visibility: 'public',
      title: 'Tonight, these sounds are with me',
      description: 'Letting the rain carry the day away.',
      creatorName: 'Validation Creator',
    }),
  });
  const gift = await requestWithToken<JsonObject>(`/api/mixes/${mixId}/share-links`, creatorToken, {
    method: 'POST',
    body: JSON.stringify({
      intent: 'gift',
      visibility: 'public',
      title: 'A quiet sound for you',
      description: 'Made after hearing you had trouble sleeping.',
      creatorName: 'Validation Creator',
      recipientLabel: 'A friend',
      personalMessage: 'No need to reply. I hope this gives you a gentler night.',
    }),
  });
  const secondGiftLink = await requestWithToken<JsonObject>(`/api/mixes/${mixId}/share-links`, creatorToken, {
    method: 'POST',
    body: JSON.stringify({
      intent: 'gift',
      visibility: 'unlisted',
      title: 'A second private sound',
      creatorName: 'Validation Creator',
    }),
  });

  assert(tonight.recipeVersionId === frozenVersionId, 'Tonight link did not bind to the published frozen version.');
  assert(gift.recipeVersionId === frozenVersionId, 'Gift link did not bind to the published frozen version.');
  assert(tonight.visibility === 'public', 'Tonight link did not preserve public visibility.');
  assert(gift.visibility === 'unlisted', 'Gift link must always be unlisted.');
  assert(secondGiftLink.slug !== gift.slug, 'Each private share must create a distinct one-person link.');
  assert(typeof gift.creatorPreviewToken === 'string' && gift.creatorPreviewToken.length > 20, 'Private share did not return a creator preview token.');

  const tonightPayload = await request<JsonObject>(`/api/share-links/${tonight.slug}`);
  const giftCreatorPreview = await request<JsonObject>(`/api/share-links/${gift.slug}?creatorPreviewToken=${encodeURIComponent(gift.creatorPreviewToken)}`);
  assert(giftCreatorPreview.shareLink.recipientClaimed === false, 'Creator preview incorrectly claimed the private link.');
  const lockedGift = await requestExpecting(`/api/share-links/${gift.slug}`, 401);
  assert(lockedGift.code === 'private_share_login_required', 'Private share did not require registration or login.');
  assert(lockedGift.preview?.title === 'A quiet sound for you', 'Private login mask did not receive the safe work preview.');
  const firstRecipient = await request<JsonObject>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: 'First Recipient', email: `first-${Date.now()}@share.test`, password: 'share-test-password' }),
  });
  validationUserIds.push(firstRecipient.user.id);
  const giftPayload = await requestWithToken<JsonObject>(`/api/share-links/${gift.slug}`, firstRecipient.token);
  const claimedAnonymous = await requestExpecting(`/api/share-links/${gift.slug}`, 403);
  assert(claimedAnonymous.code === 'private_share_already_claimed', 'Claimed private share did not show the blocked mask to another anonymous viewer.');
  assert(claimedAnonymous.preview?.title === 'A quiet sound for you', 'Claimed mask did not receive the safe work preview.');
  const secondRecipient = await request<JsonObject>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: 'Second Recipient', email: `second-${Date.now()}@share.test`, password: 'share-test-password' }),
  });
  validationUserIds.push(secondRecipient.user.id);
  const rejectedSecondRecipient = await requestExpecting(`/api/share-links/${gift.slug}`, 403, secondRecipient.token);
  assert(rejectedSecondRecipient.code === 'private_share_already_claimed', 'Second account was not rejected from private share.');
  const expectedTracks = comparableTracks(planRecipeRenderTracks(published.recipeData));
  assert(
    JSON.stringify(comparableTracks(tonightPayload.tracks)) === JSON.stringify(expectedTracks),
    'Tonight recipient playback differs from the frozen Recipe V2 plan.',
  );
  assert(
    JSON.stringify(comparableTracks(giftPayload.tracks)) === JSON.stringify(expectedTracks),
    'Gift recipient playback differs from the frozen Recipe V2 plan.',
  );
  assert(giftPayload.shareLink.personalMessage === 'No need to reply. I hope this gives you a gentler night.', 'Gift message snapshot was not preserved.');
  assert(!('prompt' in tonightPayload.shareLink), 'Private creation prompt leaked into share metadata.');
  assert(!('recipeData' in tonightPayload.shareLink), 'Private recipe data leaked into share metadata.');

  const eventTypes = ['share_page_opened', 'playback_requested', 'playback_started', 'meaningful_listen'] as const;
  for (const [index, eventType] of eventTypes.entries()) {
    await request<JsonObject>(`/api/share-links/${tonight.slug}/events`, {
      method: 'POST',
      body: JSON.stringify({
        eventType,
        visitorId: 'share_loop_visitor',
        source: 'validation',
        elapsedMs: index * 1000,
        playbackSeconds: eventType === 'meaningful_listen' ? 150 : 0,
      }),
    });
  }
  await requestWithToken<JsonObject>(`/api/share-links/${gift.slug}/events`, firstRecipient.token, {
    method: 'POST',
    body: JSON.stringify({
      eventType: 'gift_response_sent',
      visitorId: 'share_loop_gift_visitor',
      source: 'validation',
      details: { response: 'Listening tonight' },
    }),
  });

  const events = await query<{ slug: string; event_type: string; anonymous_visitor_id: string; playback_seconds: number }>(
    `select sl.slug, se.event_type, se.anonymous_visitor_id, se.playback_seconds
     from share_events se join share_links sl on sl.id = se.share_link_id
     where sl.mix_id = $1 order by se.created_at`,
    [mixId],
  );
  assert(events.rows.length === 5, `Expected 5 persisted share events, found ${events.rows.length}.`);
  assert(events.rows.some((event) => event.event_type === 'playback_started'), 'Playback start event was not persisted.');
  assert(events.rows.some((event) => event.event_type === 'meaningful_listen' && event.playback_seconds === 150), 'Meaningful listen duration was not persisted.');
  assert(events.rows.some((event) => event.event_type === 'gift_response_sent'), 'Gift response event was not persisted.');

  console.log(JSON.stringify({
    passed: true,
    mixId,
    frozenVersionId,
    tonightSlug: tonight.slug,
    giftSlug: gift.slug,
    recipientTrackCount: expectedTracks.length,
    eventCount: events.rows.length,
  }, null, 2));
} finally {
  if (mixId) {
    await query('delete from user_history where mix_id = $1', [mixId]);
    await query('delete from ai_sessions where generated_mix_id = $1', [mixId]);
    await query('delete from mixes where id = $1', [mixId]);
  }
  for (const userId of validationUserIds) await query('delete from users where id = $1', [userId]);
  await pool.end();
}
