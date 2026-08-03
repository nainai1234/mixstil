# 信息架构与数据模型

> 历史文档，已于 2026-07-14 被
> [ToC Product Development Master Plan](./toc-product-development-master-plan.md)
> 和 [Project Mainline Charter](./project-mainline-charter.md) 替代。当前信息架构以 Home、Create、Player、My Sounds、Explore 和 Profile 的 ToC 路径为准。

## 1. 首版产品结构

首版不要做完整社区，也不要做复杂听众首页。产品应围绕两个高价值入口展开：

- 创作者工作台：负责制作、管理、分享、看数据、申请入库。
- 公开分享页：负责外部传播、试听、收藏、回流创作者主页和采集数据。

平台后台只做最小运营闭环：

- 素材管理。
- 模板管理。
- 入库审核。
- 违规处理。

## 2. 入口地图

```text
未登录访问
  -> 公开分享页
  -> 创作者主页
  -> 登录/注册

创作者登录
  -> 创作者首页
  -> 新建作品
  -> 我的作品库
  -> 作品数据
  -> 分享工具
  -> 入库申请
  -> 订阅升级

平台运营登录
  -> 审核队列
  -> 素材库
  -> 模板库
  -> 违规处理
  -> 精选内容池
```

## 3. 页面清单

### 3.1 未登录/听众侧

#### Public Work Page 公开作品页

目标：让外部流量快速试听，并为创作者带回有效数据。

内容：

- 作品封面。
- 作品标题。
- 创作者头像和昵称。
- 场景标签。
- 播放器。
- 收藏按钮。
- 分享按钮。
- 创作者主页入口。
- 举报入口。
- 平台精选标识。

关键动作：

- 播放。
- 收藏。
- 分享。
- 进入创作者主页。
- 举报。
- 登录/注册。

关键事件：

- page_view。
- play_start。
- play_25。
- play_50。
- play_90。
- favorite。
- share_click。
- creator_profile_click。
- report_click。

付费关联：

- 免费创作者的分享页展示基础样式。
- 付费创作者可使用自定义封面、高级分享页、品牌化主页和外链追踪。

#### Creator Public Profile 创作者公开主页

目标：承接分享页外溢流量，让听众看到创作者更多作品。

内容：

- 头像。
- 昵称。
- 简介。
- 外部链接。
- 公开作品列表。
- 平台精选作品标识。

关键动作：

- 播放作品。
- 收藏作品。
- 分享主页。
- 关注或订阅创作者，后续版本。

首版边界：

- 可以先不做关注。
- 可以先只展示公开作品和精选作品。

#### Lightweight Login 轻登录页

目标：只在必要动作触发登录，减少分享页摩擦。

触发场景：

- 收藏作品。
- 申请成为创作者。
- 查看自己的作品库。
- 查看创作者数据。

首版建议：

- 邮箱验证码。
- Apple/Google 登录可以后置。

### 3.2 创作者侧

#### Creator Home 创作者首页

目标：让创作者知道下一步该做什么。

模块：

- 新建作品入口。
- 最近作品。
- 数据概览。
- 入库进度提醒。
- 付费能力提示。

关键指标：

- 本周播放。
- 本周收藏。
- 本周有效试听。
- 可申请入库作品数。

主按钮：

- Create soundscape。

#### Create Flow Step 1: Scene Picker 场景选择

目标：避免用户从空白开始。

场景：

- 睡前放松。
- 夜醒回睡。
- 情绪安放。
- 冥想呼吸。
- 纯自然声。

内容：

- 场景名称。
- 适合时刻。
- 默认时长。
- 听感描述。

输出：

- selected_scene。

#### Create Flow Step 2: Template Picker 模板选择

目标：用方法论模板保证作品质量下限。

内容：

- 模板名称。
- 预览片段。
- 默认素材组合。
- 推荐时长。
- Free/Plus/Pro 标识。

