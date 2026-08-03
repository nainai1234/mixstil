import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  AudioLines,
  BookOpen,
  Boxes,
  CheckCircle2,
  Database,
  Compass,
  ExternalLink,
  FileAudio,
  FolderOpen,
  Gauge,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Shield,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { api, resolveServiceUrl } from '../lib/api';
import type { AdminDemandCoverage, AdminDemandProductionReview, AdminImportInbox, AdminKnowledgeCatalog, AdminOverview, AdminUnifiedContentModel, AudioStem, Mix, StemCategory } from '../lib/domain';

type AdminSection = 'overview' | 'users' | 'products' | 'discover' | 'assets' | 'knowledge' | 'review' | 'analytics' | 'system';

const stemCategories: StemCategory[] = ['Nature', 'Music', 'Noise', 'Accent', 'Voice'];
const stemQaStatuses = ['approved', 'needs_review', 'candidate', 'rejected'];

const sections: Array<{ id: AdminSection; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'overview', label: '总览', icon: Database },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'products', label: '产品管理', icon: Boxes },
  { id: 'discover', label: '发现页配置', icon: Compass },
  { id: 'assets', label: '素材库管理', icon: FileAudio },
  { id: 'knowledge', label: '知识库管理', icon: BookOpen },
  { id: 'review', label: '内容生产/审核', icon: ListChecks },
  { id: 'analytics', label: '运营数据', icon: Activity },
  { id: 'system', label: '系统配置', icon: Settings2 },
];

const adminSectionIds = new Set(sections.map((section) => section.id));
const sectionFromHash = (hash: string): AdminSection => {
  const id = hash.replace(/^#/, '').trim();
  return adminSectionIds.has(id as AdminSection) ? id as AdminSection : 'overview';
};

const zh: Record<string, string> = {
  admin: '管理员',
  consumer: '消费者',
  creator: '创作者',
  free: '免费',
  pro: '专业版',
  draft: '草稿',
  private: '私有',
  published: '已发布',
  not_rendered: '未渲染',
  rendering: '渲染中',
  ready: '可播放',
  failed: '失败',
  approved: '已批准',
  needs_review: '待审核',
  candidate: '候选',
  rejected: '已拒绝',
  sleep: '睡眠',
  calm: '放松',
  focus: '专注',
  bedtime: '睡前入睡',
  return_to_sleep: '夜醒回睡',
  breathing: '呼吸冥想',
  emotional_settling: '情绪安放',
  deep_focus: '深度专注',
  pure_soundscape: '纯声景',
  functional_music: '功能音乐',
  guided_meditation: '引导冥想',
  sound_journey: '声景旅程',
  open: '待处理',
  planned: '已规划',
  sourcing: '采集中',
  resolved: '已解决',
  wont_fix: '暂不处理',
  queued: '排队中',
  running: '处理中',
  candidate_ready: '候选就绪',
  qa_failed: 'QA 失败',
  blocked: '阻塞',
  spec_ready: '规格就绪',
  machine_pending: '机器 QA 中',
  machine_failed: '机器 QA 失败',
  human_pending: '人工审核中',
  like: '喜欢',
  exclusion: '排除',
  sensitivity: '敏感度',
  default_goal: '默认目标',
  default_duration: '默认时长',
  publish_ready: '可发布',
  source_material: '可用素材',
  demo_only: '只适合演示',
  needs_rework: '需返工',
  paid_ready: '付费库存达标',
  free_proven: '免费验证达标',
  underfilled: '供给不足',
  p0_free_proof: 'P0 免费验证',
  p1_paid_inventory: 'P1 付费库存',
  p2_quality_repair: 'P2 质量返工',
  source_or_generate_material: '补素材',
  compose_reviewed_soundscape: '做成品声景',
  repair_existing_content: '返工内容',
  human_passed_release_candidate: '人工通过候选',
  human_requested_rework: '人工要求返工',
  human_rejected: '人工拒绝',
  release_governance_passed: '发布治理通过',
  published_release_ready: '已入发布可选池',
  'sleep-ready': '睡前入睡',
  'return-to-sleep': '夜醒回睡',
  'light-music': '轻音乐但不抓耳',
  'noise-masking': '噪声与房间遮蔽',
  'quiet-nature': '低事件自然声',
  'asmr-texture': '细腻纹理',
  'calm-reset': '短时放松与切换',
  minimal: '极简低刺激',
  exclusions: '严格无人声、简单',
  passed: '通过',
};

const t = (value: string | null | undefined) => value ? zh[value] ?? value.replaceAll('_', ' ') : '未设置';
const pct = (value: number) => `${Math.round(value * 100)}%`;
const min = (seconds: number) => `${Math.max(0, Math.round(seconds / 60))} 分钟`;
const fileSize = (bytes: number) => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const formatDate = (value: string | null | undefined) => {
  if (!value) return '无记录';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '无记录';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(time));
};

const countOf = (counts: Record<string, number>, key: string) => counts[key] ?? 0;
const sumCounts = (counts: Record<string, number>) => Object.values(counts).reduce((sum, count) => sum + count, 0);
const statusTone = (value: string) => {
  if (['approved', 'ready', 'published', 'passed', 'resolved', 'admin', 'publish_ready', 'paid_ready', 'free_proven', 'p1_paid_inventory', 'compose_reviewed_soundscape', 'human_passed_release_candidate', 'release_governance_passed', 'published_release_ready'].includes(value)) return '#8ee6b0';
  if (['needs_review', 'candidate', 'rendering', 'planned', 'sourcing', 'private', 'human_pending', 'machine_pending', 'source_material', 'demo_only', 'underfilled', 'p0_free_proof', 'source_or_generate_material'].includes(value)) return '#f0c66a';
  if (['rejected', 'failed', 'blocked', 'wont_fix', 'qa_failed', 'machine_failed', 'human_requested_rework', 'human_rejected'].includes(value)) return '#ff9b9b';
  return 'var(--text-secondary)';
};

const assetReleaseBlockers = (stem: AudioStem) => {
  const blockers: string[] = [];
  if (stem.qaStatus !== 'approved') blockers.push(`审核状态仍为${t(stem.qaStatus)}`);
  if (!stem.fileSha256) blockers.push('缺少 SHA-256 文件指纹');
  if (!stem.commercialUseAllowed) blockers.push('未确认商用授权');
  if (!stem.derivativeUseAllowed) blockers.push('未确认二创/混音授权');
  if (stem.category === 'Voice') blockers.push('Voice-free Beta 暂不允许人声进入公开供给池');
  return blockers;
};

const assetDisposition = (stem: AudioStem) => {
  const blockers = assetReleaseBlockers(stem);
  if (blockers.length === 0) {
    return { status: 'supply', label: 'App 可调用供给池', detail: '可用于公开生成、复播、离线与导出路径。' };
  }
  if (stem.qaStatus === 'rejected') {
    return { status: 'rejected', label: '不合格素材', detail: stem.qaNotes || '保留记录，不进入 App 供给池。' };
  }
  return { status: 'blocked', label: '待处理', detail: blockers.slice(0, 3).join('；') };
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 38,
  border: '1px solid var(--surface-border)',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text-primary)',
  padding: '8px 10px',
  outline: 0,
};

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 5,
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 700,
};

const Panel = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section style={{ border: '1px solid var(--surface-border)', borderRadius: 8, background: 'var(--surface-1)', padding: 16, minWidth: 0 }}>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800 }}>{title}</h2>
      {action}
    </header>
    {children}
  </section>
);

const Metric = ({ label, value, note, icon: Icon }: { label: string; value: string | number; note: string; icon: React.ComponentType<{ size?: number }> }) => (
  <div style={{ minHeight: 112, border: '1px solid var(--surface-border)', borderRadius: 8, background: 'var(--surface-1)', padding: 16, display: 'grid', gap: 9 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>{label}</span>
      <Icon size={18} />
    </div>
    <strong style={{ fontSize: 28, lineHeight: 1 }}>{value}</strong>
    <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.35 }}>{note}</span>
  </div>
);

