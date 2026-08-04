import { query } from './db';

export const createSchema = async () => {
  await query(`
    create table if not exists users (
      id text primary key,
      username text not null,
      email text not null unique,
      avatar_url text not null default '',
      role text not null check (role in ('consumer', 'creator', 'admin')),
      subscription_tier text not null check (subscription_tier in ('free', 'pro')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table users add column if not exists password_hash text not null default '';

    create table if not exists auth_sessions (
      id text primary key,
      token_hash text not null unique,
      user_id text not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );

    create index if not exists auth_sessions_user_idx on auth_sessions(user_id, expires_at desc);

    create table if not exists user_sound_profiles (
      user_id text primary key references users(id) on delete cascade,
      liked_sounds text[] not null default '{}',
      excluded_sounds text[] not null default '{}',
      default_goal text not null default 'sleep',
      default_duration_seconds integer not null default 900,
      sensitivity jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );

    create table if not exists preference_evidence (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      kind text not null check (kind in ('like', 'exclusion', 'default_goal', 'default_duration', 'sensitivity')),
      value text not null,
      source text not null check (source in ('explicit_profile', 'saved_sound', 'ai_refinement', 'playback_behavior')),
      stable boolean not null default false,
      mix_id text,
      details jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create index if not exists preference_evidence_user_idx on preference_evidence(user_id, created_at desc);
    create index if not exists preference_evidence_stable_idx on preference_evidence(user_id, stable, kind);

    create table if not exists audio_assets (
      id text primary key,
      storage_url text not null,
      original_filename text not null default '',
      media_type text not null default 'audio',
      file_sha256 text not null default '',
      source_platform text not null default 'Unknown',
      source_url text not null default '',
      source_item_id text not null default '',
      source_creator text not null default '',
      license_name text not null default 'Unknown',
      license_url text not null default '',
      commercial_use_allowed boolean not null default false,
      derivative_use_allowed boolean not null default false,
      attribution_required boolean not null default true,
      raw_redistribution_allowed boolean not null default false,
      rights_status text not null default 'pending' check (rights_status in ('pending', 'approved', 'rejected')),
      technical_qa_status text not null default 'pending' check (technical_qa_status in ('pending', 'passed', 'failed')),
      listening_qa_status text not null default 'pending' check (listening_qa_status in ('pending', 'passed', 'failed')),
      lifecycle_status text not null default 'candidate' check (lifecycle_status in ('candidate', 'needs_review', 'approved', 'rejected')),
      production_allowed boolean not null default false,
      governance jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create unique index if not exists audio_assets_sha256_unique_idx on audio_assets(file_sha256) where file_sha256 <> '';
    create index if not exists audio_assets_release_idx on audio_assets(production_allowed, lifecycle_status);

    create table if not exists asset_upload_sessions (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      upload_id text not null,
      object_key text not null,
      original_filename text not null,
      content_type text not null,
      file_size bigint not null check (file_size > 0),
      part_size integer not null check (part_size >= 5242880),
      status text not null default 'uploading' check (status in ('uploading', 'finalizing', 'completed', 'aborted', 'failed')),
      metadata jsonb not null default '{}'::jsonb,
      file_sha256 text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      completed_at timestamptz
    );

    create index if not exists asset_upload_sessions_user_idx on asset_upload_sessions(user_id, updated_at desc);
    create unique index if not exists asset_upload_sessions_active_object_idx
      on asset_upload_sessions(object_key) where status = 'uploading';

    create table if not exists audio_stems (
      id text primary key,
      name text not null,
      category text not null,
      audio_url text not null,
      is_premium boolean not null default false,
      tags text[] not null default '{}',
      default_volume integer not null default 60,
      description text not null default '',
      source_platform text not null default 'Unknown',
      source_url text not null default '',
      source_item_id text not null default '',
      source_creator text not null default '',
      license_name text not null default 'Unknown',
      license_url text not null default '',
      commercial_use_allowed boolean not null default false,
      derivative_use_allowed boolean not null default false,
      attribution_required boolean not null default true,
      raw_redistribution_allowed boolean not null default false,
      qa_status text not null default 'needs_review' check (qa_status in ('candidate', 'approved', 'needs_review', 'rejected')),
      qa_notes text not null default '',
      file_sha256 text not null default '',
      imported_at timestamptz
    );

    alter table audio_stems add column if not exists source_platform text not null default 'Unknown';
    alter table audio_stems add column if not exists source_url text not null default '';
    alter table audio_stems add column if not exists source_item_id text not null default '';
    alter table audio_stems add column if not exists source_creator text not null default '';
    alter table audio_stems add column if not exists license_name text not null default 'Unknown';
    alter table audio_stems add column if not exists license_url text not null default '';
    alter table audio_stems add column if not exists commercial_use_allowed boolean not null default false;
    alter table audio_stems add column if not exists derivative_use_allowed boolean not null default false;
    alter table audio_stems add column if not exists attribution_required boolean not null default true;
    alter table audio_stems add column if not exists raw_redistribution_allowed boolean not null default false;
    alter table audio_stems add column if not exists qa_status text not null default 'needs_review';
    alter table audio_stems add column if not exists qa_notes text not null default '';
    alter table audio_stems add column if not exists file_sha256 text not null default '';
    alter table audio_stems add column if not exists imported_at timestamptz;
    alter table audio_stems add column if not exists asset_id text;

    insert into audio_assets (
      id, storage_url, original_filename, file_sha256,
      source_platform, source_url, source_item_id, source_creator,
      license_name, license_url, commercial_use_allowed, derivative_use_allowed,
      attribution_required, raw_redistribution_allowed,
      rights_status, technical_qa_status, listening_qa_status, lifecycle_status,
      production_allowed, governance, created_at, updated_at
    )
    select
      'asset_' || s.id, s.audio_url, s.name, s.file_sha256,
      s.source_platform, s.source_url, s.source_item_id, s.source_creator,
      s.license_name, s.license_url, s.commercial_use_allowed, s.derivative_use_allowed,
      s.attribution_required, s.raw_redistribution_allowed,
      case when s.commercial_use_allowed and s.derivative_use_allowed then 'approved' else 'pending' end,
      case when s.qa_status = 'approved' and s.file_sha256 <> '' then 'passed' else 'pending' end,
      case when s.qa_status = 'approved' then 'passed' when s.qa_status = 'rejected' then 'failed' else 'pending' end,
      s.qa_status,
      s.qa_status = 'approved' and s.file_sha256 <> '' and s.commercial_use_allowed and s.derivative_use_allowed and s.category <> 'Voice',
      jsonb_build_object('legacyStemId', s.id, 'migration', 'audio_stems_v1'),
      coalesce(s.imported_at, now()), now()
    from audio_stems s
    on conflict (id) do update set
      storage_url = excluded.storage_url,
      file_sha256 = excluded.file_sha256,
      commercial_use_allowed = excluded.commercial_use_allowed,
      derivative_use_allowed = excluded.derivative_use_allowed,
      rights_status = excluded.rights_status,
      technical_qa_status = excluded.technical_qa_status,
      listening_qa_status = excluded.listening_qa_status,
      lifecycle_status = excluded.lifecycle_status,
      production_allowed = excluded.production_allowed,
      updated_at = now();

    update audio_stems set asset_id = 'asset_' || id where asset_id is null;
    alter table audio_stems alter column asset_id set not null;
    do $$
    begin
      if not exists (select 1 from pg_constraint where conname = 'audio_stems_asset_id_fkey') then
        alter table audio_stems add constraint audio_stems_asset_id_fkey foreign key (asset_id) references audio_assets(id) on delete restrict;
      end if;
    end $$;

    create index if not exists audio_stems_asset_idx on audio_stems(asset_id);

    create or replace function sync_audio_asset_from_stem() returns trigger as $$
    declare
      resolved_asset_id text;
    begin
      resolved_asset_id := coalesce(new.asset_id, 'asset_' || new.id);
      insert into audio_assets (
        id, storage_url, original_filename, file_sha256,
        source_platform, source_url, source_item_id, source_creator,
        license_name, license_url, commercial_use_allowed, derivative_use_allowed,
        attribution_required, raw_redistribution_allowed,
        rights_status, technical_qa_status, listening_qa_status, lifecycle_status,
        production_allowed, governance, updated_at
      ) values (
        resolved_asset_id, new.audio_url, new.name, new.file_sha256,
        new.source_platform, new.source_url, new.source_item_id, new.source_creator,
        new.license_name, new.license_url, new.commercial_use_allowed, new.derivative_use_allowed,
        new.attribution_required, new.raw_redistribution_allowed,
        case when new.commercial_use_allowed and new.derivative_use_allowed then 'approved' else 'pending' end,
        case when new.qa_status = 'approved' and new.file_sha256 <> '' then 'passed' else 'pending' end,
        case when new.qa_status = 'approved' then 'passed' when new.qa_status = 'rejected' then 'failed' else 'pending' end,
        new.qa_status,
        new.qa_status = 'approved' and new.file_sha256 <> '' and new.commercial_use_allowed and new.derivative_use_allowed and new.category <> 'Voice',
        jsonb_build_object('legacyStemId', new.id, 'sync', 'audio_stems_trigger'), now()
      )
      on conflict (id) do update set
        storage_url = excluded.storage_url,
        original_filename = excluded.original_filename,
        file_sha256 = excluded.file_sha256,
        source_platform = excluded.source_platform,
        source_url = excluded.source_url,
        source_item_id = excluded.source_item_id,
        source_creator = excluded.source_creator,
        license_name = excluded.license_name,
        license_url = excluded.license_url,
        commercial_use_allowed = excluded.commercial_use_allowed,
        derivative_use_allowed = excluded.derivative_use_allowed,
        attribution_required = excluded.attribution_required,
        raw_redistribution_allowed = excluded.raw_redistribution_allowed,
        rights_status = excluded.rights_status,
        technical_qa_status = excluded.technical_qa_status,
        listening_qa_status = excluded.listening_qa_status,
        lifecycle_status = excluded.lifecycle_status,
        production_allowed = excluded.production_allowed,
        updated_at = now();
      new.asset_id := resolved_asset_id;
      return new;
    end;
    $$ language plpgsql;

    drop trigger if exists audio_stems_sync_asset on audio_stems;
    create trigger audio_stems_sync_asset before insert or update on audio_stems
      for each row execute function sync_audio_asset_from_stem();

    create index if not exists audio_stems_qa_status_idx on audio_stems(qa_status);
    create index if not exists audio_stems_license_idx on audio_stems(license_name);

    create table if not exists audio_concepts (
      id text primary key,
      ontology_version integer not null,
      parent_id text references audio_concepts(id),
      dimension text not null,
      name text not null,
      description text not null default '',
      synonyms text[] not null default '{}',
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists audio_concepts_parent_idx on audio_concepts(parent_id);
    create index if not exists audio_concepts_dimension_idx on audio_concepts(dimension);

    create table if not exists stem_concepts (
      stem_id text not null references audio_stems(id) on delete cascade,
      concept_id text not null references audio_concepts(id),
      confidence double precision not null check (confidence >= 0 and confidence <= 1),
      source text not null check (source in ('editorial', 'rules', 'panns', 'clap')),
      verified boolean not null default false,
      reviewed_at timestamptz,
      primary key (stem_id, concept_id, source)
    );

    create index if not exists stem_concepts_concept_idx on stem_concepts(concept_id, verified);

    create table if not exists asset_annotations (
      asset_id text not null references audio_assets(id) on delete cascade,
      concept_id text not null references audio_concepts(id) on delete restrict,
      confidence double precision not null check (confidence >= 0 and confidence <= 1),
      source text not null check (source in ('editorial', 'rules', 'panns', 'clap')),
      verified boolean not null default false,
      notes text not null default '',
      reviewed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (asset_id, concept_id, source)
    );

    create index if not exists asset_annotations_concept_idx on asset_annotations(concept_id, verified);

    insert into asset_annotations (asset_id, concept_id, confidence, source, verified, reviewed_at)
    select s.asset_id, sc.concept_id, sc.confidence, sc.source, sc.verified, sc.reviewed_at
    from stem_concepts sc
    join audio_stems s on s.id = sc.stem_id
    on conflict (asset_id, concept_id, source) do update set
      confidence = excluded.confidence,
      verified = excluded.verified,
      reviewed_at = excluded.reviewed_at,
      updated_at = now();

    create or replace function sync_asset_annotation_from_stem_concept() returns trigger as $$
    declare
      resolved_asset_id text;
    begin
      if tg_op = 'DELETE' then
        select asset_id into resolved_asset_id from audio_stems where id = old.stem_id;
        delete from asset_annotations
        where asset_id = resolved_asset_id and concept_id = old.concept_id and source = old.source;
        return old;
      end if;
      select asset_id into resolved_asset_id from audio_stems where id = new.stem_id;
      insert into asset_annotations (asset_id, concept_id, confidence, source, verified, reviewed_at)
      values (resolved_asset_id, new.concept_id, new.confidence, new.source, new.verified, new.reviewed_at)
      on conflict (asset_id, concept_id, source) do update set
        confidence = excluded.confidence,
        verified = excluded.verified,
        reviewed_at = excluded.reviewed_at,
        updated_at = now();
      return new;
    end;
    $$ language plpgsql;

    drop trigger if exists stem_concepts_sync_asset_annotation on stem_concepts;
    create trigger stem_concepts_sync_asset_annotation after insert or update or delete on stem_concepts
      for each row execute function sync_asset_annotation_from_stem_concept();

    create table if not exists stem_metadata_v3 (
      stem_id text primary key references audio_stems(id) on delete cascade,
      metadata_version integer not null,
      semantic_descriptions text[] not null default '{}',
      roles text[] not null default '{}',
      goal_fit jsonb not null default '[]'::jsonb,
      temporal_profile jsonb not null default '{}'::jsonb,
      mix_profile jsonb not null default '{}'::jsonb,
      risks jsonb not null default '[]'::jsonb,
      review jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );

    create table if not exists stem_acoustic_features (
      stem_id text primary key references audio_stems(id) on delete cascade,
      analysis_version text not null,
      duration_seconds double precision not null,
      sample_rate integer not null,
      channels integer not null,
      integrated_lufs double precision,
      true_peak_db double precision,
      mean_volume_db double precision,
      max_volume_db double precision,
      details jsonb not null default '{}'::jsonb,
      analyzed_at timestamptz not null default now()
    );

    create table if not exists stem_compatibility_edges (
      left_id text not null,
      right_id text not null,
      relation text not null check (relation in ('preferred', 'allowed', 'conditional', 'avoid', 'forbidden')),
      score double precision not null check (score >= -1 and score <= 1),
      conditions jsonb not null default '{}'::jsonb,
      evidence text not null check (evidence in ('editorial', 'listening_test', 'behavioral')),
      notes text not null default '',
      updated_at timestamptz not null default now(),
      primary key (left_id, right_id)
    );

    create table if not exists audio_intent_gold_cases (
      id text primary key,
      set_version integer not null,
      language text not null check (language in ('zh', 'en')),
      prompt text not null,
      expected_intent jsonb not null,
      semantic_group text not null,
      review_status text not null check (review_status in ('seed_reviewed', 'expert_reviewed')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists audio_intent_gold_cases_group_idx on audio_intent_gold_cases(semantic_group);

    create table if not exists selection_traces (
      id text primary key,
      request_id text not null,
      intent_version text not null,
      ontology_version text not null,
      embedding_model_version text,
      candidates jsonb not null default '[]'::jsonb,
      rejected jsonb not null default '[]'::jsonb,
      selected jsonb not null default '[]'::jsonb,
      unmet_requirements text[] not null default '{}',
      recipe_id text,
      seed bigint,
      created_at timestamptz not null default now()
    );

    alter table selection_traces alter column seed type bigint using seed::bigint;

    create index if not exists selection_traces_request_idx on selection_traces(request_id, created_at desc);

    create table if not exists supply_gaps (
      id text primary key,
      concept_id text references audio_concepts(id),
      role text not null,
      goal text not null,
      scene text not null,
      content_mode text not null default '',
      phase text not null,
      request_count integer not null default 1,
      estimated_reuse_score double precision not null default 0,
      acoustic_target jsonb not null default '{}'::jsonb,
      example_prompts text[] not null default '{}',
      status text not null check (status in ('open', 'planned', 'sourcing', 'resolved', 'wont_fix')),
      resolved_stem_id text references audio_stems(id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table supply_gaps add column if not exists content_mode text not null default '';

    create index if not exists supply_gaps_priority_idx on supply_gaps(status, request_count desc, estimated_reuse_score desc);

    create table if not exists mixes (
      id text primary key,
      creator_id text not null references users(id),
      title text not null,
      description text not null default '',
      cover_image_url text not null default '',
      status text not null check (status in ('draft', 'published', 'private')),
      recipe_data jsonb not null,
      render_status text not null default 'not_rendered',
      rendered_audio_url text not null default '',
      rendered_at timestamptz,
      render_error text not null default '',
      plays_count integer not null default 0,
      likes_count integer not null default 0,
      share_clicks integer not null default 0,
      completion_50_count integer not null default 0,
      completion_90_count integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists mixes_status_idx on mixes(status);
    create index if not exists mixes_creator_idx on mixes(creator_id);
    create index if not exists mixes_recipe_gin_idx on mixes using gin (recipe_data);

    create table if not exists device_playback_states (
      user_id text not null references users(id) on delete cascade,
      mix_id text not null references mixes(id) on delete cascade,
      position_seconds double precision not null default 0,
      duration_seconds double precision not null default 0,
      updated_at timestamptz not null default now(),
      primary key (user_id, mix_id)
    );

    create index if not exists device_playback_states_user_idx on device_playback_states(user_id, updated_at desc);

    alter table mixes add column if not exists render_status text not null default 'not_rendered';
    alter table mixes add column if not exists rendered_audio_url text not null default '';
    alter table mixes add column if not exists rendered_at timestamptz;
    alter table mixes add column if not exists render_error text not null default '';
    alter table mixes add column if not exists published_version_id text;
    create index if not exists mixes_render_status_idx on mixes(render_status);

    update mixes
    set cover_image_url = case
      when lower(title) like '%ocean%' then '/share-visuals/scene-ocean-calm.png'
      when lower(title) like '%forest%' then '/share-visuals/scene-midnight-forest.png'
      when lower(title) like '%focus%' or recipe_data #>> '{audioIntent,goal}' = 'focus' then '/share-visuals/scene-deep-focus.png'
      when recipe_data #>> '{audioIntent,goal}' = 'calm' then '/share-visuals/scene-calm.jpg'
      else '/share-visuals/scene-sleep.jpg'
    end
    where cover_image_url ~ '^https?://';

    create table if not exists mix_recipe_versions (
      id text primary key,
      mix_id text not null references mixes(id) on delete cascade,
      version_number integer not null,
      recipe_data jsonb not null,
      created_at timestamptz not null default now(),
      unique (mix_id, version_number)
    );

    create index if not exists mix_recipe_versions_mix_idx on mix_recipe_versions(mix_id, version_number desc);

    create table if not exists content_items (
      id text primary key,
      mix_id text not null unique references mixes(id) on delete cascade,
      recipe_version_id text references mix_recipe_versions(id) on delete set null,
      content_type text not null default 'soundscape' check (content_type in ('soundscape', 'starter', 'saved_version')),
      lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft', 'review', 'published', 'blocked', 'archived')),
      release_eligible boolean not null default false,
      title_snapshot text not null default '',
      cover_snapshot text not null default '',
      release_gate jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists content_items_release_idx on content_items(release_eligible, lifecycle_status);

    insert into content_items (
      id, mix_id, recipe_version_id, lifecycle_status, release_eligible,
      title_snapshot, cover_snapshot, release_gate, created_at, updated_at
    )
    select
      'content_' || m.id,
      m.id,
      case when v.id is not null then m.published_version_id else null end,
      case
        when m.status = 'published' and m.render_status = 'ready' and v.id is not null and not blocked.has_blocker then 'published'
        when blocked.has_blocker then 'blocked'
        when m.status = 'private' then 'review'
        else 'draft'
      end,
      m.status = 'published' and m.render_status = 'ready' and v.id is not null and not blocked.has_blocker,
      m.title,
      m.cover_image_url,
      jsonb_build_object(
        'published', m.status = 'published',
        'renderReady', m.render_status = 'ready',
        'frozenVersion', v.id is not null,
        'assetsAllowed', not blocked.has_blocker
      ),
      m.created_at,
      m.updated_at
    from mixes m
    left join mix_recipe_versions v on v.id = m.published_version_id
    cross join lateral (
      select exists (
        select 1
        from jsonb_array_elements(coalesce(m.recipe_data->'tracks', '[]'::jsonb)) track
        left join audio_stems s on s.id = track->>'stemId'
        left join audio_assets a on a.id = s.asset_id
        where coalesce(track->>'isMuted', 'false') <> 'true'
          and coalesce((track->>'volume')::numeric, 0) > 0
          and (s.id is null or a.production_allowed is not true)
      ) as has_blocker
    ) blocked
    on conflict (mix_id) do update set
      recipe_version_id = excluded.recipe_version_id,
      lifecycle_status = excluded.lifecycle_status,
      release_eligible = excluded.release_eligible,
      title_snapshot = excluded.title_snapshot,
      cover_snapshot = excluded.cover_snapshot,
      release_gate = excluded.release_gate,
      updated_at = excluded.updated_at;

    create or replace function sync_content_item_from_mix() returns trigger as $$
    declare
      resolved_version_id text;
      has_blocker boolean;
      can_release boolean;
    begin
      select id into resolved_version_id from mix_recipe_versions where id = new.published_version_id;
      select exists (
        select 1
        from jsonb_array_elements(coalesce(new.recipe_data->'tracks', '[]'::jsonb)) track
        left join audio_stems s on s.id = track->>'stemId'
        left join audio_assets a on a.id = s.asset_id
        where coalesce(track->>'isMuted', 'false') <> 'true'
          and coalesce((track->>'volume')::numeric, 0) > 0
          and (s.id is null or a.production_allowed is not true)
      ) into has_blocker;
      can_release := new.status = 'published' and new.render_status = 'ready' and resolved_version_id is not null and not has_blocker;

      insert into content_items (
        id, mix_id, recipe_version_id, lifecycle_status, release_eligible,
        title_snapshot, cover_snapshot, release_gate, created_at, updated_at
      ) values (
        'content_' || new.id, new.id, resolved_version_id,
        case when can_release then 'published' when has_blocker then 'blocked' when new.status = 'private' then 'review' else 'draft' end,
        can_release, new.title, new.cover_image_url,
        jsonb_build_object(
          'published', new.status = 'published',
          'renderReady', new.render_status = 'ready',
          'frozenVersion', resolved_version_id is not null,
          'assetsAllowed', not has_blocker
        ),
        new.created_at, now()
      )
      on conflict (mix_id) do update set
        recipe_version_id = excluded.recipe_version_id,
        lifecycle_status = excluded.lifecycle_status,
        release_eligible = excluded.release_eligible,
        title_snapshot = excluded.title_snapshot,
        cover_snapshot = excluded.cover_snapshot,
        release_gate = excluded.release_gate,
        updated_at = now();
      return new;
    end;
    $$ language plpgsql;

    drop trigger if exists mixes_sync_content_item on mixes;
    create trigger mixes_sync_content_item after insert or update on mixes
      for each row execute function sync_content_item_from_mix();

    create table if not exists discover_placements (
      id text primary key,
      section_id text not null,
      content_item_id text not null references content_items(id) on delete cascade,
      position integer not null default 0 check (position >= 0),
      enabled boolean not null default true,
      editorial_metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (section_id, content_item_id)
    );

    create index if not exists discover_placements_section_idx on discover_placements(section_id, enabled, position);

    create or replace function enforce_discover_placement_release_gate() returns trigger as $$
    begin
      if new.enabled and not exists (
        select 1 from content_items where id = new.content_item_id and release_eligible = true
      ) then
        raise exception 'Discover placement requires release-eligible content item: %', new.content_item_id;
      end if;
      new.updated_at := now();
      return new;
    end;
    $$ language plpgsql;

    drop trigger if exists discover_placements_release_gate on discover_placements;
    create trigger discover_placements_release_gate before insert or update on discover_placements
      for each row execute function enforce_discover_placement_release_gate();

    create or replace function disable_placements_for_blocked_content() returns trigger as $$
    begin
      if old.release_eligible = true and new.release_eligible = false then
        update discover_placements set enabled = false, updated_at = now()
        where content_item_id = new.id and enabled = true;
      end if;
      return new;
    end;
    $$ language plpgsql;

    drop trigger if exists content_items_disable_invalid_placements on content_items;
    create trigger content_items_disable_invalid_placements after update of release_eligible on content_items
      for each row execute function disable_placements_for_blocked_content();

    create or replace function refresh_content_for_asset_governance() returns trigger as $$
    begin
      if old.production_allowed is distinct from new.production_allowed then
        update mixes m set updated_at = now()
        where exists (
          select 1
          from jsonb_array_elements(coalesce(m.recipe_data->'tracks', '[]'::jsonb)) track
          join audio_stems s on s.id = track->>'stemId'
          where s.asset_id = new.id
        );
      end if;
      return new;
    end;
    $$ language plpgsql;

    drop trigger if exists audio_assets_refresh_content on audio_assets;
    create trigger audio_assets_refresh_content after update of production_allowed on audio_assets
      for each row execute function refresh_content_for_asset_governance();

    create table if not exists share_links (
      id text primary key,
      slug text not null unique,
      mix_id text not null references mixes(id) on delete cascade,
      recipe_version_id text not null references mix_recipe_versions(id) on delete cascade,
      creator_id text not null references users(id),
      intent text not null check (intent in ('tonight', 'gift')),
      visibility text not null check (visibility in ('public', 'unlisted')),
      title_snapshot text not null,
      description_snapshot text not null default '',
      cover_snapshot text not null default '',
      creator_name_snapshot text not null,
      sound_elements text[] not null default '{}',
      recipient_label text not null default '',
      personal_message text not null default '',
      recipient_user_id text references users(id),
      expires_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz not null default now()
    );

    alter table share_links add column if not exists recipient_user_id text references users(id);

    update share_links as share
    set cover_snapshot = mix.cover_image_url
    from mixes as mix
    where share.mix_id = mix.id
      and share.cover_snapshot ~ '^https?://';

    create index if not exists share_links_mix_idx on share_links(mix_id, created_at desc);
    create index if not exists share_links_creator_idx on share_links(creator_id, created_at desc);

    create table if not exists share_events (
      id text primary key,
      share_link_id text not null references share_links(id) on delete cascade,
      anonymous_visitor_id text not null default '',
      event_type text not null check (event_type in (
        'share_page_opened', 'playback_requested', 'playback_started', 'meaningful_listen',
        'favorite_added', 'create_from_share_started', 'gift_response_sent', 'reshared'
      )),
      source text not null default '',
      elapsed_ms integer not null default 0 check (elapsed_ms >= 0),
      playback_seconds integer not null default 0 check (playback_seconds >= 0),
      details jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create index if not exists share_events_link_idx on share_events(share_link_id, created_at);
    create index if not exists share_events_visitor_idx on share_events(anonymous_visitor_id, created_at);

    create table if not exists render_qa_reports (
      id text primary key,
      mix_id text not null references mixes(id) on delete cascade,
      recipe_version_id text,
      rendered_audio_url text not null,
      duration_seconds double precision not null,
      peak_db double precision,
      mean_db double precision,
      integrated_lufs double precision,
      true_peak_db double precision,
      abnormal_silence_count integer not null default 0,
      passed boolean not null,
      details jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create index if not exists render_qa_reports_mix_idx on render_qa_reports(mix_id, created_at desc);

    create table if not exists tts_jobs (
      id text primary key,
      mix_id text not null references mixes(id) on delete cascade,
      status text not null check (status in ('queued', 'running', 'ready', 'failed')),
      provider text not null,
      model text not null default '',
      voice text not null default '',
      language text not null,
      script_text text not null,
      character_count integer not null,
      cost_usd numeric(10,6) not null default 0,
      license_name text not null default '',
      commercial_use_allowed boolean not null default false,
      output_audio_url text not null default '',
      error text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists tts_jobs_mix_idx on tts_jobs(mix_id, created_at desc);
    create unique index if not exists tts_jobs_one_active_mix_idx on tts_jobs(mix_id) where status in ('queued', 'running');

    create table if not exists supply_gap_jobs (
      id text primary key,
      requested_by_user_id text not null references users(id) on delete cascade,
      status text not null check (status in ('queued', 'running', 'candidate_ready', 'qa_failed', 'approved', 'failed', 'blocked')),
      decision_kind text not null check (decision_kind in ('inventory_plus_missing_stem', 'unsupported_multi_gap')),
      role text not null default '',
      provider_policy text not null default '',
      provider text not null default '',
      spec_hash text not null unique,
      prompt text not null,
      goal text not null,
      scene text not null,
      content_mode text not null,
      generation_spec jsonb,
      missing jsonb not null default '[]'::jsonb,
      candidate_count integer not null default 0,
      cache_hit_count integer not null default 0,
      estimated_cost_usd numeric(10,6) not null default 0,
      actual_cost_usd numeric(10,6) not null default 0,
      qa_status text not null default 'not_started' check (qa_status in ('not_started', 'machine_pending', 'human_pending', 'passed', 'failed')),
      failure_reason text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists supply_gap_jobs_user_idx on supply_gap_jobs(requested_by_user_id, created_at desc);
    create index if not exists supply_gap_jobs_status_idx on supply_gap_jobs(status, created_at);

    create table if not exists supply_gap_candidates (
      id text primary key,
      job_id text not null references supply_gap_jobs(id) on delete cascade,
      candidate_index integer not null,
      status text not null check (status in ('spec_ready', 'machine_pending', 'machine_failed', 'human_pending', 'approved', 'rejected')),
      provider text not null,
      title text not null,
      audio_url text not null default '',
      review_url text not null default '',
      origin_record jsonb not null default '{}'::jsonb,
      acoustic_report jsonb not null default '{}'::jsonb,
      license_record jsonb not null default '{}'::jsonb,
      cost_usd numeric(10,6) not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(job_id, candidate_index)
    );

    create index if not exists supply_gap_candidates_job_idx on supply_gap_candidates(job_id, candidate_index);

    create table if not exists voice_qa_reviews (
      id text primary key,
      stem_id text not null references audio_stems(id) on delete cascade,
      tts_job_id text references tts_jobs(id) on delete set null,
      reviewer_id text not null references users(id),
      decision text not null check (decision in ('approved', 'needs_review', 'rejected')),
      script_safety_passed boolean not null default false,
      pronunciation_passed boolean not null default false,
      rights_passed boolean not null default false,
      commercial_use_allowed boolean not null default false,
      derivative_use_allowed boolean not null default false,
      notes text not null default '',
      created_at timestamptz not null default now()
    );

    create index if not exists voice_qa_reviews_stem_idx on voice_qa_reviews(stem_id, created_at desc);

    create table if not exists user_history (
      id text primary key,
      user_id text not null references users(id),
      mix_id text not null references mixes(id),
      played_at timestamptz not null default now(),
      duration_listened integer not null default 0
    );

    create index if not exists user_history_user_played_idx on user_history(user_id, played_at desc);

    create table if not exists playback_events (
      id text primary key,
      mix_id text not null references mixes(id) on delete cascade,
      user_id text not null references users(id),
      journey_id text not null,
      event_type text not null check (event_type in ('quick_create_started', 'recipe_ready', 'playback_requested', 'playback_started', 'playback_failed')),
      elapsed_ms integer not null check (elapsed_ms >= 0),
      details jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create index if not exists playback_events_journey_idx on playback_events(journey_id, created_at);
    create index if not exists playback_events_mix_idx on playback_events(mix_id, created_at);
    alter table playback_events drop constraint if exists playback_events_event_type_check;
    alter table playback_events add constraint playback_events_event_type_check check (event_type in (
      'quick_create_started', 'recipe_ready', 'playback_requested', 'playback_started', 'playback_failed', 'playback_checkpoint',
      'native_media_session_ready', 'native_media_session_failed',
      'result_accepted', 'result_adjust_requested', 'result_adjust_applied', 'result_adjust_failed', 'result_retry_requested',
      'work_saved', 'work_published', 'share_created'
    ));

    create table if not exists ai_sessions (
      id text primary key,
      user_id text not null references users(id),
      prompt text not null,
      chat_history jsonb not null,
      generated_mix_id text not null references mixes(id),
      created_at timestamptz not null default now()
    );
  `);
};