关键动作：

- 试听模板。
- 选择模板。
- 查看 locked 模板的升级提示。

输出：

- selected_template_id。

#### Create Flow Step 3: Mixer Workbench 混音工作台

目标：完成作品核心编辑。

内容：

- 音轨层列表。
- 每层音量。
- 每层开关。
- 淡入淡出。
- 时长选择。
- 人声引导开关。
- 预览播放器。
- 保存草稿。
- 生成作品。

首版限制：

- Free 最多 3 层。
- Plus 最多 6 层。
- Pro 可解锁更多层数和高级淡入淡出。

关键动作：

- add_layer。
- remove_layer。
- adjust_volume。
- set_duration。
- toggle_voice。
- preview。
- save_draft。
- generate_work。

#### Work Metadata 作品信息页

目标：让作品适合分享，同时做合规控制。

内容：

- 标题。
- 描述。
- 场景标签。
- 封面。
- 是否公开分享。
- 禁止表达提醒。

校验：

- 标题敏感词。
- 描述敏感词。
- 医疗化表达。
- 封面是否存在。

关键动作：

- save_metadata。
- publish_share_page。

#### My Works 我的作品库

目标：管理所有作品状态。

列表字段：

- 封面。
- 标题。
- 状态。
- 时长。
- 播放量。
- 收藏数。
- 50% 完播率。
- 入库进度。
- 最近更新时间。

筛选：

- Draft。
- Private。
- Shared。
- Reviewable。
- Submitted。
- Featured。
- Rejected。
- Hidden。

关键动作：

- 试听。
- 编辑。
- 复制。
- 删除。
- 查看数据。
- 分享。
- 申请入库。

#### Work Analytics 作品数据页

目标：让创作者理解作品表现，并形成付费动力。

基础数据：

- 访问量。
- 播放开始数。
- 50% 完播数。
- 90% 完播数。
- 收藏数。
- 分享点击数。

付费数据：

- 来源渠道。
- 完播漏斗。
- 同类作品 benchmark。
- 周报。
- 外链追踪。

入库进度：

- 试听门槛。
- 收藏门槛。
- 完播率门槛。
- 举报状态。
- 标题/描述合规状态。

关键文案：

> 还差 42 次有效试听和 3 个收藏，就可以申请平台精选审核。

#### Share Tools 分享工具页

目标：把“作品做好”转成“作品发出去”。

免费能力：

- 复制公开链接。
- 系统分享。

Plus/Pro 能力：

- 二维码海报。
- 自定义封面。
- 15 秒试听短视频。
- 外链追踪参数。
- 高级分享页样式。

关键动作：

- copy_link。
- download_qr_poster。
- generate_preview_video。
- create_tracking_link。

#### Billing Upgrade 订阅升级页

目标：围绕创作者痛点展示升级，而不是泛泛卖会员。

分区：

- 做得更好听：高级素材、模板、混音、时长。
- 发得更专业：封面、海报、分享页、短视频。
- 看得更明白：完播、来源、benchmark、周报。
- 经营得更正式：主页、系列、更多作品空间。

首版可先做 locked 状态和方案页，不一定接真实支付。

### 3.3 平台运营侧

#### Review Queue 入库审核队列

目标：人工筛选符合平台标准的作品。

字段：

- 作品。
- 创作者。
- 试听数。
- 收藏数。
- 50% 完播率。
- 举报数。
- 合规风险。
- 申请时间。

动作：

- 试听。
- 通过精选。
- 拒绝。
- 要求修改。
- 隐藏。

拒绝原因：

- 质量不足。
- 标题/描述不合规。
- 素材风险。
- 数据异常。
- 场景不匹配。

#### Asset Library 素材库管理

目标：控制素材授权和可用范围。

字段：

- 素材名称。
- 类型。
- 文件。
- 授权来源。
- 是否可商用。
- 是否可二创。
- 是否可用于公开分享。
- 是否可用于付费作品。
- Free/Plus/Pro 权限。
- 场景标签。
- 情绪标签。

