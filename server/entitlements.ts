import { query } from './db';

export const FREE_GENERATION_LIMIT = 3;
export const FREE_SAVED_SOUND_LIMIT = 3;
export const FREE_MAX_SESSION_SECONDS = 30 * 60;
export const COMMUNITY_PREVIEW_SECONDS = 3 * 60;
export const PLUS_MONTHLY_PRICE = 9.99;
export const PLUS_ANNUAL_PRICE = 59.9;
export const PLUS_FOUNDING_ANNUAL_PRICE = 49.9;

export type BillingEntitlement = {
  tier: 'free' | 'pro';
  plan: 'Free' | 'Plus';
  generation: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
  savedSounds: {
    used: number;
    limit: number | null;
  };
  playback: {
    maxSessionSeconds: number | null;
    communityPreviewSeconds: number | null;
    offline: boolean;
  };
  pricing: {
    monthly: number;
    annual: number;
    foundingAnnual: number;
  };
};

const isPlus = (tier: string) => tier === 'pro';

export const getBillingEntitlement = async (userId: string, subscriptionTier?: string): Promise<BillingEntitlement> => {
  const userResult = subscriptionTier
    ? { rows: [{ subscription_tier: subscriptionTier }] }
    : await query<{ subscription_tier: string }>('select subscription_tier from users where id = $1', [userId]);
  const tier = isPlus(String(userResult.rows[0]?.subscription_tier ?? 'free')) ? 'pro' : 'free';
  const counts = await query<{ generated: number; saved: number }>(
    `select
       count(*) filter (where status in ('draft', 'private', 'published'))::int as generated,
       count(*) filter (where status in ('private', 'published'))::int as saved
     from mixes
     where creator_id = $1`,
    [userId],
  );
  const generated = Number(counts.rows[0]?.generated ?? 0);
  const saved = Number(counts.rows[0]?.saved ?? 0);
  const plus = tier === 'pro';

  return {
    tier,
    plan: plus ? 'Plus' : 'Free',
    generation: {
      used: generated,
      limit: plus ? null : FREE_GENERATION_LIMIT,
      remaining: plus ? null : Math.max(0, FREE_GENERATION_LIMIT - generated),
    },
    savedSounds: {
      used: saved,
      limit: plus ? null : FREE_SAVED_SOUND_LIMIT,
    },
    playback: {
      maxSessionSeconds: plus ? null : FREE_MAX_SESSION_SECONDS,
      communityPreviewSeconds: plus ? null : COMMUNITY_PREVIEW_SECONDS,
      offline: plus,
    },
    pricing: {
      monthly: PLUS_MONTHLY_PRICE,
      annual: PLUS_ANNUAL_PRICE,
      foundingAnnual: PLUS_FOUNDING_ANNUAL_PRICE,
    },
  };
};

export const entitlementError = (code: string, entitlement: BillingEntitlement, message: string) => ({
  error: message,
  code,
  entitlement,
});