const CountBars = ({ counts }: { counts: Record<string, number> }) => {
  const total = Math.max(1, sumCounts(counts));
  return (
    <div style={{ display: 'grid', gap: 9 }}>
      {Object.entries(counts).map(([key, count]) => (
        <div key={key} style={{ display: 'grid', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
            <span>{t(key)}</span>
            <strong>{count}</strong>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(3, (count / total) * 100)}%`, height: '100%', background: statusTone(key) }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const UserManagementTable = ({ users }: { users: AdminOverview['users']['management'] }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    {users.map((user) => (
      <div key={user.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1.3fr) 84px 92px 86px 86px 96px 120px', gap: 12, alignItems: 'center', minHeight: 54, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{user.username}</strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12, overflowWrap: 'anywhere' }}>{user.email}</span>
        </div>
        <span style={{ color: statusTone(user.role), fontSize: 12, fontWeight: 700 }}>{t(user.role)}</span>
        <span style={{ fontSize: 12 }}>{t(user.subscriptionTier)}</span>
        <span style={{ fontSize: 12 }}>{user.totalPlays} 次</span>
        <span style={{ fontSize: 12 }}>{user.savedSounds} 个</span>
        <span style={{ fontSize: 12 }}>{user.preferenceCount}/{user.exclusionCount}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDate(user.createdAt)}</span>
      </div>
    ))}
  </div>
);

const MixTable = ({ mixes }: { mixes: Mix[] }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    {mixes.map((mix) => (
      <div key={mix.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1.5fr) 88px 100px 88px 120px', gap: 12, alignItems: 'center', minHeight: 52, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{mix.title}</strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t(mix.recipeData.audioIntent?.goal)} / {t(mix.recipeData.audioIntent?.scene)}</span>
        </div>
        <span style={{ color: statusTone(mix.status), fontSize: 12, fontWeight: 700 }}>{t(mix.status)}</span>
        <span style={{ color: statusTone(mix.renderStatus), fontSize: 12 }}>{t(mix.renderStatus)}</span>
        <span style={{ fontSize: 12 }}>{mix.playsCount} 次</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDate(mix.updatedAt)}</span>
      </div>
    ))}
  </div>
);

const StemTable = ({ stems, reviewingId, onReview }: { stems: AudioStem[]; reviewingId?: string; onReview?: (stem: AudioStem, qaStatus: 'approved' | 'needs_review' | 'rejected') => void }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    {stems.map((stem) => {
      const disposition = assetDisposition(stem);
      return (
        <div key={stem.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1.1fr) 74px 92px minmax(220px,1.25fr) minmax(180px,0.9fr) minmax(190px,0.9fr) minmax(168px,0.85fr)', gap: 12, alignItems: 'center', minHeight: 68, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{stem.name}</strong>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, overflowWrap: 'anywhere' }}>{stem.id}</span>
          </div>
          <span style={{ fontSize: 12 }}>{stem.category}</span>
          <span style={{ color: statusTone(stem.qaStatus), fontSize: 12, fontWeight: 700 }}>{t(stem.qaStatus)}</span>
          <div style={{ minWidth: 0, display: 'grid', gap: 5 }}>
            <a href={resolveServiceUrl(stem.audioUrl)} target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)', fontSize: 12, overflowWrap: 'anywhere', display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }} title={resolveServiceUrl(stem.audioUrl)}>
              <ExternalLink size={13} />
              <span>{stem.audioUrl}</span>
            </a>
            <audio controls preload="none" src={resolveServiceUrl(stem.audioUrl)} style={{ width: '100%', height: 30 }} />
          </div>
          <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, overflowWrap: 'anywhere' }}>{stem.licenseName || stem.sourcePlatform}</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, overflowWrap: 'anywhere' }}>{stem.fileSha256 ? `hash ${stem.fileSha256.slice(0, 10)}` : '无 hash'}</span>
          </div>
          <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
            <span style={{ color: disposition.status === 'supply' ? '#8ee6b0' : disposition.status === 'rejected' ? '#ff9b9b' : '#f0c66a', fontSize: 12, fontWeight: 800 }}>{disposition.label}</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{disposition.detail}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(['approved', 'rejected', 'needs_review'] as const).map((status) => (
              <button
                key={status}
                type="button"
                disabled={!onReview || reviewingId === stem.id || stem.qaStatus === status}
                onClick={() => onReview?.(stem, status)}
                style={{ minHeight: 30, borderRadius: 6, border: '1px solid var(--surface-border)', background: stem.qaStatus === status ? 'rgba(255,255,255,0.07)' : 'var(--surface-2)', color: statusTone(status), fontSize: 12, fontWeight: 800, padding: '0 8px', cursor: !onReview || reviewingId === stem.id || stem.qaStatus === status ? 'not-allowed' : 'pointer' }}
              >
                {reviewingId === stem.id ? '处理中' : status === 'approved' ? '批准' : status === 'rejected' ? '拒绝' : '待审'}
              </button>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

const IntakeLoopPanel = ({ overview }: { overview: AdminOverview }) => {
  const approved = countOf(overview.assets.byQaStatus, 'approved');
  const needsReview = countOf(overview.assets.byQaStatus, 'needs_review');
  const rejected = countOf(overview.assets.byQaStatus, 'rejected');
  const candidate = countOf(overview.assets.byQaStatus, 'candidate');
  const summary = [
    { label: 'App 可调用', value: approved, note: '需商用、二创、hash、非 Voice' },
    { label: '待运营处理', value: needsReview + candidate, note: `${needsReview} 条待审核，${candidate} 条候选` },
    { label: '不合格留档', value: rejected, note: '保留原因，避免重复采购' },
    { label: '语义元数据', value: overview.knowledge.metadataSummary.total, note: `${overview.knowledge.metadataSummary.editorialBaseline} 条编辑基线` },
  ];
  const steps = [
    { title: '批量导入/上传', body: '文件进入 inbox 或上传表单后，系统读取格式、时长、采样率、hash 与文件名线索。' },
    { title: '机器识别预填', body: '自动建议 Nature/Music/Noise/Voice/Accent、标签、描述、默认音量和来源字段。' },
    { title: '授权与 QA 补齐', body: '运营确认商用、二创、署名、原文件分发边界，并完成机器 QA 与人工听感 QA。' },
    { title: '供给池/处理建议', body: '合格素材进入 App 可调用池；不合格素材保留拒绝原因，待处理素材显示阻塞项。' },
  ];
  return (
    <Panel title="素材入库闭环">
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 0, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
          {summary.map((item) => (
            <div key={item.label} style={{ padding: 12, borderRight: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 5, minHeight: 82 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800 }}>{item.label}</span>
              <strong style={{ fontSize: 24, lineHeight: 1 }}>{item.value}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.35 }}>{item.note}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
          {steps.map((step, index) => (
            <div key={step.title} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'rgba(255,255,255,0.035)', padding: 12, minHeight: 118, display: 'grid', gap: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: index === 3 ? 'rgba(142,230,176,0.18)' : 'rgba(240,198,106,0.16)', color: index === 3 ? '#8ee6b0' : '#f0c66a', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900 }}>{index + 1}</span>
              <strong style={{ fontSize: 13 }}>{step.title}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>{step.body}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
};

const UnifiedContentPipelinePanel = ({ overview }: { overview: AdminOverview }) => {
  const pipeline = overview.operations.contentPipeline;
  const flow = [
    { title: '素材库', body: '唯一上传入口，保存文件、hash、授权、机器 QA、人工听感与可调用状态。' },
    { title: '知识库', body: '统一维护概念、同义词、风险和匹配规则；素材只引用这里的语义。' },
    { title: '生产/审核', body: '用 approved 素材形成 Recipe 与成品声景，审核组合听感和发布风险。' },
    { title: '发现页', body: '只编排已发布、已渲染、素材合规、可复播的内容或受控创建入口。' },
  ];
  return (
    <Panel title="统一内容供应链">
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 1, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
          {[
            ['素材总量', pipeline.summary.totalAssets],
            ['App 可调用素材', pipeline.summary.releaseEligibleAssets],
            ['素材阻塞', pipeline.summary.blockedAssets],
            ['语义元数据', pipeline.summary.semanticMetadata],
            ['发现可上架内容', pipeline.summary.discoverEligibleContent],
            ['生产缺口', pipeline.summary.openProductionGaps],
          ].map(([label, value]) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.035)', padding: 12, minHeight: 78, display: 'grid', gap: 5 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800 }}>{label}</span>
              <strong style={{ fontSize: 22, lineHeight: 1 }}>{value}</strong>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
          {flow.map((step, index) => (
            <div key={step.title} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'rgba(255,255,255,0.035)', padding: 12, minHeight: 116, display: 'grid', gap: 7 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(140,106,255,0.18)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900 }}>{index + 1}</span>
              <strong style={{ fontSize: 13 }}>{step.title}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>{step.body}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 7, fontSize: 12 }}>
          {pipeline.principles.map((principle) => <span key={principle} style={{ color: 'var(--text-secondary)' }}><CheckCircle2 size={14} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />{principle}</span>)}
        </div>
      </div>
    </Panel>
  );
};

const NormalizedContentModelPanel = ({ model }: { model: AdminUnifiedContentModel }) => {
  const items = [
    ['AudioAsset', model.summary.audioAssets, `${model.summary.orphanStems} 个孤立 Stem`],
    ['AssetAnnotation', model.summary.annotations, '资产与知识概念关系'],
    ['ContentItem', model.summary.contentItems, `${model.summary.releaseEligibleContent} 个可发布`],
    ['DiscoverPlacement', model.summary.enabledPlacements, `${model.summary.invalidPlacements} 个无效绑定`],
  ] as const;
  return (
    <Panel title="标准化内容对象">
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
          {items.map(([label, value, note]) => (
            <div key={label} style={{ border: '1px solid var(--surface-border)', borderRadius: 8, background: 'var(--surface-2)', padding: 12, display: 'grid', gap: 5 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800 }}>{label}</span>
              <strong style={{ fontSize: 22 }}>{value}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{note}</span>
            </div>
          ))}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
          {model.relationships.join(' · ')}
        </div>
      </div>
    </Panel>
  );
};

const ContentPipelineTables = ({ overview }: { overview: AdminOverview }) => {
  const pipeline = overview.operations.contentPipeline;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Panel title="素材治理：素材库是唯一音频源">
        <div style={{ display: 'grid', gap: 8 }}>
          {pipeline.assetGovernance.map((asset) => (
            <div key={asset.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 70px 82px minmax(150px,1fr)', gap: 10, alignItems: 'start', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ minWidth: 0 }}><strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{asset.name}</strong><span style={{ color: 'var(--text-secondary)', fontSize: 11, overflowWrap: 'anywhere' }}>{asset.id}</span></span>
              <span style={{ fontSize: 12 }}>{asset.category}</span>
              <span style={{ color: asset.releaseEligible ? '#8ee6b0' : '#f0c66a', fontSize: 12, fontWeight: 800 }}>{asset.releaseEligible ? '可调用' : t(asset.qaStatus)}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.35 }}>{asset.blockers.length ? asset.blockers.slice(0, 2).join('；') : `${asset.conceptCount} 个知识概念，${asset.contentUsageCount} 个内容引用`}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="内容上架：发现页只引用合格成品">
        <div style={{ display: 'grid', gap: 8 }}>
          {pipeline.contentItems.map((item) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 90px 86px minmax(120px,0.8fr)', gap: 10, alignItems: 'start', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ minWidth: 0 }}><strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{item.title}</strong><span style={{ color: 'var(--text-secondary)', fontSize: 11, overflowWrap: 'anywhere' }}>{item.id}</span></span>
              <span style={{ color: statusTone(item.status), fontSize: 12, fontWeight: 800 }}>{t(item.status)}</span>
              <span style={{ color: statusTone(item.renderStatus), fontSize: 12 }}>{t(item.renderStatus)}</span>
              <span style={{ color: item.discoverEligible ? '#8ee6b0' : '#f0c66a', fontSize: 12, lineHeight: 1.35 }}>{item.discoverEligible ? '发现页可上架' : `${item.blockedTrackCount} 个素材阻塞`}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

const DemandCoveragePanel = ({ coverage, loading, error, onRefresh }: { coverage: AdminDemandCoverage | null; loading: boolean; error: string; onRefresh: () => void }) => (
  <Panel title="用户需求覆盖矩阵" action={
    <button type="button" onClick={onRefresh} disabled={loading} style={{ minHeight: 32, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>
      <RefreshCw size={14} />刷新
    </button>
  }>
    <div style={{ display: 'grid', gap: 12 }}>
      {error && <p style={{ color: '#ffb1b1', fontSize: 13 }}>{error}</p>}
      {loading && !coverage && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>正在读取发现页需求、已生成内容和素材库库存...</p>}
      {coverage && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 1, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            {[
              ['需求类型', coverage.totals.demandTypeCount],
              ['可发布覆盖', coverage.totals.publishReadyCount],
              ['免费缺口', coverage.totals.freeShortfall],
              ['Plus 缺口', coverage.totals.paidShortfall],
              ['供给不足类型', coverage.totals.underfilledDemandTypes],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.035)', padding: 12, minHeight: 76, display: 'grid', gap: 5 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800 }}>{label}</span>
                <strong style={{ fontSize: 22, lineHeight: 1 }}>{value}</strong>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 7, fontSize: 12 }}>
            {coverage.principles.map((principle) => <span key={principle} style={{ color: 'var(--text-secondary)' }}><CheckCircle2 size={14} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />{principle}</span>)}
          </div>
          <div style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, background: 'rgba(140,106,255,0.06)', padding: 12, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span>
                <strong style={{ display: 'block', fontSize: 14 }}>下一批补齐生产计划</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{coverage.productionPlan.batchId} · {coverage.productionPlan.policy}</span>
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDate(coverage.productionPlan.generatedAt)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 1, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
              {[
                ['计划项', coverage.productionPlan.totals.plannedItems],
                ['计划单位', coverage.productionPlan.totals.plannedUnits],
                ['补素材', coverage.productionPlan.totals.materialUnits],
                ['做成品', coverage.productionPlan.totals.finishedSoundscapeUnits],
                ['返工', coverage.productionPlan.totals.repairUnits],
              ].map(([label, value]) => (
                <span key={label} style={{ background: 'rgba(255,255,255,0.035)', padding: 10, minHeight: 58, display: 'grid', gap: 4 }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 800 }}>{label}</span>
                  <strong style={{ fontSize: 18, lineHeight: 1 }}>{value}</strong>
                </span>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {coverage.productionPlan.items.slice(0, 8).map((plan) => (
                <div key={plan.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(170px,1fr) 110px 86px minmax(220px,1.2fr)', gap: 10, alignItems: 'start', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 13, overflowWrap: 'anywhere' }}>{plan.title}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{plan.targetCount} 个 · {t(plan.action)}</span>
                  </span>
                  <span style={{ color: statusTone(plan.priority), fontSize: 12, fontWeight: 800 }}>{t(plan.priority)}</span>
                  <span style={{ color: statusTone(plan.action), fontSize: 12, fontWeight: 800 }}>{t(plan.action)}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.35 }}>{plan.reason}<br />{plan.route}</span>
                </div>
              ))}
              {coverage.productionPlan.items.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>当前覆盖已达标，暂不需要新增生产计划。</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {coverage.coverage.map((item) => (
              <div key={item.demandType.id} style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, background: 'rgba(255,255,255,0.025)', padding: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1.2fr) repeat(4,minmax(78px,0.4fr)) minmax(170px,1fr)', gap: 10, alignItems: 'start' }}>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 15 }}>{item.demandType.title}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.35 }}>{t(item.demandType.goal)} / {t(item.demandType.scene)} / {t(item.demandType.contentMode)}</span>
                  </span>
                  <span style={{ fontSize: 12 }}><strong style={{ display: 'block', fontSize: 18 }}>{item.summary.publishReadyCount}</strong>可发布</span>
                  <span style={{ fontSize: 12 }}><strong style={{ display: 'block', fontSize: 18 }}>{item.summary.sourceMaterialCount}</strong>素材</span>
                  <span style={{ fontSize: 12 }}><strong style={{ display: 'block', fontSize: 18 }}>{item.summary.freeShortfall}</strong>免费差</span>
                  <span style={{ fontSize: 12 }}><strong style={{ display: 'block', fontSize: 18 }}>{item.summary.paidShortfall}</strong>Plus 差</span>
                  <span style={{ color: statusTone(item.summary.readiness), fontSize: 12, fontWeight: 800 }}>{t(item.summary.readiness)}</span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>{item.nextProductionRecommendation}</p>
                {item.gaps.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {item.gaps.slice(0, 4).map((gap) => <span key={gap} style={{ border: '1px solid rgba(240,198,106,0.22)', borderRadius: 6, color: '#f0c66a', padding: '4px 7px', fontSize: 11, lineHeight: 1.2 }}>{gap}</span>)}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <strong style={{ fontSize: 12 }}>已归类内容</strong>
                    {item.assignedMixes.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>暂无已生成内容归入此需求。</span>}
                    {item.assignedMixes.slice(0, 4).map((mix) => (
                      <span key={mix.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) 78px 100px', gap: 8, color: 'var(--text-secondary)', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>
                        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{mix.title}</span>
                        <span style={{ color: statusTone(mix.state), fontWeight: 800 }}>{t(mix.state)}</span>
                        <span>{mix.categoryProfile}</span>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <strong style={{ fontSize: 12 }}>可调用素材</strong>
                    {item.sourceMaterials.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>暂无匹配素材，下一步应先补素材库。</span>}
                    {item.sourceMaterials.slice(0, 4).map((material) => (
                      <span key={material.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) 72px', gap: 8, color: 'var(--text-secondary)', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>
                        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{material.name}</span>
                        <span>{material.category}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  </Panel>
);

const DemandProductionReviewPanel = ({
  review,
  loading,
  error,
  reviewingId,
  releasingId,
  reviewDrafts,
  onRefresh,
  onDraftChange,
  onReview,
  onRelease,
  onOpenDiscover,
}: {
  review: AdminDemandProductionReview | null;
  loading: boolean;
  error: string;
  reviewingId: string;
  releasingId: string;
  reviewDrafts: Record<string, DemandReviewDraft>;
  onRefresh: () => void;
  onDraftChange: (mixId: string, draft: Partial<DemandReviewDraft>) => void;
  onReview: (mixId: string, decision: 'passed' | 'needs_rework' | 'rejected', draft: DemandReviewDraft) => void;
  onRelease: (mixId: string) => void;
  onOpenDiscover: () => void;
}) => {
  const [demandFilter, setDemandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'decided' | 'all'>('pending');
  const demandOptions = Array.from(new Set((review?.items ?? []).map((item) => item.demandTypeId).filter(Boolean)));
  const filteredItems = (review?.items ?? []).filter((item) => {
    const demandMatches = demandFilter === 'all' || item.demandTypeId === demandFilter;
    const statusMatches = statusFilter === 'all'
      || (statusFilter === 'pending' && !item.humanReview)
      || (statusFilter === 'decided' && Boolean(item.humanReview));
    return demandMatches && statusMatches;
  });
  const decidedItems = filteredItems.filter((item) => item.humanReview);
  const queueSummary = demandOptions.map((demandTypeId) => {
    const queueItems = (review?.items ?? []).filter((item) => item.demandTypeId === demandTypeId);
    return {
      demandTypeId,
      label: t(demandTypeId),
      pending: queueItems.filter((item) => !item.humanReview).length,
      decided: queueItems.filter((item) => Boolean(item.humanReview)).length,
    };
  });
  const reviewDraftFor = (item: AdminDemandProductionReview['items'][number]) => reviewDrafts[item.mixId] ?? {
    notes: item.humanReview?.notes ?? '',
  };
  const passBlockersFor = (item: AdminDemandProductionReview['items'][number]) => {
    return [
      ...(!item.renderedAudioUrl ? ['缺少渲染音频'] : []),
      ...(!item.machineQa?.passed ? ['机器 QA 未通过'] : []),
    ];
  };
  const downloadReviewManifest = () => {
    if (!review) return;
    const manifest = {
      schemaVersion: '1.0.0',
      batchId: review.batchId,
      exportedAt: new Date().toISOString(),
      productionAllowed: false,
      humanReviewRequired: true,
      releaseBoundary: 'human_review_then_release_governance_then_discover_selection',
      summary: review.summary,
      candidates: review.items.map((item) => ({
        mixId: item.mixId,
        title: item.title,
        demandTypeId: item.demandTypeId,
        goal: item.goal,
        scene: item.scene,
        contentMode: item.contentMode,
        durationSeconds: item.durationSeconds,
        renderedAudioUrl: item.renderedAudioUrl,
        machineQa: item.machineQa,
        humanReview: item.humanReview,
        releaseEligible: item.releaseEligible,
        releaseBlockers: item.releaseBlockers,
        releaseGovernance: item.releaseGovernance,
      })),
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${review.batchId || 'demand-production'}-review-manifest.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel title="本批次人工听审" action={
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-end' }}>
      <button type="button" onClick={downloadReviewManifest} disabled={!review} style={{ minHeight: 32, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', fontWeight: 800, cursor: review ? 'pointer' : 'not-allowed' }}>
        导出听审清单
      </button>
      <button type="button" onClick={onOpenDiscover} style={{ minHeight: 32, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', fontWeight: 800, cursor: 'pointer' }}>
        去发现页配置
      </button>
      <button type="button" onClick={onRefresh} disabled={loading} style={{ minHeight: 32, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>
        <RefreshCw size={14} />刷新
      </button>
    </div>
  }>
    <div style={{ display: 'grid', gap: 12 }}>
      {error && <p style={{ color: '#ffb1b1', fontSize: 13 }}>{error}</p>}
      {loading && !review && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>正在读取待听审候选...</p>}
      {review && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 1, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            {[
              ['候选', review.summary.total],
              ['机器可听', review.summary.machineReady],
              ['人工通过', review.summary.humanPassed],
              ['需返工', review.summary.needsRework],
              ['拒绝', review.summary.rejected],
              ['可发布', review.summary.releaseEligible],
              ['已入池', review.summary.released],
            ].map(([label, value]) => (
              <span key={label} style={{ background: 'rgba(255,255,255,0.035)', padding: 10, minHeight: 58, display: 'grid', gap: 4 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 800 }}>{label}</span>
                <strong style={{ fontSize: 18, lineHeight: 1 }}>{value}</strong>
              </span>
            ))}
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>{review.batchId || '暂无批次'} · {review.policy} 发布治理通过后只进入发现页可选内容池，不会自动写入发现页配置。</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(180px,1fr) minmax(0,2fr)', gap: 8, alignItems: 'end' }}>
            <label style={labelStyle}>需求队列
              <select value={demandFilter} onChange={(event) => setDemandFilter(event.target.value)} style={fieldStyle}>
                <option value="all">全部需求类型</option>
                {demandOptions.map((demandTypeId) => <option key={demandTypeId} value={demandTypeId}>{t(demandTypeId)}</option>)}
              </select>
            </label>
            <label style={labelStyle}>听审状态
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'pending' | 'decided' | 'all')} style={fieldStyle}>
                <option value="pending">待听审</option>
                <option value="decided">已听审</option>
                <option value="all">全部</option>
              </select>
            </label>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45, paddingBottom: 8 }}>
              当前队列 {filteredItems.length} 条 · 已决策 {decidedItems.length} 条 · 机器 QA 通过后人工只需通过、返工或拒绝
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" onClick={() => { setDemandFilter('all'); setStatusFilter('pending'); }} style={{ minHeight: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: demandFilter === 'all' && statusFilter === 'pending' ? 'rgba(255,255,255,0.08)' : 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', fontWeight: 800, cursor: 'pointer' }}>全部待听审</button>
            {queueSummary.map((item) => (
              <button
                key={item.demandTypeId}
                type="button"
                onClick={() => { setDemandFilter(item.demandTypeId); setStatusFilter('pending'); }}
                style={{ minHeight: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: demandFilter === item.demandTypeId && statusFilter === 'pending' ? 'rgba(140,106,255,0.18)' : 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', fontWeight: 800, cursor: 'pointer' }}
              >
                {item.label} · 待听 {item.pending} · 已听 {item.decided}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {filteredItems.map((item) => (
              <div key={item.mixId} style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, background: 'rgba(255,255,255,0.025)', padding: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) 110px 110px minmax(180px,1fr)', gap: 10, alignItems: 'start' }}>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 14, overflowWrap: 'anywhere' }}>{item.title}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11, overflowWrap: 'anywhere' }}>{item.mixId}</span>
                  </span>
                  <span style={{ color: statusTone(item.approvalState), fontSize: 12, fontWeight: 800 }}>{t(item.approvalState)}</span>
                  <span style={{ color: statusTone(item.renderStatus), fontSize: 12, fontWeight: 800 }}>{t(item.renderStatus)}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.35 }}>{t(item.goal)} / {t(item.scene)} · {item.trackCount} 轨 · {min(item.durationSeconds)}</span>
                </div>
                {item.renderedAudioUrl ? <audio controls preload="none" src={resolveServiceUrl(item.renderedAudioUrl)} style={{ width: '100%' }} /> : <span style={{ color: '#f0c66a', fontSize: 12 }}>尚无渲染音频，不能人工通过。</span>}
                {(() => {
                  const draft = reviewDraftFor(item);
                  return (
                    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.025)', padding: 10, display: 'grid', gap: 8 }}>
                      <label style={labelStyle}>人工听审备注（可选）
                        <textarea
                          value={draft.notes}
                          onChange={(event) => onDraftChange(item.mixId, { notes: event.target.value })}
                          rows={2}
                          placeholder="可选：记录特殊听感、问题或适用场景；不填写也可以直接做审核决策。"
                          style={fieldStyle}
                        />
                      </label>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>人工只做最终决策：机器 QA 通过后，可直接通过、返工或拒绝。备注只是补充信息，不是通过门槛。</span>
                    </div>
                  );
                })()}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>
                    <span>机器 QA：{item.machineQa?.passed ? '通过' : '未通过'}；峰值 {item.machineQa?.peakDb ?? 'n/a'} dB；LUFS {item.machineQa?.integratedLufs ?? 'n/a'}。</span><br />
                    <span>来源 Mix：{item.sourceMixId || '无'}；补充素材：{item.materialStemId || '无'}。</span><br />
                    {item.humanReview && <span>人工结论：{t(item.humanReview.decision)}{item.humanReview.notes ? `；备注：${item.humanReview.notes}` : ''}。</span>}
                    {item.releaseGovernance && <><br /><span>发布治理：{t(item.releaseGovernance.state)}；{formatDate(item.releaseGovernance.releasedAt)}；仍需发现页配置选择。</span></>}
                    {!item.releaseGovernance && item.releaseBlockers.length > 0 && <><br /><span style={{ color: '#f0c66a' }}>发布阻断：{item.releaseBlockers.slice(0, 3).join('；')}{item.releaseBlockers.length > 3 ? ` 等 ${item.releaseBlockers.length} 项` : ''}</span></>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'start', justifyContent: 'flex-end' }}>
                    {passBlockersFor(item).length > 0 && (
                      <span style={{ flexBasis: '100%', color: '#f0c66a', fontSize: 12, lineHeight: 1.4, textAlign: 'right' }}>
                        人工通过前还差：{passBlockersFor(item).join('；')}
                      </span>
                    )}
                    {(['passed', 'needs_rework', 'rejected'] as const).map((decision) => {
                      const passBlockers = passBlockersFor(item);
                      const disabled = reviewingId === item.mixId || (decision === 'passed' && passBlockers.length > 0);
                      return (
                        <button
                          key={decision}
                          type="button"
                          onClick={() => onReview(item.mixId, decision, reviewDraftFor(item))}
                          disabled={disabled}
                          title={decision === 'passed' ? (passBlockers.length > 0 ? `人工通过前还差：${passBlockers.join('；')}` : '人工通过后仍需发布治理') : undefined}
                          style={{ minHeight: 32, borderRadius: 7, border: '1px solid var(--surface-border)', background: item.humanReview?.decision === decision ? 'rgba(255,255,255,0.08)' : 'var(--surface-2)', color: statusTone(decision === 'passed' ? 'passed' : decision === 'needs_rework' ? 'human_requested_rework' : 'human_rejected'), padding: '0 10px', fontWeight: 800, cursor: reviewingId === item.mixId ? 'wait' : disabled ? 'not-allowed' : 'pointer' }}
                        >
                          {reviewingId === item.mixId ? '保存中...' : decision === 'passed' ? (passBlockers.length > 0 ? '未满足通过条件' : '人工通过') : decision === 'needs_rework' ? '需返工' : '拒绝'}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => onRelease(item.mixId)}
                      disabled={releasingId === item.mixId || !item.releaseEligible || Boolean(item.releaseGovernance)}
                      title={item.releaseEligible ? '通过发布治理，进入发现页可选内容池' : item.releaseBlockers.join('；')}
                      style={{ minHeight: 32, borderRadius: 7, border: '1px solid var(--surface-border)', background: item.releaseGovernance ? 'rgba(142,230,176,0.12)' : 'var(--surface-2)', color: statusTone(item.releaseGovernance?.state ?? (item.releaseEligible ? 'published_release_ready' : 'blocked')), padding: '0 10px', fontWeight: 800, cursor: releasingId === item.mixId ? 'wait' : !item.releaseEligible || item.releaseGovernance ? 'not-allowed' : 'pointer' }}
                    >
                      {releasingId === item.mixId ? '发布治理中...' : item.releaseGovernance ? '已入发布可选池' : '通过发布治理'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{review.items.length === 0 ? '当前没有需求生产候选。' : '当前筛选条件下没有候选。'}</span>}
          </div>
        </>
      )}
    </div>
  </Panel>
  );
};

type UploadDraft = {
  file: File | null;
  name: string;
  category: StemCategory;
  tags: string;
  description: string;
  defaultVolume: number;
  sourcePlatform: string;
  sourceUrl: string;
  sourceCreator: string;
  licenseName: string;
  licenseUrl: string;
  commercialUseAllowed: boolean;
  derivativeUseAllowed: boolean;
  attributionRequired: boolean;
  rawRedistributionAllowed: boolean;
};

type UploadInspection = {
  fileSha256: string;
  durationSeconds: number | null;
  sampleRate: number | null;
  contentType: string;
  warnings: string[];
};

type DiscoverConfig = {
  version: number;
  heroLabel: string;
  tags: string[];
  quickActions: Array<{ label: string; prompt: string }>;
  sections: Array<{
    id: string;
    enabled: boolean;
    eyebrow: string;
    title: string;
    description: string;
    prompt: string;
    keywords: string[];
    mixIds: string[];
    icon: string;
    limit: number;
  }>;
  governance?: {
    releaseEligibleMixIds: string[];
    blockedBindings: Array<{ sectionId: string; mixId: string; reason: string }>;
    emptySections: Array<{ sectionId: string; title: string; reason: string }>;
  };
  demandPools?: Array<{
    id: string;
    title: string;
    description: string;
    prompt: string;
    keywords: string[];
    goal: string;
    scene: string;
    contentMode: string;
    freeTargetCount: number;
    paidTargetCount: number;
    eligibleMixCount: number;
    eligibleMixIds: string[];
    mixes: Array<{
      id: string;
      title: string;
      goal: string;
      scene: string;
      contentMode: string;
      playsCount: number;
      trackCategories: string[];
    }>;
  }>;
};

type DemandReviewDraft = {
  notes: string;
};

const emptyUploadDraft = (): UploadDraft => ({
  file: null,
  name: '',
  category: 'Nature',
  tags: '',
  description: '',
  defaultVolume: 60,
  sourcePlatform: '后台上传',
  sourceUrl: '',
  sourceCreator: '',
  licenseName: '待确认授权',
  licenseUrl: '',
  commercialUseAllowed: false,
  derivativeUseAllowed: false,
  attributionRequired: true,
  rawRedistributionAllowed: false,
});

const createEmptyDiscoverSection = (index: number): DiscoverConfig['sections'][number] => ({
  id: `section-${index + 1}`,
  enabled: true,
  eyebrow: '诉求',
  title: '新发现栏目',
  description: '说明这个栏目帮助用户找到什么声音。',
  prompt: '生成一个柔和的无人声声景。',
  keywords: [],
  mixIds: [],
  icon: 'compass',
  limit: 6,
});

const demandPoolForSection = (
  section: DiscoverConfig['sections'][number],
  demandPools: NonNullable<DiscoverConfig['demandPools']>,
) => {
  const direct = demandPools.find((pool) => pool.id === section.id);
  if (direct) return direct;
  const haystack = `${section.id} ${section.title} ${section.description} ${section.prompt} ${section.keywords.join(' ')}`.toLowerCase();
  return demandPools.find((pool) =>
    haystack.includes(pool.id.toLowerCase())
    || pool.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
    || haystack.includes(pool.goal)
    || haystack.includes(pool.scene),
  ) ?? null;
};

const AdminDashboard: React.FC = () => {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [contentModel, setContentModel] = useState<AdminUnifiedContentModel | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>(() => typeof window === 'undefined' ? 'overview' : sectionFromHash(window.location.hash));
  const uploadPanelRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [assetCategory, setAssetCategory] = useState('');
  const [assetStatus, setAssetStatus] = useState('');
  const [assets, setAssets] = useState<AudioStem[]>([]);
  const [assetTotal, setAssetTotal] = useState(0);
  const [assetHasMore, setAssetHasMore] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [importInbox, setImportInbox] = useState<AdminImportInbox | null>(null);
  const [scanningImport, setScanningImport] = useState(false);
  const [importingInbox, setImportingInbox] = useState(false);
  const [uploadDraft, setUploadDraft] = useState<UploadDraft>(() => emptyUploadDraft());
  const [uploadInspection, setUploadInspection] = useState<UploadInspection | null>(null);
  const [inspectingUpload, setInspectingUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviewingId, setReviewingId] = useState('');
  const [assetMessage, setAssetMessage] = useState('');
  const [assetError, setAssetError] = useState('');
  const [discoverConfig, setDiscoverConfig] = useState<DiscoverConfig | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverSaving, setDiscoverSaving] = useState(false);
  const [discoverMessage, setDiscoverMessage] = useState('');
  const [discoverError, setDiscoverError] = useState('');
  const [discoverAvailableMixes, setDiscoverAvailableMixes] = useState<Mix[]>([]);
  const discoverLoadAttemptedRef = useRef(false);
  const [knowledgeCatalog, setKnowledgeCatalog] = useState<AdminKnowledgeCatalog | null>(null);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeDimension, setKnowledgeDimension] = useState('');
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [knowledgeMessage, setKnowledgeMessage] = useState('');
  const [knowledgeError, setKnowledgeError] = useState('');
  const [conceptDraft, setConceptDraft] = useState({ name: '', description: '', synonyms: '', active: true });
  const [demandCoverage, setDemandCoverage] = useState<AdminDemandCoverage | null>(null);
  const [demandCoverageLoading, setDemandCoverageLoading] = useState(false);
  const [demandCoverageError, setDemandCoverageError] = useState('');
  const [demandReview, setDemandReview] = useState<AdminDemandProductionReview | null>(null);
  const [demandReviewLoading, setDemandReviewLoading] = useState(false);
  const [demandReviewError, setDemandReviewError] = useState('');
  const [demandReviewingId, setDemandReviewingId] = useState('');
  const [demandReleasingId, setDemandReleasingId] = useState('');
  const [demandReviewDrafts, setDemandReviewDrafts] = useState<Record<string, DemandReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectAdminSection = (section: AdminSection) => {
    setActiveSection(section);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${window.location.pathname}#${section}`);
    }
  };

  const loadOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const [nextOverview, nextContentModel] = await Promise.all([api.getAdminOverview(), api.getAdminContentModel()]);
      setOverview(nextOverview);
      setContentModel(nextContentModel);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '后台数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAssets = useCallback(async (offset = 0, append = false) => {
    setAssetsLoading(true);
    setAssetError('');
    try {
      const result = await api.getAdminAssets({ query, category: assetCategory, status: assetStatus, limit: 80, offset });
      setAssets((current) => append ? [...current, ...result.assets] : result.assets);
      setAssetTotal(result.pagination.total);
      setAssetHasMore(result.pagination.hasMore);
    } catch (requestError) {
      setAssetError(requestError instanceof Error ? requestError.message : '素材加载失败');
    } finally {
      setAssetsLoading(false);
    }
  }, [assetCategory, assetStatus, query]);

  const loadKnowledgeCatalog = useCallback(async (conceptId?: string) => {
    setKnowledgeLoading(true);
    setKnowledgeError('');
    try {
      const result = await api.getAdminKnowledge({ query: knowledgeQuery, dimension: knowledgeDimension, conceptId });
      setKnowledgeCatalog(result);
      if (result.selectedConcept) {
        setConceptDraft({
          name: result.selectedConcept.name,
          description: result.selectedConcept.description,
          synonyms: result.selectedConcept.synonyms.join(', '),
          active: result.selectedConcept.active,
        });
      }
    } catch (requestError) {
      setKnowledgeError(requestError instanceof Error ? requestError.message : '知识库加载失败');
    } finally {
      setKnowledgeLoading(false);
    }
  }, [knowledgeDimension, knowledgeQuery]);

  useEffect(() => { loadOverview(); }, []);
  useEffect(() => {
    const syncSectionFromHash = () => setActiveSection(sectionFromHash(window.location.hash));
    window.addEventListener('hashchange', syncSectionFromHash);
    return () => window.removeEventListener('hashchange', syncSectionFromHash);
  }, []);
  useEffect(() => { if (activeSection === 'assets') loadAssets(0, false); }, [activeSection, loadAssets]);
  useEffect(() => {
    if (activeSection === 'discover' && !discoverConfig && !discoverLoading && !discoverLoadAttemptedRef.current) {
      discoverLoadAttemptedRef.current = true;
      loadDiscoverConfig();
    }
  }, [activeSection, discoverConfig, discoverLoading]);
  useEffect(() => {
    if (activeSection === 'knowledge' && !knowledgeCatalog && !knowledgeLoading) loadKnowledgeCatalog();
  }, [activeSection, knowledgeCatalog, knowledgeLoading, loadKnowledgeCatalog]);
  useEffect(() => {
    if (activeSection === 'review' && !demandCoverage && !demandCoverageLoading) loadDemandCoverage();
  }, [activeSection, demandCoverage, demandCoverageLoading]);
  useEffect(() => {
    if (activeSection === 'review' && !demandReview && !demandReviewLoading) loadDemandReview();
  }, [activeSection, demandReview, demandReviewLoading]);

  const loadDemandCoverage = async () => {
    setDemandCoverageLoading(true);
    setDemandCoverageError('');
    try {
      setDemandCoverage(await api.getAdminDemandCoverage());
    } catch (requestError) {
      setDemandCoverageError(requestError instanceof Error ? requestError.message : '需求覆盖加载失败');
    } finally {
      setDemandCoverageLoading(false);
    }
  };

  const loadDemandReview = async () => {
    setDemandReviewLoading(true);
    setDemandReviewError('');
    try {
      const result = await api.getAdminDemandProductionReview();
      setDemandReview(result);
      setDemandReviewDrafts((current) => {
        const next = { ...current };
        for (const item of result.items) {
          if (!next[item.mixId]) {
            next[item.mixId] = {
              notes: item.humanReview?.notes ?? '',
            };
          }
        }
        return next;
      });
    } catch (requestError) {
      setDemandReviewError(requestError instanceof Error ? requestError.message : '人工听审加载失败');
    } finally {
      setDemandReviewLoading(false);
    }
  };

  const updateDemandReviewDraft = (mixId: string, draft: Partial<DemandReviewDraft>) => {
    setDemandReviewDrafts((current) => ({
      ...current,
      [mixId]: {
        notes: current[mixId]?.notes ?? '',
        ...draft,
      },
    }));
  };

  const reviewDemandCandidate = async (mixId: string, decision: 'passed' | 'needs_rework' | 'rejected', draft: DemandReviewDraft) => {
    setDemandReviewingId(mixId);
    setDemandReviewError('');
    const fallbackNotes = decision === 'needs_rework'
        ? '人工听审要求返工：需要改善贴合度、差异化或听感稳定性。'
        : '人工听审拒绝：不进入发布候选。';
    try {
      await api.reviewAdminDemandProductionCandidate(mixId, {
        decision,
        notes: decision === 'passed' ? draft.notes.trim() : draft.notes.trim() || fallbackNotes,
      });
      await Promise.all([loadDemandReview(), loadDemandCoverage(), loadOverview()]);
    } catch (requestError) {
      setDemandReviewError(requestError instanceof Error ? requestError.message : '人工听审保存失败');
    } finally {
      setDemandReviewingId('');
    }
  };

  const releaseDemandCandidate = async (mixId: string) => {
    setDemandReleasingId(mixId);
    setDemandReviewError('');
    try {
      await api.releaseAdminDemandProductionCandidate(mixId);
      await Promise.all([loadDemandReview(), loadDemandCoverage(), loadOverview(), loadDiscoverConfig()]);
    } catch (requestError) {
      setDemandReviewError(requestError instanceof Error ? requestError.message : '发布治理失败');
    } finally {
      setDemandReleasingId('');
    }
  };

  const loadDiscoverConfig = async () => {
    setDiscoverLoading(true);
    setDiscoverError('');
    try {
      const result = await api.getDiscoverConfig();
      const { availableMixes, ...config } = result;
      setDiscoverConfig(config);
      setDiscoverAvailableMixes(availableMixes);
      discoverLoadAttemptedRef.current = true;
    } catch (requestError) {
      setDiscoverError(requestError instanceof Error ? requestError.message : '发现页配置加载失败');
    } finally {
      setDiscoverLoading(false);
    }
  };

  const saveDiscoverConfig = async () => {
    if (!discoverConfig) return;
    setDiscoverSaving(true);
    setDiscoverMessage('');
    setDiscoverError('');
    try {
      const payload = {
        version: discoverConfig.version,
        heroLabel: discoverConfig.heroLabel,
        tags: discoverConfig.tags,
        quickActions: discoverConfig.quickActions,
        sections: discoverConfig.sections,
      };
      await api.updateDiscoverConfig(payload);
      await loadDiscoverConfig();
      discoverLoadAttemptedRef.current = true;
      setDiscoverMessage('发现页配置已保存，用户端发现页会读取最新栏目。');
    } catch (requestError) {
      setDiscoverError(requestError instanceof Error ? requestError.message : '发现页配置保存失败');
    } finally {
      setDiscoverSaving(false);
    }
  };

  const saveKnowledgeConcept = async () => {
    const selected = knowledgeCatalog?.selectedConcept;
    if (!selected) return;
    setKnowledgeSaving(true);
    setKnowledgeMessage('');
    setKnowledgeError('');
    try {
      await api.updateAdminKnowledgeConcept(selected.id, {
        name: conceptDraft.name,
        description: conceptDraft.description,
        synonyms: conceptDraft.synonyms.split(',').map((item) => item.trim()).filter(Boolean),
        active: conceptDraft.active,
      });
      setKnowledgeMessage(`已保存概念「${conceptDraft.name}」。`);
      await loadKnowledgeCatalog(selected.id);
      await loadOverview();
    } catch (requestError) {
      setKnowledgeError(requestError instanceof Error ? requestError.message : '概念保存失败');
    } finally {
      setKnowledgeSaving(false);
    }
  };

  const openUploadPanel = () => {
    selectAdminSection('assets');
    window.setTimeout(() => {
      uploadPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const scanImportInbox = async () => {
    setScanningImport(true);
    setAssetMessage('');
    setAssetError('');
    try {
      const result = await api.getAdminImportInbox();
      setImportInbox(result);
      setAssetMessage(`已扫描导入目录：${result.summary.total} 个音频文件，${result.summary.ready} 个可导入，${result.summary.duplicate} 个重复`);
    } catch (requestError) {
      setAssetError(requestError instanceof Error ? requestError.message : '扫描导入目录失败');
    } finally {
      setScanningImport(false);
    }
  };

  const importReadyInboxAssets = async () => {
    if (!importInbox) {
      await scanImportInbox();
      return;
    }
    const readyPaths = importInbox.files.filter((file) => file.status === 'ready').map((file) => file.relativePath);
    if (readyPaths.length === 0) {
      setAssetError('当前没有可导入的新文件');
      return;
    }
    setImportingInbox(true);
    setAssetMessage('');
    setAssetError('');
    try {
      const result = await api.importAdminInboxAssets(readyPaths);
      setAssetMessage(`已批量导入 ${result.summary.imported} 个素材，全部为待审核状态`);
      const refreshed = await api.getAdminImportInbox();
      setImportInbox(refreshed);
      await Promise.all([loadOverview(), loadAssets(0, false)]);
    } catch (requestError) {
      setAssetError(requestError instanceof Error ? requestError.message : '批量导入失败');
    } finally {
      setImportingInbox(false);
    }
  };

  const inspectUploadFile = async (file: File | null) => {
    setAssetMessage('');
    setAssetError('');
    setUploadInspection(null);
    if (!file) {
      setUploadDraft((current) => ({ ...current, file: null }));
      return;
    }
    setInspectingUpload(true);
    setUploadDraft((current) => ({ ...current, file, name: current.name || file.name.replace(/\.[^.]+$/, '') }));
    try {
      const { suggestion } = await api.inspectAdminAssetUpload(file);
      setUploadDraft((current) => ({
        ...current,
        file,
        name: suggestion.name,
        category: suggestion.category,
        tags: suggestion.tags,
        description: suggestion.description,
        defaultVolume: suggestion.defaultVolume,
        sourcePlatform: suggestion.sourcePlatform,
        sourceCreator: suggestion.sourceCreator,
        sourceUrl: suggestion.sourceUrl,
        licenseName: suggestion.licenseName,
        licenseUrl: suggestion.licenseUrl,
        commercialUseAllowed: suggestion.commercialUseAllowed,
        derivativeUseAllowed: suggestion.derivativeUseAllowed,
        attributionRequired: suggestion.attributionRequired,
        rawRedistributionAllowed: suggestion.rawRedistributionAllowed,
      }));
      setUploadInspection({
        fileSha256: suggestion.fileSha256,
        durationSeconds: suggestion.durationSeconds,
        sampleRate: suggestion.sampleRate,
        contentType: suggestion.contentType,
        warnings: suggestion.warnings,
      });
      setAssetMessage('已自动识别并预填表单，请确认授权和听感信息后上传。');
    } catch (requestError) {
      setUploadDraft((current) => ({ ...current, file, name: current.name || file.name.replace(/\.[^.]+$/, '') }));
      setAssetError(requestError instanceof Error ? requestError.message : '自动识别失败，请手动填写');
    } finally {
      setInspectingUpload(false);
    }
  };

  const uploadAsset = async (event: React.FormEvent) => {
    event.preventDefault();
    setAssetMessage('');
    setAssetError('');
    if (!uploadDraft.file) {
      setAssetError('请先选择音频文件');
      return;
    }
    setUploading(true);
    try {
      const result = await api.uploadAdminAsset({
        file: uploadDraft.file,
        name: uploadDraft.name || uploadDraft.file.name.replace(/\.[^.]+$/, ''),
        category: uploadDraft.category,
        tags: uploadDraft.tags,
        description: uploadDraft.description,
        defaultVolume: uploadDraft.defaultVolume,
        sourcePlatform: uploadDraft.sourcePlatform,
        sourceUrl: uploadDraft.sourceUrl,
        sourceCreator: uploadDraft.sourceCreator,
        licenseName: uploadDraft.licenseName,
        licenseUrl: uploadDraft.licenseUrl,
        commercialUseAllowed: uploadDraft.commercialUseAllowed,
        derivativeUseAllowed: uploadDraft.derivativeUseAllowed,
        attributionRequired: uploadDraft.attributionRequired,
        rawRedistributionAllowed: uploadDraft.rawRedistributionAllowed,
      });
      setAssetMessage(`已上传「${result.asset.name}」，当前状态为待审核`);
      setUploadDraft(emptyUploadDraft());
      setUploadInspection(null);
      await Promise.all([loadOverview(), loadAssets(0, false)]);
    } catch (requestError) {
      setAssetError(requestError instanceof Error ? requestError.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const reviewAsset = async (stem: AudioStem, qaStatus: 'approved' | 'needs_review' | 'rejected') => {
    const defaultNote = qaStatus === 'approved'
      ? '授权、机器 QA、人工听感 QA 已通过。'
      : qaStatus === 'rejected'
        ? '人工审核拒绝。'
        : '退回待审核，等待补充授权或 QA。';
    const note = window.prompt(`给「${stem.name}」记录一条审核备注`, defaultNote);
    if (note === null) return;
    setReviewingId(stem.id);
    setAssetMessage('');
    setAssetError('');
    try {
      const result = await api.reviewAdminAsset(stem.id, { qaStatus, notes: note });
      setAssets((current) => current.map((asset) => asset.id === stem.id ? result.asset : asset));
      setAssetMessage(`${result.asset.name} 已更新为「${t(result.asset.qaStatus)}」${result.releaseEligible ? '，可进入发布素材池' : '，不会进入公开生成池'}`);
      await Promise.all([loadOverview(), loadAssets(0, false)]);
    } catch (requestError) {
      setAssetError(requestError instanceof Error ? requestError.message : '审核更新失败');
    } finally {
      setReviewingId('');
    }
  };

  if (loading && !overview) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-main)' }}>
        <Loader2 className="animate-spin" size={28} />
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)', display: 'grid', gridTemplateColumns: 'clamp(74px,18vw,232px) minmax(0,1fr)' }}>
      <aside style={{ borderRight: '1px solid var(--surface-border)', background: 'rgba(255,255,255,0.025)', padding: '22px 14px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '0 8px' }}>
          <span style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary)', display: 'grid', placeItems: 'center' }}><Shield size={18} /></span>
          <div>
            <strong style={{ display: 'block' }}>MixStil 后台</strong>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>运营管理中心</span>
          </div>
        </div>
        <nav style={{ display: 'grid', gap: 4 }}>
          {sections.map(({ id, label, icon: Icon }) => {
            const active = activeSection === id;
            return (
              <button key={id} type="button" onClick={() => selectAdminSection(id)} style={{ height: 42, borderRadius: 7, border: '1px solid transparent', background: active ? 'rgba(140,106,255,0.18)' : 'transparent', color: active ? 'white' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', cursor: 'pointer', fontWeight: active ? 800 : 600 }}>
                <Icon size={17} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main style={{ padding: '24px 28px 56px', minWidth: 0 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginBottom: 20 }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800, marginBottom: 5 }}>运营工作台</p>
            <h1 style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 900 }}>MixStil 管理后台</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" onClick={openUploadPanel} style={{ height: 40, borderRadius: 7, border: 0, background: 'var(--primary)', color: 'white', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 13px', cursor: 'pointer', fontWeight: 800 }}>
              <Upload size={17} />上传素材
            </button>
            <button type="button" onClick={() => { selectAdminSection('assets'); window.setTimeout(scanImportInbox, 80); }} style={{ height: 40, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-1)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 12px', cursor: 'pointer', fontWeight: 800 }}>
              <FolderOpen size={17} />扫描文件夹
            </button>
            <button type="button" onClick={() => { loadOverview(); if (activeSection === 'assets') loadAssets(0, false); }} style={{ height: 40, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-1)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 12px', cursor: 'pointer' }}>
              <RefreshCw size={17} />刷新数据
            </button>
          </div>
        </header>

        {error && <div role="alert" style={{ marginBottom: 18, padding: 13, borderRadius: 8, border: '1px solid rgba(255,131,131,0.36)', background: 'rgba(255,131,131,0.08)', color: '#ffd6d6' }}>{error}</div>}

        {overview && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
              <Metric label="用户总数" value={overview.users.total} note={`${countOf(overview.users.byRole, 'admin')} 个管理员，${countOf(overview.users.bySubscriptionTier, 'pro')} 个专业版用户`} icon={Users} />
              <Metric label="声音产品" value={overview.products.totalMixes} note={`${countOf(overview.products.byStatus, 'published')} 个已发布，${countOf(overview.products.byRenderStatus, 'ready')} 个可播放`} icon={Boxes} />
              <Metric label="素材库存" value={overview.assets.total} note={`${countOf(overview.assets.byQaStatus, 'approved')} 条已批准，${countOf(overview.assets.byQaStatus, 'needs_review')} 条待审核`} icon={AudioLines} />
              <Metric label="知识概念" value={overview.knowledge.conceptCount} note={`${overview.knowledge.metadataSummary.total} 条素材语义元数据`} icon={BookOpen} />
            </div>

            {activeSection === 'overview' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <UnifiedContentPipelinePanel overview={overview} />
                {contentModel && <NormalizedContentModelPanel model={contentModel} />}
                <ContentPipelineTables overview={overview} />
                <IntakeLoopPanel overview={overview} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
                  <Panel title="素材 QA 状态"><CountBars counts={overview.assets.byQaStatus} /></Panel>
                  <Panel title="产品发布状态"><CountBars counts={overview.products.byStatus} /></Panel>
                  <Panel title="知识库维度"><CountBars counts={overview.knowledge.byDimension} /></Panel>
                  <Panel title="当前后台原则">
                    <div style={{ display: 'grid', gap: 10, fontSize: 13, lineHeight: 1.5 }}>
                      <span><AlertTriangle size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />待审核素材不能进入公开播放、离线或导出。</span>
                      <span><CheckCircle2 size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />素材批准必须同时满足授权、机器 QA、人工听感 QA。</span>
                      <span><Gauge size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />支付和套餐只保留配置观察，不抢在内容价值闭环之前。</span>
                    </div>
                  </Panel>
                  <Panel title="运营漏斗">
                    <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                      <span>生成成功率：<strong>{pct(overview.analytics.funnel.generationSuccessRate)}</strong></span>
                      <span>保存率：<strong>{pct(overview.analytics.funnel.saveRate)}</strong></span>
                      <span>接受率：<strong>{pct(overview.analytics.funnel.acceptanceRate)}</strong></span>
                    </div>
                  </Panel>
                  <Panel title="系统状态">
                    <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                      <span>发布通道：<strong>{overview.system.releaseChannel}</strong></span>
                      <span>人声开关：<strong>{overview.system.guidedVoiceEnabled ? '已开启' : '已关闭'}</strong></span>
                      <span>存储：<strong>{overview.system.storageDriver}</strong></span>
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {activeSection === 'users' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <Panel title="用户角色分布"><CountBars counts={overview.users.byRole} /></Panel>
                  <Panel title="订阅层级"><CountBars counts={overview.users.bySubscriptionTier} /></Panel>
                  <Panel title="最近播放记录">
                    <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
                      {overview.users.playbackRecords.slice(0, 8).map((record) => (
                        <span key={`${record.userId}-${record.mixId}-${record.playedAt}`} style={{ color: 'var(--text-secondary)' }}>{record.username} 播放「{record.title}」{min(record.durationListened)}</span>
                      ))}
                    </div>
                  </Panel>
                </div>
                <Panel title="用户列表：角色、注册时间、使用次数、保存声音、偏好/排除项、播放记录"><UserManagementTable users={overview.users.management} /></Panel>
              </div>
            )}

            {activeSection === 'products' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <Panel title="睡眠 / 放松 / 专注覆盖"><CountBars counts={overview.products.byGoal} /></Panel>
                  <Panel title="版本与渲染状态"><CountBars counts={overview.products.byRenderStatus} /></Panel>
                  <Panel title="默认配方">
                    <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
                      {overview.products.defaultRecipes.slice(0, 10).map((recipe) => (
                        <span key={recipe.id}>{recipe.name} · {t(recipe.goal)} / {t(recipe.scene)} · {recipe.trackCount} 轨</span>
                      ))}
                    </div>
                  </Panel>
                </div>
                <Panel title="推荐内容 / 可发布声景"><MixTable mixes={overview.products.topMixes} /></Panel>
              </div>
            )}

            {activeSection === 'discover' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px,1.15fr) minmax(360px,0.85fr)', gap: 12, alignItems: 'start' }}>
                <Panel title="发现页运营配置" action={
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={loadDiscoverConfig} disabled={discoverLoading} style={{ minHeight: 34, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-1)', color: 'var(--text-primary)', padding: '0 10px', cursor: discoverLoading ? 'wait' : 'pointer' }}>
                      {discoverLoading ? '加载中' : '重新加载'}
                    </button>
                    <button type="button" onClick={saveDiscoverConfig} disabled={discoverSaving || !discoverConfig} style={{ minHeight: 34, borderRadius: 7, border: 0, background: 'var(--primary)', color: 'white', padding: '0 12px', fontWeight: 800, cursor: discoverSaving ? 'wait' : 'pointer' }}>
                      {discoverSaving ? '保存中' : '保存配置'}
                    </button>
                  </div>
                }>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {(discoverMessage || discoverError) && <div role={discoverError ? 'alert' : 'status'} style={{ padding: 11, borderRadius: 7, border: `1px solid ${discoverError ? 'rgba(255,131,131,0.35)' : 'rgba(142,230,176,0.32)'}`, background: discoverError ? 'rgba(255,131,131,0.08)' : 'rgba(142,230,176,0.08)', color: discoverError ? '#ffd6d6' : '#d9ffe5', fontSize: 13 }}>{discoverError || discoverMessage}</div>}
                    {discoverLoading && !discoverConfig && <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>正在加载发现页配置...</span>}
                    {discoverConfig && (
                      <>
                        <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'rgba(255,255,255,0.035)', padding: 12, display: 'grid', gap: 8 }}>
                          <strong style={{ fontSize: 13 }}>发现页发布门槛</strong>
                          <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>发现页只从素材库审核后的成品内容中上架：published + ready + frozen version + 全部可听素材满足授权、hash、QA 和 Voice-free Beta 约束。</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                            <span style={{ minHeight: 28, display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: '1px solid rgba(142,230,176,0.3)', color: '#8ee6b0', padding: '0 9px' }}>可上架内容 {discoverAvailableMixes.length}</span>
                            <span style={{ minHeight: 28, display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: '1px solid rgba(240,198,106,0.3)', color: '#f0c66a', padding: '0 9px' }}>阻塞绑定 {discoverConfig.governance?.blockedBindings.length ?? 0}</span>
                            <span style={{ minHeight: 28, display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: '1px solid rgba(240,198,106,0.3)', color: '#f0c66a', padding: '0 9px' }}>空栏目 {discoverConfig.governance?.emptySections.length ?? 0}</span>
                          </div>
                          {(discoverConfig.governance?.blockedBindings.length ?? 0) > 0 && (
                            <div style={{ display: 'grid', gap: 4, color: '#ffd6a8', fontSize: 12 }}>
                              {discoverConfig.governance!.blockedBindings.slice(0, 6).map((item) => <span key={`${item.sectionId}-${item.mixId}`}>{item.sectionId} 绑定的 {item.mixId} 不可上架：{item.reason}</span>)}
                            </div>
                          )}
                          {(discoverConfig.governance?.emptySections.length ?? 0) > 0 && (
                            <div style={{ display: 'grid', gap: 4, color: 'var(--text-secondary)', fontSize: 12 }}>
                              {discoverConfig.governance!.emptySections.slice(0, 4).map((item) => <span key={item.sectionId}>{item.title || item.sectionId} 没有绑定内容或匹配关键词。</span>)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
                          {[
                            ['1', '素材库入库', '音频只从素材库上传或导入，自动识别后仍然保持待审核。'],
                            ['2', '知识库标注', '素材标签引用统一概念，区分事实声源、用途、风险和排除规则。'],
                            ['3', '内容审核', '成品声景必须使用合格素材，并通过发布、渲染和复播门槛。'],
                            ['4', '发现上架', '栏目只能选择可上架内容；关键词只是概念筛选，不是上传入口。'],
                          ].map(([step, title, body]) => (
                            <div key={step} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'rgba(255,255,255,0.035)', padding: 10, display: 'grid', gap: 6, minHeight: 112 }}>
                              <span style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(140,106,255,0.18)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900 }}>{step}</span>
                              <strong style={{ fontSize: 13 }}>{title}</strong>
                              <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>{body}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
                          <label style={labelStyle}>版本<input type="number" value={discoverConfig.version} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, version: Number(event.target.value) || 1 } : current)} style={fieldStyle} /></label>
                          <label style={labelStyle}>首屏推荐提示<input value={discoverConfig.heroLabel} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, heroLabel: event.target.value } : current)} style={fieldStyle} /></label>
                        </div>
                        <label style={labelStyle}>顶部搜索标签<input value={discoverConfig.tags.join(', ')} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) } : current)} placeholder="#深度睡眠, #专注, #无人声" style={fieldStyle} /></label>

                        <section style={{ display: 'grid', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <strong>快捷入口</strong>
                            <button type="button" onClick={() => setDiscoverConfig((current) => current ? { ...current, quickActions: [...current.quickActions, { label: '新诉求', prompt: '生成一个柔和的无人声声景。' }] } : current)} style={{ minHeight: 32, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', cursor: 'pointer' }}><Plus size={14} />添加</button>
                          </div>
                          {discoverConfig.quickActions.map((item, index) => (
                            <div key={`${item.label}-${index}`} style={{ display: 'grid', gridTemplateColumns: '130px minmax(0,1fr) 34px', gap: 8 }}>
                              <input aria-label="快捷入口名称" value={item.label} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, quickActions: current.quickActions.map((action, actionIndex) => actionIndex === index ? { ...action, label: event.target.value } : action) } : current)} style={fieldStyle} />
                              <input aria-label="快捷入口创建指令" value={item.prompt} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, quickActions: current.quickActions.map((action, actionIndex) => actionIndex === index ? { ...action, prompt: event.target.value } : action) } : current)} style={fieldStyle} />
                              <button type="button" aria-label="删除快捷入口" onClick={() => setDiscoverConfig((current) => current ? { ...current, quickActions: current.quickActions.filter((_, actionIndex) => actionIndex !== index) } : current)} style={{ border: '1px solid var(--surface-border)', borderRadius: 7, background: 'var(--surface-1)', color: '#ffb1b1', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Trash2 size={15} /></button>
                            </div>
                          ))}
                        </section>

                        <section style={{ display: 'grid', gap: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <strong>栏目</strong>
                            <button type="button" onClick={() => setDiscoverConfig((current) => current ? { ...current, sections: [...current.sections, createEmptyDiscoverSection(current.sections.length)] } : current)} style={{ minHeight: 32, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', cursor: 'pointer' }}><Plus size={14} />添加栏目</button>
                          </div>
                          {discoverConfig.sections.map((section, index) => (
                            <article key={`${section.id}-${index}`} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, background: 'rgba(255,255,255,0.035)', display: 'grid', gap: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800 }}><input type="checkbox" checked={section.enabled} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item) } : current)} />启用栏目</label>
                                <button type="button" onClick={() => setDiscoverConfig((current) => current ? { ...current, sections: current.sections.filter((_, itemIndex) => itemIndex !== index) } : current)} style={{ minHeight: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-1)', color: '#ffb1b1', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 8px', cursor: 'pointer' }}><Trash2 size={14} />删除</button>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 8 }}>
                                <label style={labelStyle}>ID<input value={section.id} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, id: event.target.value } : item) } : current)} style={fieldStyle} /></label>
                                <label style={labelStyle}>栏目标题<input value={section.title} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) } : current)} style={fieldStyle} /></label>
                                <label style={labelStyle}>数量<input type="number" min={1} max={12} value={section.limit} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, limit: Number(event.target.value) || 6 } : item) } : current)} style={fieldStyle} /></label>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 8 }}>
                                <label style={labelStyle}>眉标<input value={section.eyebrow} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, eyebrow: event.target.value } : item) } : current)} style={fieldStyle} /></label>
                                <label style={labelStyle}>图标<select value={section.icon} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, icon: event.target.value } : item) } : current)} style={fieldStyle}>{['compass', 'moon', 'clock', 'music', 'volume', 'volume-x', 'trees', 'waves', 'timer-reset', 'brain', 'wind'].map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select></label>
                              </div>
                              <label style={labelStyle}>用户端说明<textarea value={section.description} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) } : current)} rows={2} style={fieldStyle} /></label>
                              <label style={labelStyle}>创建同款时使用的指令<textarea value={section.prompt} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item) } : current)} rows={2} style={fieldStyle} /></label>
                              <label style={labelStyle}>匹配关键词<input value={section.keywords.join(', ')} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, keywords: event.target.value.split(',').map((keyword) => keyword.trim()).filter(Boolean) } : item) } : current)} placeholder="睡眠, 雨声, 棕噪, 安静" style={fieldStyle} /></label>
                              {(() => {
                                const demandPools = discoverConfig.demandPools ?? [];
                                const currentPool = demandPoolForSection(section, demandPools);
                                const selectableMixes = currentPool?.mixes ?? discoverAvailableMixes.map((mix) => ({
                                  id: mix.id,
                                  title: mix.title,
                                  goal: mix.recipeData.audioIntent?.goal ?? '',
                                  scene: mix.recipeData.audioIntent?.scene ?? '',
                                  contentMode: mix.recipeData.audioIntent?.contentMode ?? mix.recipeData.contentMode ?? '',
                                  playsCount: mix.playsCount,
                                  trackCategories: [],
                                }));
                                return (
                                  <div style={{ display: 'grid', gap: 8 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 160px', gap: 8, alignItems: 'end' }}>
                                      <label style={labelStyle}>需求类型
                                        <select
                                          value={currentPool?.id ?? ''}
                                          onChange={(event) => {
                                            const pool = demandPools.find((item) => item.id === event.target.value);
                                            if (!pool) return;
                                            setDiscoverConfig((current) => current ? {
                                              ...current,
                                              sections: current.sections.map((item, itemIndex) => itemIndex === index
                                                ? {
                                                    ...item,
                                                    id: pool.id,
                                                    eyebrow: t(pool.scene),
                                                    title: pool.title,
                                                    description: pool.description,
                                                    prompt: pool.prompt,
                                                    keywords: pool.keywords,
                                                  }
                                                : item),
                                            } : current);
                                          }}
                                          style={fieldStyle}
                                        >
                                          <option value="">未匹配需求类型</option>
                                          {demandPools.map((pool) => <option key={pool.id} value={pool.id}>{pool.title} · {t(pool.goal)} / {t(pool.scene)} · {pool.eligibleMixCount} 条</option>)}
                                        </select>
                                      </label>
                                      <button
                                        type="button"
                                        disabled={!currentPool || currentPool.eligibleMixIds.length === 0}
                                        onClick={() => {
                                          if (!currentPool) return;
                                          const nextMixIds = currentPool.eligibleMixIds.slice(0, section.limit);
                                          setDiscoverConfig((current) => current ? {
                                            ...current,
                                            sections: current.sections.map((item, itemIndex) => itemIndex === index
                                              ? { ...item, mixIds: Array.from(new Set([...item.mixIds, ...nextMixIds])).slice(0, 24) }
                                              : item),
                                          } : current);
                                        }}
                                        style={{ minHeight: 38, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: currentPool ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 10px', cursor: currentPool ? 'pointer' : 'not-allowed', fontWeight: 800 }}
                                      >
                                        <Plus size={14} />补齐本栏目
                                      </button>
                                    </div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>
                                      {currentPool
                                        ? `当前栏目调用「${currentPool.title}」需求池：免费目标 ${currentPool.freeTargetCount} 条，Plus 目标 ${currentPool.paidTargetCount} 条，可选 ${currentPool.eligibleMixCount} 条。`
                                        : '选择需求类型后，栏目会从同一套用户需求定义下调用已审核内容。'}
                                    </span>
                                    <label style={labelStyle}>从该需求的可上架内容中加入
                                      <select
                                        value=""
                                        onChange={(event) => {
                                          const mixId = event.target.value;
                                          if (!mixId) return;
                                          setDiscoverConfig((current) => current ? {
                                            ...current,
                                            sections: current.sections.map((item, itemIndex) => itemIndex === index
                                              ? { ...item, mixIds: item.mixIds.includes(mixId) ? item.mixIds : [...item.mixIds, mixId] }
                                              : item),
                                          } : current);
                                        }}
                                        style={fieldStyle}
                                      >
                                        <option value="">{currentPool ? '选择该需求下的已发布声景' : '选择一个已发布声景加入栏目'}</option>
                                        {selectableMixes.map((mix) => <option key={mix.id} value={mix.id}>{mix.title} · {t(mix.goal)} / {t(mix.scene)} · {mix.id}</option>)}
                                      </select>
                                    </label>
                                  </div>
                                );
                              })()}
                              <label style={labelStyle}>绑定内容 ID（优先展示，逗号分隔）<textarea value={section.mixIds.join(', ')} onChange={(event) => setDiscoverConfig((current) => current ? { ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, mixIds: event.target.value.split(',').map((mixId) => mixId.trim()).filter(Boolean) } : item) } : current)} placeholder="mix_xxx, mix_yyy；留空则按关键词自动匹配" rows={2} style={fieldStyle} /></label>
                              {section.mixIds.length > 0 && (
                                <div style={{ display: 'grid', gap: 6 }}>
                                  {section.mixIds.map((mixId) => {
                                    const mix = discoverAvailableMixes.find((item) => item.id === mixId);
                                    return (
                                      <div key={mixId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 34px', alignItems: 'center', gap: 8, minHeight: 36, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '5px 6px 5px 9px' }}>
                                        <span style={{ minWidth: 0, color: mix ? 'var(--text-primary)' : '#f0c66a', fontSize: 12, overflowWrap: 'anywhere' }}>{mix ? `${mix.title} · ${mixId}` : `${mixId} · 未在可上架内容中找到`}</span>
                                        <button type="button" aria-label="移除绑定内容" onClick={() => setDiscoverConfig((current) => current ? { ...current, sections: current.sections.map((item, itemIndex) => itemIndex === index ? { ...item, mixIds: item.mixIds.filter((itemMixId) => itemMixId !== mixId) } : item) } : current)} style={{ width: 28, height: 28, border: '1px solid var(--surface-border)', borderRadius: 7, background: 'var(--surface-1)', color: '#ffb1b1', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </article>
                          ))}
                        </section>
                      </>
                    )}
                  </div>
                </Panel>

                <Panel title="用户端预览">
                  {discoverConfig ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800 }}>快捷入口</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {discoverConfig.quickActions.map((item, index) => <span key={`${item.label}-${index}`} style={{ minHeight: 30, display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: '1px solid var(--surface-border)', padding: '0 10px', color: 'var(--text-secondary)', fontSize: 12 }}>{item.label}</span>)}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 10 }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800 }}>栏目顺序</span>
                        {discoverConfig.sections.map((section) => (
                          <div key={section.id} style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: 12, display: 'grid', gap: 6, opacity: section.enabled ? 1 : 0.45 }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{section.eyebrow} · {section.icon} · {section.limit} 条</span>
                            <strong style={{ fontSize: 16 }}>{section.title}</strong>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>{section.description}</span>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 11, overflowWrap: 'anywhere' }}>关键词：{section.keywords.join(', ') || '未设置'}</span>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 11, overflowWrap: 'anywhere' }}>绑定内容：{section.mixIds.length > 0 ? section.mixIds.join(', ') : '未绑定，保存后按关键词自动匹配'}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800 }}>可上架内容库</span>
                        <div style={{ maxHeight: 360, overflow: 'auto', display: 'grid', gap: 7 }}>
                          {discoverAvailableMixes.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>暂无已发布且可播放的声景。先到「素材库管理」上传审核，再到「产品管理」形成可播放声景。</span>}
                          {discoverAvailableMixes.slice(0, 80).map((mix) => (
                            <div key={mix.id} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', gap: 9, alignItems: 'center', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 8 }}>
                              <span style={{ width: 44, height: 44, borderRadius: 7, background: `url(${mix.coverImageUrl}) center/cover, rgba(255,255,255,0.08)` }} />
                              <span style={{ minWidth: 0 }}>
                                <strong style={{ display: 'block', fontSize: 12, overflowWrap: 'anywhere' }}>{mix.title}</strong>
                                <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 11, overflowWrap: 'anywhere' }}>{mix.id}</span>
                                <span style={{ display: 'block', color: 'var(--text-tertiary)', fontSize: 11 }}>{t(mix.recipeData.audioIntent?.goal)} / {t(mix.recipeData.audioIntent?.scene)} · 播放 {mix.playsCount}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>加载配置后显示预览。</span>
                  )}
                </Panel>
              </div>
            )}

            {activeSection === 'assets' && (
              <div style={{ display: 'grid', gap: 12 }}>
              <IntakeLoopPanel overview={overview} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <Panel title="素材分类"><CountBars counts={overview.assets.byCategory} /></Panel>
                  <Panel title="授权与 QA 状态"><CountBars counts={overview.assets.byQaStatus} /></Panel>
                  <Panel title="批量扫描导入文件夹" action={<FolderOpen size={17} />}>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, background: 'rgba(255,255,255,0.035)', padding: 10, display: 'grid', gap: 6, fontSize: 12 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>把原文件复制到这个目录后，点击扫描：</span>
                        <strong style={{ overflowWrap: 'anywhere' }}>{importInbox?.rootPath ?? '/Users/pang/project/sleep-audio/public/audio/inbox/admin-import'}</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>批量导入只会入库为待审核，APP 不会直接调用未批准素材。</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button type="button" onClick={scanImportInbox} disabled={scanningImport} style={{ minHeight: 38, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', fontWeight: 800, padding: '0 10px', cursor: scanningImport ? 'wait' : 'pointer' }}>{scanningImport ? '扫描中...' : '扫描文件夹'}</button>
                        <button type="button" onClick={importReadyInboxAssets} disabled={importingInbox || !importInbox || importInbox.summary.ready === 0} style={{ minHeight: 38, borderRadius: 7, border: 0, background: 'var(--primary)', color: 'white', fontWeight: 800, padding: '0 10px', cursor: importingInbox ? 'wait' : 'pointer' }}>{importingInbox ? '导入中...' : `导入可用文件${importInbox ? ` (${importInbox.summary.ready})` : ''}`}</button>
                      </div>
                      {importInbox && (
                        <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>扫描结果：{importInbox.summary.total} 个文件，{importInbox.summary.ready} 个可导入，{importInbox.summary.duplicate} 个重复。</span>
                          <div style={{ display: 'grid', gap: 6 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>素材货架</strong>
                            <div style={{ maxHeight: 170, overflow: 'auto', display: 'grid', gridTemplateColumns: '1fr 64px 64px 64px', gap: 0, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7 }}>
                              <span style={{ padding: '7px 8px', color: 'var(--text-secondary)', fontWeight: 800 }}>文件夹</span>
                              <span style={{ padding: '7px 8px', color: 'var(--text-secondary)', fontWeight: 800 }}>总数</span>
                              <span style={{ padding: '7px 8px', color: 'var(--text-secondary)', fontWeight: 800 }}>可导</span>
                              <span style={{ padding: '7px 8px', color: 'var(--text-secondary)', fontWeight: 800 }}>重复</span>
                              {importInbox.shelves.map((shelf) => (
                                <React.Fragment key={shelf.folder}>
                                  <span style={{ padding: '7px 8px', borderTop: '1px solid rgba(255,255,255,0.06)', overflowWrap: 'anywhere' }}>{shelf.folder}</span>
                                  <span style={{ padding: '7px 8px', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>{shelf.total}</span>
                                  <span style={{ padding: '7px 8px', borderTop: '1px solid rgba(255,255,255,0.06)', color: shelf.ready > 0 ? '#8ee6b0' : 'var(--text-secondary)', fontWeight: shelf.ready > 0 ? 800 : 600 }}>{shelf.ready}</span>
                                  <span style={{ padding: '7px 8px', borderTop: '1px solid rgba(255,255,255,0.06)', color: shelf.duplicate > 0 ? '#f0c66a' : 'var(--text-secondary)' }}>{shelf.duplicate}</span>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: 9, display: 'grid', gap: 5 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>manifest 模板</strong>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.4 }}>{importInbox.manifestTemplate}</pre>
                          </div>
                          <div style={{ maxHeight: 260, overflow: 'auto', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            {importInbox.files.slice(0, 40).map((file) => (
                              <div key={file.relativePath} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) 68px 58px', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <span style={{ minWidth: 0 }}><strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{file.suggestion.name}</strong><span style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{file.relativePath}</span></span>
                                <span style={{ color: statusTone(file.status === 'ready' ? 'needs_review' : 'rejected'), fontWeight: 800 }}>{file.status === 'ready' ? '可导入' : '重复'}</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{fileSize(file.sizeBytes)}</span>
                              </div>
                            ))}
                            {importInbox.files.length > 40 && <span style={{ display: 'block', color: 'var(--text-secondary)', paddingTop: 8 }}>还有 {importInbox.files.length - 40} 个文件，导入时会一并处理。</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </Panel>
                  <div ref={uploadPanelRef}>
                  <Panel title="上传音频素材" action={<Upload size={17} />}>
                    <form onSubmit={uploadAsset} style={{ display: 'grid', gap: 10 }}>
                      <label style={labelStyle}>音频文件<input type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/flac,.mp3,.wav,.m4a,.aac,.ogg,.flac" onChange={(event) => inspectUploadFile(event.currentTarget.files?.[0] ?? null)} style={fieldStyle} /></label>
                      {(inspectingUpload || uploadInspection) && (
                        <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, background: 'rgba(255,255,255,0.035)', padding: 10, display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{inspectingUpload ? '正在自动识别音频...' : '自动识别结果'}</strong>
                          {uploadInspection && (
                            <>
                              <span>时长：{uploadInspection.durationSeconds ? `${Math.round(uploadInspection.durationSeconds)} 秒` : '未识别'} · 采样率：{uploadInspection.sampleRate ? `${uploadInspection.sampleRate} Hz` : '未识别'}</span>
                              <span>hash：{uploadInspection.fileSha256.slice(0, 16)}...</span>
                              {uploadInspection.warnings.map((warning) => <span key={warning}>提示：{warning}</span>)}
                            </>
                          )}
                        </div>
                      )}
                      <label style={labelStyle}>素材名称<input value={uploadDraft.name} onChange={(event) => setUploadDraft((current) => ({ ...current, name: event.target.value }))} style={fieldStyle} /></label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={labelStyle}>分类<select value={uploadDraft.category} onChange={(event) => setUploadDraft((current) => ({ ...current, category: event.target.value as StemCategory }))} style={fieldStyle}>{stemCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                        <label style={labelStyle}>默认音量<input type="number" min={0} max={100} value={uploadDraft.defaultVolume} onChange={(event) => setUploadDraft((current) => ({ ...current, defaultVolume: Number(event.target.value) }))} style={fieldStyle} /></label>
                      </div>
                      <label style={labelStyle}>标签<input value={uploadDraft.tags} onChange={(event) => setUploadDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="雨声, 睡眠, 稳定" style={fieldStyle} /></label>
                      <label style={labelStyle}>听感描述<textarea value={uploadDraft.description} onChange={(event) => setUploadDraft((current) => ({ ...current, description: event.target.value }))} rows={3} style={fieldStyle} /></label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={labelStyle}>来源<input value={uploadDraft.sourcePlatform} onChange={(event) => setUploadDraft((current) => ({ ...current, sourcePlatform: event.target.value }))} style={fieldStyle} /></label>
                        <label style={labelStyle}>作者/提供方<input value={uploadDraft.sourceCreator} onChange={(event) => setUploadDraft((current) => ({ ...current, sourceCreator: event.target.value }))} style={fieldStyle} /></label>
                      </div>
                      <label style={labelStyle}>来源地址<input value={uploadDraft.sourceUrl} onChange={(event) => setUploadDraft((current) => ({ ...current, sourceUrl: event.target.value }))} style={fieldStyle} /></label>
                      <label style={labelStyle}>授权名称<input value={uploadDraft.licenseName} onChange={(event) => setUploadDraft((current) => ({ ...current, licenseName: event.target.value }))} style={fieldStyle} /></label>
                      <label style={labelStyle}>授权地址<input value={uploadDraft.licenseUrl} onChange={(event) => setUploadDraft((current) => ({ ...current, licenseUrl: event.target.value }))} style={fieldStyle} /></label>
                      <div style={{ display: 'grid', gap: 7, fontSize: 12, color: 'var(--text-secondary)' }}>
                        {[
                          ['commercialUseAllowed', '允许商用'],
                          ['derivativeUseAllowed', '允许二创/混音'],
                          ['attributionRequired', '需要署名'],
                          ['rawRedistributionAllowed', '允许原始文件再分发'],
                        ].map(([key, label]) => (
                          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={Boolean(uploadDraft[key as keyof UploadDraft])} onChange={(event) => setUploadDraft((current) => ({ ...current, [key]: event.target.checked }))} /><span>{label}</span></label>
                        ))}
                      </div>
                      <button type="submit" disabled={uploading || inspectingUpload} style={{ height: 40, borderRadius: 7, border: 0, background: 'var(--primary)', color: 'white', fontWeight: 800, cursor: uploading || inspectingUpload ? 'wait' : 'pointer' }}>{uploading ? '上传中...' : inspectingUpload ? '识别中...' : '上传为待审核素材'}</button>
                    </form>
                  </Panel>
                  </div>
                </div>
                <Panel title={`素材清单（${assetTotal || overview.assets.total}）`} action={assetsLoading ? <Loader2 className="animate-spin" size={17} /> : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>已显示 {assets.length}</span>}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {(assetMessage || assetError) && <div role={assetError ? 'alert' : 'status'} style={{ padding: 11, borderRadius: 7, border: `1px solid ${assetError ? 'rgba(255,131,131,0.35)' : 'rgba(142,230,176,0.32)'}`, background: assetError ? 'rgba(255,131,131,0.08)' : 'rgba(142,230,176,0.08)', color: assetError ? '#ffd6d6' : '#d9ffe5', fontSize: 13 }}>{assetError || assetMessage}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px 92px', gap: 8 }}>
                      <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') loadAssets(0, false); }} placeholder="搜索名称、ID、URL、授权、标签" style={fieldStyle} />
                      <select value={assetCategory} onChange={(event) => setAssetCategory(event.target.value)} style={fieldStyle}><option value="">全部分类</option>{stemCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                      <select value={assetStatus} onChange={(event) => setAssetStatus(event.target.value)} style={fieldStyle}><option value="">全部 QA 状态</option>{stemQaStatuses.map((status) => <option key={status} value={status}>{t(status)}</option>)}</select>
                      <button type="button" onClick={() => loadAssets(0, false)} style={{ border: '1px solid var(--surface-border)', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}>搜索</button>
                    </div>
                    <StemTable stems={assets.length ? assets : overview.assets.recent} reviewingId={reviewingId} onReview={reviewAsset} />
                    {assetHasMore && <button type="button" disabled={assetsLoading} onClick={() => loadAssets(assets.length, true)} style={{ height: 40, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-primary)', cursor: assetsLoading ? 'wait' : 'pointer' }}>加载更多</button>}
                  </div>
                </Panel>
              </div>
              </div>
            )}

            {activeSection === 'knowledge' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <UnifiedContentPipelinePanel overview={overview} />
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px,0.9fr) minmax(420px,1.4fr)', gap: 12, alignItems: 'start' }}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <Panel title="声音概念维度"><CountBars counts={knowledgeCatalog?.dimensions ?? overview.knowledge.byDimension} /></Panel>
                    <Panel title="概念树与搜索" action={knowledgeLoading ? <Loader2 className="animate-spin" size={17} /> : <BookOpen size={17} />}>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {(knowledgeMessage || knowledgeError) && <div role={knowledgeError ? 'alert' : 'status'} style={{ padding: 11, borderRadius: 7, border: `1px solid ${knowledgeError ? 'rgba(255,131,131,0.35)' : 'rgba(142,230,176,0.32)'}`, background: knowledgeError ? 'rgba(255,131,131,0.08)' : 'rgba(142,230,176,0.08)', color: knowledgeError ? '#ffd6d6' : '#d9ffe5', fontSize: 13 }}>{knowledgeError || knowledgeMessage}</div>}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 132px 72px', gap: 8 }}>
                          <input value={knowledgeQuery} onChange={(event) => setKnowledgeQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') loadKnowledgeCatalog(); }} placeholder="搜索概念、说明、同义词" style={fieldStyle} />
                          <select value={knowledgeDimension} onChange={(event) => setKnowledgeDimension(event.target.value)} style={fieldStyle}>
                            <option value="">全部维度</option>
                            {Object.keys(knowledgeCatalog?.dimensions ?? overview.knowledge.byDimension).map((dimension) => <option key={dimension} value={dimension}>{dimension}</option>)}
                          </select>
                          <button type="button" onClick={() => loadKnowledgeCatalog()} style={{ border: '1px solid var(--surface-border)', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}>搜索</button>
                        </div>
                        <div style={{ maxHeight: 580, overflow: 'auto', display: 'grid', gap: 6 }}>
                          {(knowledgeCatalog?.concepts ?? overview.knowledge.sampleConcepts.map((concept) => ({ ...concept, childCount: 0, verifiedAssetCount: 0, candidateAssetCount: 0 }))).map((concept) => {
                            const selected = knowledgeCatalog?.selectedConcept?.id === concept.id;
                            return (
                              <button key={concept.id} type="button" onClick={() => loadKnowledgeCatalog(concept.id)} style={{ textAlign: 'left', border: `1px solid ${selected ? 'rgba(140,106,255,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, background: selected ? 'rgba(140,106,255,0.14)' : 'rgba(255,255,255,0.025)', color: 'var(--text-primary)', padding: 10, display: 'grid', gap: 5, cursor: 'pointer' }}>
                                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                  <strong style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{concept.name}</strong>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{concept.dimension}</span>
                                </span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: 11, overflowWrap: 'anywhere' }}>{concept.id}</span>
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{concept.verifiedAssetCount} 个已验证素材 · {concept.childCount} 个子概念</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </Panel>
                  </div>
                  <Panel title="概念详情：统一标签、素材引用与匹配影响" action={knowledgeCatalog?.selectedConcept ? <span style={{ color: statusTone(knowledgeCatalog.selectedConcept.active ? 'approved' : 'rejected'), fontSize: 12, fontWeight: 800 }}>{knowledgeCatalog.selectedConcept.active ? '启用中' : '已停用'}</span> : null}>
                    {knowledgeCatalog?.selectedConcept ? (
                      <div style={{ display: 'grid', gap: 14 }}>
                        <div style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: 12, display: 'grid', gap: 10, background: 'rgba(255,255,255,0.025)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 8 }}>
                            <label style={labelStyle}>概念名称<input value={conceptDraft.name} onChange={(event) => setConceptDraft((current) => ({ ...current, name: event.target.value }))} style={fieldStyle} /></label>
                            <label style={labelStyle}>维度<input value={knowledgeCatalog.selectedConcept.dimension} readOnly style={{ ...fieldStyle, color: 'var(--text-secondary)' }} /></label>
                          </div>
                          <label style={labelStyle}>概念 ID<input value={knowledgeCatalog.selectedConcept.id} readOnly style={{ ...fieldStyle, color: 'var(--text-secondary)' }} /></label>
                          <label style={labelStyle}>说明<textarea value={conceptDraft.description} onChange={(event) => setConceptDraft((current) => ({ ...current, description: event.target.value }))} rows={3} style={fieldStyle} /></label>
                          <label style={labelStyle}>同义词<input value={conceptDraft.synonyms} onChange={(event) => setConceptDraft((current) => ({ ...current, synonyms: event.target.value }))} placeholder="逗号分隔，用于搜索与匹配解释" style={fieldStyle} /></label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800 }}><input type="checkbox" checked={conceptDraft.active} onChange={(event) => setConceptDraft((current) => ({ ...current, active: event.target.checked }))} />启用概念</label>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>父概念：{knowledgeCatalog.selectedConcept.parentId || '无'} · 已验证素材 {knowledgeCatalog.selectedConcept.verifiedAssetCount}</span>
                            <button type="button" onClick={saveKnowledgeConcept} disabled={knowledgeSaving} style={{ minHeight: 36, borderRadius: 7, border: 0, background: 'var(--primary)', color: 'white', fontWeight: 800, padding: '0 12px', cursor: knowledgeSaving ? 'wait' : 'pointer' }}>{knowledgeSaving ? '保存中...' : '保存概念'}</button>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div style={{ display: 'grid', gap: 8 }}>
                            <strong style={{ fontSize: 13 }}>子概念</strong>
                            <div style={{ maxHeight: 220, overflow: 'auto', display: 'grid', gap: 6 }}>
                              {knowledgeCatalog.selectedConcept.children.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>没有子概念。</span>}
                              {knowledgeCatalog.selectedConcept.children.map((child) => (
                                <button key={child.id} type="button" onClick={() => loadKnowledgeCatalog(child.id)} style={{ textAlign: 'left', minHeight: 46, borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)', color: 'var(--text-primary)', padding: '7px 9px', cursor: 'pointer' }}>
                                  <strong style={{ display: 'block', fontSize: 12 }}>{child.name}</strong>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{child.id}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'grid', gap: 8 }}>
                            <strong style={{ fontSize: 13 }}>知识库职责</strong>
                            <div style={{ display: 'grid', gap: 7, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>
                              <span>这里维护概念、说明和同义词。</span>
                              <span>素材文件、授权、QA 仍然只在素材库管理。</span>
                              <span>发现页通过合格内容引用这些语义，不直接创造素材标签。</span>
                            </div>
                          </div>
                        </div>
                        <section style={{ display: 'grid', gap: 8 }}>
                          <strong style={{ fontSize: 13 }}>关联素材</strong>
                          <div style={{ maxHeight: 320, overflow: 'auto', display: 'grid', gap: 7 }}>
                            {knowledgeCatalog.selectedConcept.linkedAssets.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>暂无素材引用这个概念。</span>}
                            {knowledgeCatalog.selectedConcept.linkedAssets.map((asset) => (
                              <div key={`${asset.id}-${asset.source}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 76px 96px minmax(150px,1fr)', gap: 10, alignItems: 'start', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 9 }}>
                                <span style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 12, overflowWrap: 'anywhere' }}>{asset.name}</strong><span style={{ color: 'var(--text-secondary)', fontSize: 11, overflowWrap: 'anywhere' }}>{asset.id}</span></span>
                                <span style={{ fontSize: 12 }}>{asset.category}</span>
                                <span style={{ color: asset.verified ? '#8ee6b0' : '#f0c66a', fontSize: 12, fontWeight: 800 }}>{asset.verified ? '已验证' : '候选'} · {asset.source}</span>
                                <span style={{ color: asset.releaseEligible ? '#8ee6b0' : '#f0c66a', fontSize: 12, lineHeight: 1.35 }}>{asset.releaseEligible ? 'App 可调用' : asset.blockers.slice(0, 2).join('；')}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>选择一个概念后查看详情。</span>
                    )}
                  </Panel>
                </div>
              </div>
            )}

            {activeSection === 'review' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <DemandCoveragePanel coverage={demandCoverage} loading={demandCoverageLoading} error={demandCoverageError} onRefresh={loadDemandCoverage} />
                <DemandProductionReviewPanel
                  review={demandReview}
                  loading={demandReviewLoading}
                  error={demandReviewError}
                  reviewingId={demandReviewingId}
                  releasingId={demandReleasingId}
                  reviewDrafts={demandReviewDrafts}
                  onRefresh={loadDemandReview}
                  onDraftChange={updateDemandReviewDraft}
                  onReview={reviewDemandCandidate}
                  onRelease={releaseDemandCandidate}
                  onOpenDiscover={() => selectAdminSection('discover')}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <Panel title="候选素材生产状态"><CountBars counts={overview.operations.supplyGapCandidatesByStatus} /></Panel>
                    <Panel title="机器 QA / 人工 QA">
                      <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                        <span>渲染 QA：{overview.operations.renderQa.passed}/{overview.operations.renderQa.total} 通过</span>
                        <span>人声 QA：{Object.entries(overview.operations.voiceQaByDecision).map(([k, v]) => `${t(k)} ${v}`).join('，') || '暂无'}</span>
                        <span>发布门槛：授权通过 + 机器 QA 通过 + 人工听感 QA 通过 + 无人声 Beta 约束。</span>
                      </div>
                    </Panel>
                  </div>
                  <Panel title="供给缺口与内容生产队列" action={<Settings2 size={17} />}>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {overview.operations.openSupplyGaps.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>当前没有待处理供给缺口。</p>}
                      {overview.operations.openSupplyGaps.map((gap) => (
                        <div key={gap.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1.3fr) 110px 90px 90px', gap: 12, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                          <span style={{ minWidth: 0 }}><strong style={{ display: 'block' }}>{t(gap.role)}</strong><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t(gap.goal)} / {t(gap.scene)}</span></span>
                          <span style={{ color: statusTone(gap.status), fontSize: 12, fontWeight: 700 }}>{t(gap.status)}</span>
                          <span style={{ fontSize: 12 }}>{gap.requestCount} 次</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDate(gap.updatedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {activeSection === 'analytics' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Panel title="生成 / 保存 / 复听漏斗">
                  <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                    <span>开始生成：{overview.analytics.funnel.quickCreateStarted}</span>
                    <span>配方就绪：{overview.analytics.funnel.recipeReady}（{pct(overview.analytics.funnel.generationSuccessRate)}）</span>
                    <span>开始播放：{overview.analytics.funnel.playbackStarted}</span>
                    <span>接受结果：{overview.analytics.funnel.resultAccepted}（{pct(overview.analytics.funnel.acceptanceRate)}）</span>
                    <span>保存声音：{overview.analytics.funnel.workSaved}（{pct(overview.analytics.funnel.saveRate)}）</span>
                  </div>
                </Panel>
                <Panel title="喜欢 / 排除信号">
                  <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
                    {overview.analytics.preferenceSignals.slice(0, 12).map((signal) => <span key={`${signal.kind}-${signal.value}`}>{t(signal.kind)} · {signal.value}：{signal.count}</span>)}
                  </div>
                </Panel>
                <Panel title="播放事件">
                  <CountBars counts={overview.analytics.playbackEventsByType} />
                </Panel>
              </div>
            )}

            {activeSection === 'system' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
                <Panel title="功能开关">
                  <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                    <span>发布通道：{overview.system.releaseChannel}</span>
                    <span>引导人声：{overview.system.guidedVoiceEnabled ? '开启' : '关闭'}</span>
                    <span>生产环境：{overview.system.production ? '是' : '否'}</span>
                  </div>
                </Panel>
                <Panel title="模型 Provider">
                  <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                    <span>AI 配方：{JSON.stringify(overview.system.providerStatus.aiRecipe)}</span>
                    <span>Lyria：{overview.system.providerStatus.lyriaConfigured ? '已配置' : '未配置'}</span>
                    <span>TTS：{overview.system.providerStatus.ttsConfigured ? '已配置' : '未配置'}</span>
                  </div>
                </Panel>
                <Panel title="额度与环境配置">
                  <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                    <span>通用 API：{overview.system.rateLimits.generalPerMinute}/分钟</span>
                    <span>Quick Create：{overview.system.rateLimits.quickCreatePerMinute}/分钟</span>
                    <span>AI 会话：{overview.system.rateLimits.aiSessionsPerMinute}/分钟</span>
                    <span>音乐生成：{overview.system.rateLimits.musicGenerationPerMinute}/分钟</span>
                    <span>存储驱动：{overview.system.storageDriver}</span>
                    <span>CORS 来源数：{overview.system.corsOriginCount}</span>
                  </div>
                </Panel>
              </div>
            )}

            <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>最后刷新：{formatDate(overview.generatedAt)}。素材批准会执行授权、hash 与 Voice-free Beta 基础门槛校验。</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