#### Template Library 模板库管理

目标：管理创作方法论。

字段：

- 模板名称。
- 场景。
- 默认素材组合。
- 默认时长。
- 层级结构。
- 人声设置。
- Free/Plus/Pro 权限。
- 禁止表达提醒。

#### Moderation 违规处理

目标：满足 UGC 安全和平台质量要求。

处理对象：

- 作品标题。
- 作品描述。
- 作品封面。
- 创作者主页。
- 举报记录。

动作：

- 标记安全。
- 要求修改。
- 隐藏作品。
- 封禁创作者。

## 4. 核心导航

### 创作者端导航

```text
Home
Create
Works
Analytics
Profile
Upgrade
```

首版建议：

- 底部或侧边导航保留 Home、Create、Works、Profile。
- Analytics 从作品详情进入，不必首版做全局大屏。
- Upgrade 可以从 locked 能力和账号页进入。

### 听众侧导航

首版不需要完整导航。

分享页只保留：

- 播放。
- 收藏。
- 分享。
- 创作者主页。

### 平台端导航

```text
Review
Assets
Templates
Featured
Moderation
```

## 5. 状态流转

### 5.1 Work 状态

```text
Draft
  -> Private
  -> Shared
  -> Reviewable
  -> Submitted
  -> Featured

Submitted
  -> Rejected
  -> Hidden

Shared
  -> Hidden
```

状态说明：

- Draft：还在编辑，未生成完整作品。
- Private：已生成，只自己可见。
- Shared：生成公开分享页。
- Reviewable：达到入库申请门槛。
- Submitted：创作者已申请审核。
- Featured：平台精选。
- Rejected：审核未通过，可修改后重新申请。
- Hidden：违规或版权风险，被平台隐藏。

### 5.2 Subscription 状态

```text
Free
  -> Plus
  -> Pro
```

能力差异：

- Free：完成基础制作和分享。
- Plus：更适合持续发布。
- Pro：更适合经营个人声音品牌。

### 5.3 Review 状态

```text
Not eligible
  -> Eligible
  -> Submitted
  -> Approved
  -> Rejected
  -> Revision requested
```

审核原则：

- 数据达标只代表 Eligible。
- Featured 必须人工 Approved。
- 付费用户可以有更快排队，不可以买通过结果。

## 6. 首版数据模型

### 6.1 User

```ts
type User = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: "listener" | "creator" | "admin";
  subscriptionTier: "free" | "plus" | "pro";
  createdAt: string;
};
```

### 6.2 CreatorProfile

```ts
type CreatorProfile = {
  id: string;
  userId: string;
  slug: string;
  bio?: string;
  externalLinks: Array<{
    label: string;
    url: string;
  }>;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### 6.3 SoundAsset

```ts
type SoundAsset = {
  id: string;
  name: string;
  type: "nature" | "ambient" | "rhythm" | "bell" | "voice" | "noise";
  fileUrl: string;
  licenseStatus: "verified" | "needs_review" | "blocked";
  commercialUse: boolean;
  derivativeUse: boolean;
  publicShareUse: boolean;
  paidWorkUse: boolean;
  tier: "free" | "plus" | "pro";
  sceneTags: string[];
  moodTags: string[];
  recommendedVolumeMin: number;
  recommendedVolumeMax: number;
  createdAt: string;
};
```

### 6.4 SoundTemplate

```ts
type SoundTemplate = {
  id: string;
  name: string;
  scene: "sleep" | "wake_back_to_sleep" | "emotional_settling" | "breathing" | "pure_nature";
  description: string;
  defaultDurationMinutes: number;
  tier: "free" | "plus" | "pro";
  defaultLayers: Array<{
    assetId: string;
    volume: number;
    fadeInSeconds: number;
    fadeOutSeconds: number;
  }>;
  voiceGuidanceDefault: boolean;
  forbiddenClaims: string[];
  createdAt: string;
};
```

### 6.5 Work

```ts
type Work = {
  id: string;
  creatorId: string;
  templateId: string;
  title: string;
  description?: string;
  coverUrl?: string;
  audioUrl?: string;
  durationSeconds: number;
  sceneTags: string[];
  status: "draft" | "private" | "shared" | "reviewable" | "submitted" | "featured" | "rejected" | "hidden";
  shareSlug?: string;
  layers: Array<{
    assetId: string;
    volume: number;
    fadeInSeconds: number;
    fadeOutSeconds: number;
  }>;
  voiceGuidanceEnabled: boolean;
  complianceStatus: "unchecked" | "passed" | "flagged" | "blocked";
  createdAt: string;
  updatedAt: string;
};
```

### 6.6 WorkMetrics

```ts
type WorkMetrics = {
  workId: string;
  pageViews: number;
  playStarts: number;
  play25: number;
  play50: number;
  play90: number;
  favorites: number;
  shareClicks: number;
  reports: number;
  uniqueVisitors: number;
  topReferrers?: Array<{
    source: string;
    count: number;
  }>;
  updatedAt: string;
};
```

### 6.7 ReviewApplication

```ts
type ReviewApplication = {
  id: string;
  workId: string;
  creatorId: string;
  status: "not_eligible" | "eligible" | "submitted" | "approved" | "rejected" | "revision_requested";
  submittedAt?: string;
  reviewedAt?: string;
  reviewerId?: string;
  rejectionReason?: string;
  revisionNote?: string;
};
```

### 6.8 AnalyticsEvent

```ts
type AnalyticsEvent = {
  id: string;
  workId: string;
  visitorId: string;
  userId?: string;
  event:
    | "page_view"
    | "play_start"
    | "play_25"
    | "play_50"
    | "play_90"
    | "favorite"
    | "share_click"
    | "creator_profile_click"
    | "report_click";
  referrer?: string;
  createdAt: string;
};
```

## 7. 权限与限制

### Free

- 最多 5 个作品。
- 单个作品最长 10 分钟。
- 最多 3 个音轨层。
- 基础模板。
- 基础素材。
- 基础分享页。
- 只展示基础播放数据。

### Plus

- 更多作品空间。
- 单个作品最长 30 分钟。
- 最多 6 个音轨层。
- Plus 素材和模板。
- 自定义封面。
- 二维码海报。
- 基础完播数据。

### Pro

- 更大作品空间。
- 单个作品最长 60 分钟或更长。
- 更多音轨层。
- Pro 素材和模板。
- 高级混音。
- 人声模板包。
- 外链追踪。
- 周报。
- 高级创作者主页。
- 系列管理。

## 8. 原型优先级

### P0 必须原型

- 创作者首页。
- 场景选择。
- 模板选择。
- 混音工作台。
- 作品信息页。
- 我的作品库。
- 公开作品页。
- 作品数据页。
- 分享工具页。
- 订阅升级页。

### P1 可后置

- 创作者公开主页。
- 平台审核队列。
- 素材库管理。
- 模板库管理。

### P2 暂不做

- 听众首页。
- 内容市场。
- 评论。
- 私信。
- 打赏。
- 提现。
- 创作者分成。

## 9. 首版验收标准

- 创作者能从场景选择开始，在 3 分钟内生成一首作品。
- 免费用户可以完成制作、保存、分享。
- Locked 能力能清楚对应到 Plus/Pro 付费价值。
- 公开分享页不登录也能播放。
- 收藏时触发轻登录。
- 数据页能展示播放、收藏、50% 完播和入库进度。
- 入库申请只在达到门槛后可用。
- 平台精选状态不会自动出现，必须经过审核状态。
- 标题和描述出现医疗化表达时能被拦截或提示修改。
