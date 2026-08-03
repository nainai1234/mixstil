# 个性化音频智能架构 V3

日期：2026-07-13  
状态：Phase 0/1 自动基线已实施，人工复核待完成  
适用项目：SNOOZE / sleep-audio

实施进度见：[Content Intelligence V3 Phase 0/1 Baseline](./content-intelligence-v3-phase-0-1-baseline.md)。

执行优先级修订：当前规模下，大模型负责把自然语言转换为结构化检索条件；本地素材标注、硬约束和匹配器负责选择真实素材。CLAP、PANNs、向量召回和复杂人工语义规则均后置。执行规范见：[素材标注与匹配规范 V1](./asset-labeling-and-matching-standard-v1.md)。

## 1. 结论

当前 Recipe V2 已经解决了“同一配方可实时播放、可冻结、可复现、可渲染”的工程主干，但尚未解决“为什么这个配方真正符合这句话”的智能问题。

当前前台真实路径是：

```text
正则规则解析 AudioIntent V2
  -> 从 17 个固定 Recipe 中按 goal / scene / mode 过滤
  -> 用 Recipe 名称和 moodTags 匹配少量环境偏好
  -> 用 Prompt 哈希确定性选择
  -> 做排除项和目标契约校验
```

项目虽然存在 `server/aiRecipe.ts`，可调用 DeepSeek 或 OpenAI 把 Prompt 分类成少量 `goal + environment` 字段，但 `/api/quick-create` 当前没有调用它。用户实际使用的 Quick Create 仍由 `server/audioIntentV2.ts` 的规则解析完成。因此，现状不能描述成“大模型已经精准理解需求”，也不能描述成“AI 根据描述生成了全新的声音”。准确说法是：

> 当前系统是规则驱动的意图解析、固定配方选择和已审核素材混音。

V3 不应推翻 Recipe V2，而应在其前面建立“需求智能层”和“供给智能层”，让 Recipe V2 成为最终可复现的执行计划。

```text
需求端：自然语言 -> AudioIntent V3 -> 约束与置信度
                                      |
                                      v
供给端：受控本体 + 音频语义向量 + 声学特征 + 兼容关系
                                      |
                                      v
决策端：多路召回 -> 硬约束 -> 精排 -> 组合求解 -> 时间编排
                                      |
                                      v
执行端：Recipe V2/V3 -> Live Mix -> 冻结 -> 渲染 -> 分享
```

系统必须显式区分两类失败：

1. **理解失败**：系统没有正确理解用户想要什么。
2. **供给失败**：系统理解了，但库存没有合适素材或有效组合。

不能再用一个不相关的默认 Recipe 掩盖任何一种失败。

## 2. 调研依据与产品判断

### 2.1 标签、本体和语义向量必须并存

Google AudioSet 将声音事件组织成分层本体，覆盖 Human sounds、Vehicle、Domestic sounds、Music、Natural sounds、Acoustic environment 和 Noise 等类别。这说明“雨、海浪、森林”这种扁平自由标签不足以表达声音资源。

CLAP 使用文本编码器和音频编码器，将自然语言描述和音频映射到同一向量空间，可用于零样本文本到音频检索。它适合回答“这段声音听起来是否接近用户的描述”，但不能替代授权、排除项、角色、响度和兼容性等确定性规则。

PANNs 等基于 AudioSet 的预训练模型可以做音频自动标注、声学场景分类和声音事件识别，适合作为新素材的机器初标。它们的输出是候选标签和置信度，不应直接把素材晋升为 `approved`。

因此，供给端必须同时保留：

- 受控本体：用于硬约束、分析、解释和覆盖统计。
- 文本与音频 Embedding：用于长尾语义召回。
- 声学特征：用于响度、频谱、事件密度和疲劳风险判断。
- 人工审核事实：用于内容真实性、听感、授权和负面联想确认。

### 2.2 推荐不是一次匹配，而是多阶段决策

Google 推荐系统资料将候选生成定义为推荐流程第一阶段：先在共同嵌入空间中找到与查询相近的候选，再进行后续排序。SNOOZE 应采用同样的分层思想：

```text
多路召回
  -> 硬约束过滤
  -> 单素材精排
  -> 组合兼容性求解
  -> 时间结构编排
  -> 结果契约验证
```

Embedding 相似度只能决定“值得进入候选池”，不能直接决定最终混音。否则很容易把两个各自相关、叠在一起却冲突的素材同时选中。

### 2.3 竞品证明“供给深度 + 结构控制”比随机组合重要

- BetterSleep 公开描述超过 300 个声音，允许叠加素材并独立控制音量，同时提供预制和智能 Mix。它用供给深度和用户控制降低匹配失败。
- Endel 公开描述其声景可根据时间、天气、心率和位置实时调整，并区分实时生成声景与非个性化流媒体内容。其核心是持续参数化变化，而不是每次随机拼接完整音频。
- AudioSet、CLAP 和 PANNs 共同指向一个更适合本项目的策略：受控分类保证边界，语义检索处理开放描述，声学模型辅助治理，行为数据负责长期排序。

竞品规模不是要求我们立刻采购 300 条素材。正确结论是：必须先定义覆盖矩阵，再围绕真实缺口扩充；素材数量要服务于“每个核心需求都有多个有效候选和组合”，不能服务于一个好看的总数。

## 3. 总体架构

### 3.1 六个核心层

| 层 | 职责 | 主要产物 |
| --- | --- | --- |
| 需求理解层 | 把开放描述转换为可校验需求 | AudioIntent V3 |
| 供给知识层 | 描述每个素材真实是什么、能做什么 | Stem Metadata V3、Ontology、Embedding |
| 检索决策层 | 找候选、过滤禁忌、排序、求解组合 | Candidate Set、Selection Trace |
| 内容导演层 | 把组合变成有阶段和动态的作品 | Recipe V2/V3 |
| 能力路由层 | 库存不足时采购、合成或生成 | Supply Gap Job、Generated Candidates |
| 反馈学习层 | 用真实接受和修改行为改善排序 | Preference Profile、Coverage Report |

### 3.2 不可变边界

- LLM 只输出结构化意图候选，不能直接选择文件 URL、修改授权状态或绕过排除项。
- Embedding 只参与召回和语义评分，不能绕过 `qa_status = approved`。
- 未审核生成内容不能直接进入用户公开作品。
- 排除项、权利、目标场景、听力安全和明确偏好属于硬约束。
- Recipe 仍是 Live Mix、冻结版本和最终渲染的唯一执行事实。
- 没有满足硬约束的结果时必须返回“供给缺口”，不能偷偷换成雨声或海浪。

## 4. 需求端：AudioIntent V3

### 4.1 为什么不能只让 LLM 输出几个标签

用户描述同时包含目标、场景、声音偏好、排除项、时间结构、强弱关系、个人敏感项和不确定信息。例如：

> 我刚下班，脑子停不下来。不要水声，先用安静室内底噪稳定下来，音乐五分钟后再进入，20 分钟，不要人声。

它不能被压缩成 `goal=sleep, environment=auto`。AudioIntent V3 必须保留可执行约束和证据：

```ts
type AudioIntentV3 = {
  schemaVersion: 3;
  requestId: string;
  rawPrompt: string;
  locale: string;
  goal: 'sleep' | 'calm' | 'focus';
  scene: 'bedtime' | 'return_to_sleep' | 'breathing' |
    'emotional_settling' | 'deep_focus';
  desiredOutcome: string[];
  contentMode: 'pure_soundscape' | 'functional_music' |
    'sound_journey' | 'guided_meditation';
  durationSeconds: number;
  include: Array<{
    conceptId: string;
    strength: 'required' | 'preferred';
    evidenceText: string;
  }>;
  exclude: Array<{
    conceptId: string;
    scope: 'exact' | 'family';
    evidenceText: string;
  }>;
  sensoryProfile: {
    brightness: number;
    warmth: number;
    density: number;
    eventfulness: number;
    spaciousness: number;
    predictability: number;
  };
  narrativeArc: Array<{
    phase: 'arrival' | 'settling' | 'core' | 'release';
    desiredRoles: string[];
    change: 'enter' | 'rise' | 'hold' | 'fall' | 'exit';
    relativeStart: number;
  }>;
  voice: {
    enabled: boolean;
    language?: 'zh' | 'en';
    density?: 'light' | 'standard' | 'frequent';
  };
  context: {
    device?: 'speaker' | 'headphones' | 'unknown';
    externalNoise?: 'quiet' | 'variable' | 'loud' | 'unknown';
    sensitivity?: string[];
  };
  clarificationNeeded: boolean;
  confidence: number;
  fieldConfidence: Record<string, number>;
};
```

### 4.2 LLM 与规则的正确分工

需求理解使用“双通道 + 校验器”，不是只信一次模型输出：

```text
原始 Prompt
  |-> LLM：按 JSON Schema 提取完整语义、证据和置信度
  |-> 规则：提取否定词、数量、时长、语言、明确声音名
  -> 合并器
  -> 本体映射
  -> 矛盾检测
  -> AudioIntent V3
```

规则优先级：

1. 明确排除项高于所有模型推断和默认值。
2. 用户文字中明确目标高于界面遗留默认目标。
3. 明确要求高于推测偏好。
4. 不确定字段保持 `unknown`，不能随意补成雨、海浪或森林。
5. LLM 输出必须通过 JSON Schema、枚举、本体 ID、范围和跨字段一致性校验。

### 4.3 什么时候需要澄清

首版尽量立即给结果，但以下情况不应强行猜测：

- 同时说“不要音乐”和“希望钢琴慢慢进入”。
- 指定了系统不存在且无法映射的核心声音。
- 目标与结构存在明显冲突，且会导致完全不同的作品。
- 关键字段置信度低于阈值，同时没有可靠默认策略。

普通缺省不需要询问。例如只说“让我安静下来”时，可以返回低刺激、无人声、低事件密度的安全默认结果，并把假设展示在结果摘要中。

### 4.4 意图校对与评估集

建立至少 200 条中英文 Gold Set，覆盖：

- 明确目标和场景。
- 多声音偏好。
- 否定、双重否定和反转。
- “先 A 后 B”的阶段结构。
- 水声、鸟鸣、火焰、交通工具等敏感项。
- 没有声音词、只有情绪和生活语境的描述。
- 口语、错别字和语音输入转写错误。

验收指标：

- 排除项召回率 >= 99%。
- 明确声音要求召回率 >= 95%。
- goal / scene 准确率 >= 95%。
- 阶段顺序准确率 >= 90%。
- 无依据新增具体环境声的比例 <= 1%。
- LLM 不可用时，规则降级能正确处理全部高风险排除项。

## 5. 供给端：Stem Metadata V3

### 5.1 受控标签本体

不再允许核心检索依赖任意字符串标签。建立带稳定 ID、父子关系、同义词和互斥关系的本体：

| 维度 | 示例 |
| --- | --- |
| source_event | `natural.water.rain.light`、`vehicle.rail.carriage`、`domestic.hvac.fan` |
| role | `base.masking`、`environment.scene`、`music.bed`、`accent.event`、`voice.guide` |
| goal_fit | `sleep.bedtime`、`calm.settling`、`focus.deep_work` |
| acoustic | `low_brightness`、`low_event_density`、`steady`、`wide_space` |
| affect | `warm`、`safe`、`neutral`、`melancholic`、`tense` |
| temporal | `seamless_loop`、`crossfade_loop`、`one_shot`、`evolving` |
| risk | `sudden_peak`、`fatigue_high`、`urination_association`、`attention_capture` |
| provenance | `field_recording`、`synthesized`、`generated`、`tts` |

“water”是家族节点；用户说“不要水声”时，默认排除 rain、ocean、river、stream、waterfall 和 water drop。用户说“不要海浪但可以下雨”时，只排除 ocean/waves 分支。

### 5.2 数据结构

```ts
type StemMetadataV3 = {
  stemId: string;
  metadataVersion: 3;
  sourceEvents: Array<{ conceptId: string; confidence: number; verified: boolean }>;
  semanticDescriptions: string[];
  roles: string[];
  goalFit: Array<{ goal: string; scene: string; score: number; verified: boolean }>;
  acoustic: {
    integratedLufs: number;
    truePeakDbtp: number;
    spectralCentroid: number;
    lowMidHighBalance: [number, number, number];
    eventDensity: number;
    transientRate: number;
    dynamicRange: number;
    brightness: number;
    roughness?: number;
  };
  temporal: {
    loopMode: 'seamless' | 'crossfade' | 'one_shot' | 'not_loopable';
    sourceDurationSeconds: number;
    safeLoopMinSeconds?: number;
    recommendedPhase: string[];
  };
  mix: {
    recommendedGainDb: [number, number];
    maxConcurrentForegrounds: number;
    frequencyRole: 'low' | 'mid' | 'high' | 'full';
  };
  risks: Array<{ riskId: string; severity: number; evidence: string }>;
  rights: {
    qaStatus: 'candidate' | 'needs_review' | 'approved' | 'rejected';
    commercialUse: boolean;
    derivativeUse: boolean;
    publicShare: boolean;
    licenseSnapshotId: string;
  };
  embeddings: {
    audioModel: string;
    audioVectorId: string;
    textModel: string;
    textVectorId: string;
  };
  review: {
    machineTaggedAt?: string;
    contentVerifiedAt?: string;
    listeningQaAt?: string;
    reviewerIds: string[];
  };
};
```

### 5.3 自动标注和人工确认

新素材进入系统后的治理顺序：

```text
文件与授权入库
  -> 解码、哈希、响度、峰值、静音、循环技术 QA
  -> PANNs/AudioSet 分类候选
  -> CLAP 文本-音频语义标签候选
  -> 声学特征提取
  -> 人工确认“它实际上是什么声音”
  -> 人工听感确认角色、风险和疲劳
  -> approved
```

机器标签必须记录模型版本、置信度和生成时间。人工确认不能覆盖原始机器结果，而应形成独立的 `verified` 状态，方便以后重新跑模型和比较漂移。

### 5.4 兼容性图

单个素材合格不等于组合合格。建立素材家族和具体素材两级关系：

```ts
type CompatibilityEdge = {
  leftId: string;
  rightId: string;
  relation: 'preferred' | 'allowed' | 'conditional' | 'avoid' | 'forbidden';
  score: number;
  conditions?: {
    maxCombinedGainDb?: number;
    allowedPhases?: string[];
    requiresDucking?: boolean;
  };
  evidence: 'editorial' | 'listening_test' | 'behavioral';
};
```

例如：

- 强海浪 + 前景钢琴：`conditional`，只能在海浪退到背景且音乐进入核心阶段时使用。
- 密集鸟鸣 + 深度专注：`avoid`，除非用户明确要求。
- 火焰爆裂 + 睡眠核心阶段：`forbidden` 或限制事件密度。
- 列车低频底噪 + 柔粉噪：`preferred`，但需要总低频能量上限。

## 6. 检索、约束、排序与编排

### 6.1 多路召回

对每个所需角色分别召回候选，而不是召回完整固定 Recipe：

1. **本体召回**：按 source event、role、goal_fit 和 phase 精确召回。
2. **语义召回**：用用户描述或阶段描述查询 CLAP 音频向量。
3. **编辑召回**：召回专家验证过的高质量组合和模板。
4. **用户召回**：召回该用户曾接受、收藏或保留的声音家族。
5. **探索召回**：从合格长尾候选中保留少量可控探索位。

召回池可以是 30-100 个 Stem，但必须在下一步严格过滤。

### 6.2 硬约束过滤

任何一项不满足就淘汰：

- `qa_status = approved`。
- 商用、二创和分享权满足目标用途。
- 不命中用户排除项及其本体子节点。
- 能承担目标角色和阶段。
- 时长与循环方式可支持目标作品。
- 不命中听力安全、场景禁用或素材级禁用。
- 明确 required 偏好至少有一个候选命中，否则进入供给缺口。

### 6.3 单素材精排

建议初始分数：

```text
score(stem) =
  0.25 * semantic_similarity
  + 0.20 * explicit_preference_match
  + 0.15 * goal_scene_fit
  + 0.10 * acoustic_fit
  + 0.10 * phase_role_fit
  + 0.10 * user_preference
  + 0.05 * editorial_quality
  + 0.05 * controlled_exploration
  - risk_penalty
  - repetition_penalty
```

权重必须通过离线 Gold Set 和真实首次接受率校准，不应长期写死。

### 6.4 组合求解

从高分候选中选择 1-4 层，优化的是整个组合：

```text
maximize:
  单素材相关性
  + 角色覆盖
  + 组合兼容性
  + 阶段连贯性
  + 用户新鲜感

subject to:
  排除项
  授权
  频谱占用上限
  前景层数量上限
  事件密度上限
  目标响度和峰值
  阶段结构
```

首版不需要复杂机器学习求解器。可以用有限候选的 Beam Search 或约束枚举，保留分数和淘汰理由。重点是“先选角色和关系，再生成 Recipe”，而不是随机拿三个素材。

### 6.5 时间导演层

组合确定后，Recipe 导演根据 AudioIntent 的 `narrativeArc` 编排：

- arrival：建立安全、低刺激的底层。
- settling：逐步减少事件或引入稳定元素。
- core：目标主体出现，其他层自动避让。
- release：音乐、人声或环境按目标退出或保持。

同一素材在不同阶段可以改变角色。系统不应规定永久主角和配角，而应记录每个阶段的 `prominence`、自动化曲线和 Ducking 关系。

### 6.6 结果契约和解释轨迹

每次生成保存 Selection Trace：

```ts
type SelectionTrace = {
  intentVersion: string;
  ontologyVersion: string;
  embeddingModelVersion: string;
  candidates: Array<{ stemId: string; source: string; scores: Record<string, number> }>;
  rejected: Array<{ stemId: string; reasons: string[] }>;
  selected: Array<{ stemId: string; role: string; reasons: string[] }>;
  unmetRequirements: string[];
  recipeId: string;
  seed: number;
};
```

这使错误可回答为“意图理解错了”“库存没有”“候选被标签漏掉”“排序不合理”或“组合关系错误”，而不是继续凭听感猜。

## 7. 素材量、覆盖率和无效组合

### 7.1 素材够不够不能看总数

定义 Coverage Matrix：

```text
目标/场景
  x 内容模式
  x 核心声音家族
  x 感官特征
  x 阶段角色
  x 语言/人声
```

每个首发需求单元至少需要：

- 3 个通过审核的单素材候选。
- 2 个经过集合试听的有效组合。
- 1 个不依赖自然水声的可靠组合。
- 1 个低事件密度、低刺激的安全降级组合。

如果一个单元只靠同一条音乐换音量，不算覆盖；如果候选很多但都来自同一声音家族，也不算多样性。

### 7.2 无效组合的定义

以下任何情况都属于无效组合：

- 忽略明确偏好或包含排除项。
- 两个前景素材长期竞争注意力。
- 频谱、事件密度或动态冲突。
- 场景逻辑不成立，例如强海浪和近距离钢琴同时占前景。
- 单条都合格，但叠加后响度、疲劳或突发事件超标。
- 只是换标题，实际 Stem 和时间结构高度相同。

无效组合不得因为“能播放”而返回给用户。

### 7.3 多样性约束

同一用户连续生成时加入：

- 最近 N 次核心 Stem 重复惩罚。
- 声音家族重复惩罚。
- 时间弧和音乐进入方式的重复惩罚。
- 在满足硬约束前提下保留 5%-10% 探索流量。

个性化不等于每次随机。相同 Prompt + 相同用户偏好 + 相同版本 + 相同 seed 必须可复现；用户选择“换一个方向”时才改变 seed 和探索策略。

## 8. 供给缺口与生成路由

### 8.1 缺口判定

以下任一成立即创建 Supply Gap：

- required 概念硬约束后候选数为 0。
- 候选数少于覆盖阈值。
- 最高组合分低于上线阈值。
- 近 30 天同类请求失败或被移除的次数超过阈值。
- 用户频繁要求替换某个声音家族，但没有替代品。

缺口记录必须包含原始请求、本体节点、角色、声学目标、目标阶段、预计复用次数和当前替代方案，便于按商业价值排序。

### 8.2 能力路由顺序

```text
1. 已审核库存检索
2. 同家族参数化合成（噪声、风扇、简单 Drone）
3. 已购/已录候选库导入
4. 本地生成模型批量产候选
5. 外部 API 批量产候选
6. 暂不支持并记录缺口
```

外部 API 不是前台失败后的即时随机兜底。对公共素材，应在后台一次生成多个候选，审核通过后复用。只有未来 Pro 的明确实时生成能力，才允许把生成成本与等待时间计入单次请求，并仍需通过自动门槛。

ElevenLabs Sound Effects 官方文档支持自然语言、时长、循环和 Prompt influence 控制，适合生成 30 秒级环境或特殊音效候选；这类能力应作为 Provider Adapter，而不是写死到 Recipe 引擎。

### 8.3 生成请求结构

```ts
type SupplyGenerationSpec = {
  targetConceptIds: string[];
  semanticDescription: string;
  role: string;
  durationSeconds: number;
  loopRequired: boolean;
  acousticTargets: {
    brightness: [number, number];
    eventDensity: [number, number];
    dynamicRange: [number, number];
  };
  forbiddenConceptIds: string[];
  phaseFit: string[];
  candidateCount: number;
  providerPolicy: string;
};
```

### 8.4 生成后验证

生成成功不等于素材合格。每个候选依次经过：

1. 文件、时长、采样率、静音、削波和 True Peak 检查。
2. PANNs/AudioSet 事件分类，检查是否出现禁止事件。
3. CLAP 相似度：目标描述应高于阈值，禁止描述应低于阈值。
4. 循环接缝、事件密度、频谱和响度测量。
5. 与目标角色的混音测试，而不是只听 Solo。
6. 人工内容确认、听感 QA、疲劳 QA 和授权确认。
7. 通过后才进入 `approved`，并记录模型、Prompt、seed、成本和许可快照。

生成候选验证要同时防止两类错误：

- “标签说是壁炉，实际听起来像水或风”。
- “单独像目标，循环或混音后不适合长期疗愈场景”。

## 9. 用户反馈与学习闭环

### 9.1 反馈要定位到决策层

结果页收集的操作应转成结构化信号：

| 用户行为 | 系统含义 |
| --- | --- |
| 符合我的需要 | 整体组合正反馈 |
| 去掉水声 | 对 water 家族强负反馈，并检查意图解析是否漏掉原排除项 |
| 音乐晚一点进入 | 时间导演层反馈，不应替换 Stem |
| 换一个方向 | 对当前组合负反馈，但不等于所有组成素材都差 |
| 保存/复听/分享 | 高价值结果信号 |
| 10 秒内停止 | 弱负反馈，需要结合音量和设备判断 |

### 9.2 三种模型分别学习

- 意图模型：从人工纠正后的 AudioIntent 学习。
- 排序模型：从接受、替换、保存、复听学习候选权重。
- 用户偏好模型：学习声音家族、亮度、事件密度和内容模式偏好。

不能直接让播放次数高的素材统治结果。需要控制位置偏差、默认曝光和热门偏差，并保留探索流量。

### 9.3 主线指标

新增智能层后仍以产品结果为准：

1. Quick Create 到首播成功率和 P95 耗时。
2. 首次结果接受率。
3. 明确偏好满足率和排除项违规率。
4. 局部修改后保存率。
5. 同一用户连续结果的有效多样性。
6. 供给缺口率和缺口解决复用率。
7. 单个被保存作品的计算、生成和 QA 成本。

## 10. 当前代码的保留、改造与替换

### 10.1 保留

- Recipe V2 Schema、阶段、角色、Fade、Loop、Ducking、Events 和 seed。
- Live Mix 与 ffmpeg 共用 Recipe 语义。
- 冻结版本、渲染、保存、分享和 QA 门槛。
- `qa_status`、授权字段、文件哈希和审核流程。
- 当前规则解析中的高价值否定词和明确目标规则，作为 V3 校验器与降级路径。

### 10.2 改造

- `server/audioIntentV2.ts`：升级为 LLM 结构化提取 + 规则校验的 AudioIntent V3 服务。
- `audio_stems.tags`：保留兼容读取，但核心检索迁移到受控本体关系表。
- `server/contentCatalog.ts`：从固定最终答案改为专家模板和回归测试基线。
- `selectRecipe`：替换为多路召回、硬约束、精排、组合求解和导演层。
- `assertRecipeMatchesIntent`：扩展为独立的结果契约验证器，并输出可观测失败原因。
- `/api/quick-create`：调用 V3 意图服务并保存 Selection Trace。

### 10.3 停止作为主路径

- 只按 Recipe 名称和自由 `moodTags` 做偏好匹配。
- 从 17 个完整固定 Recipe 中随机或哈希选一个作为个性化。
- 没有匹配时跨意图返回第一个默认 Recipe。
- 把 `server/aiRecipe.ts` 的三字段分类称为完整 AI 理解。
- 把生成后的文件未经语义和混音 QA 直接放给用户。

## 11. 数据库迁移建议

新增核心表：

- `audio_concepts`：本体节点、父节点、同义词和版本。
- `stem_concepts`：素材与概念、置信度、来源、人工确认状态。
- `stem_acoustic_features`：声学测量和模型版本。
- `stem_embeddings`：模型、向量存储 ID、生成时间。
- `stem_compatibility_edges`：兼容与冲突关系。
- `intent_records`：原始 Prompt、AudioIntent V3、模型和校验结果。
- `selection_traces`：候选、分数、淘汰原因和最终选择。
- `supply_gaps`：缺口、频次、价值、状态和解决资产。
- `asset_generation_jobs`：Provider、Prompt、seed、候选、成本和许可。

向量可先用 PostgreSQL `pgvector`，避免过早引入独立向量数据库。核心素材量在万级以前足够支持迭代和审计。

## 12. 分阶段执行方案

### Phase 0：建立真相基线，2-3 天

- 冻结当前 17 Recipe 和 28 个核心 Stem 作为回归集。
- 导出当前 approved / needs_review / rejected 库存和自由标签。
- 建立 200 条 Gold Prompt 与期望 AudioIntent。
- 记录当前首次结果接受、明确偏好命中和排除项违规基线。

验收：每个已知失败都能归类为理解、标签、库存、排序、组合或渲染问题。

### Phase 1：本体与 Metadata V3，4-7 天

- 创建受控本体和数据库表。
- 将 28 个核心 Stem 人工精标到 V3。
- 自动提取声学特征并补兼容关系。
- 建立 Coverage Matrix 和真实缺口榜单。

验收：核心 Stem 不再依赖自由标签做主检索；水声家族排除、列车、室内底噪等请求可准确查到或明确报告缺口。

### Phase 2：AudioIntent V3，4-6 天

- 接入可替换 LLM Adapter，使用严格结构化输出。
- 建立规则校验、矛盾检测、置信度和降级。
- 在 Gold Set 上回归。

验收：达到第 4.4 节指标；日志能证明每次是否真实调用 LLM、使用哪个模型、是否降级。

### Phase 3：召回、约束与排序，5-8 天

- 为核心 Stem 生成 CLAP Embedding。
- 实现本体、语义、编辑和用户偏好多路召回。
- 实现硬约束、可解释精排和 Selection Trace。

验收：明确请求不会被不相关默认 Recipe 覆盖；没有库存时返回 Supply Gap；离线 Recall@10 和约束通过率达到门槛。

### Phase 4：组合求解和时间导演，5-8 天

- 按角色选择 Stem，接入兼容性图。
- 把阶段需求转换成 Recipe 自动化、Ducking 和 prominence。
- 用 10-20 个标准请求做组合级耳机试听。

验收：单素材正确、组合也成立；水声、音乐、鸟鸣等不会无逻辑长期同时占前景。

### Phase 5：供给缺口工厂，按真实缺口滚动

- 建立 Supply Gap 排序面板和批量生成 Job。
- 接入一个本地 Provider 和一个外部 SFX Provider Adapter。
- 实现生成后自动语义、声学和混音 QA。

验收：新素材只为高频真实缺口生产；未通过审核的候选不能进入公共作品。

### Phase 6：小流量闭环，1-2 周

- 10-20 名目标创作者完成真实描述到保存分享。
- 采集接受、修改、保存、复听和分享。
- 每周更新覆盖缺口和排序权重，不立即训练复杂端到端模型。

验收：首次接受率和修改后保存率显著高于 V2 基线，排除项违规率接近 0，且结果多样性不是标题变化。

## 13. 当前最重要的一步

下一步不是继续买素材，也不是先接一个更强 LLM。最高优先级是：

> 先完成 Phase 0 和 Phase 1：建立 200 条需求 Gold Set、受控声音本体、28 个核心 Stem 的 Metadata V3 和 Coverage Matrix。

原因是：没有需求评估集，就无法判断 LLM 是否理解正确；没有供给本体和真实标注，就无法判断“系统没有”还是“系统有但找不到”；没有 Coverage Matrix，增加素材只会继续堆数量。

完成这一步后，再接 AudioIntent V3 和 CLAP 检索，才能让需求端与供给端在同一套可验证语义上对接。

## 14. 参考资料

- Google AudioSet Ontology: https://research.google.com/audioset/ontology/index.html
- CLAP: Learning Audio Concepts From Natural Language Supervision: https://arxiv.org/abs/2206.04769
- PANNs: Large-Scale Pretrained Audio Neural Networks for Audio Pattern Recognition: https://arxiv.org/abs/1912.10211
- Google Recommendation Systems, Candidate Generation: https://developers.google.com/machine-learning/recommendation/overview/candidate-generation
- Endel product description: https://endel.io/
- BetterSleep Sleep Sounds and Sound Mixer: https://www.bettersleep.com/sleep-sounds/
- ElevenLabs Sound Effects documentation: https://elevenlabs.io/docs/capabilities/sound-effects

这些资料能够支持系统设计原则，但不能直接证明某个声音一定能让某个人入睡、专注或得到治疗。具体疗愈效果必须通过合规表述、编辑标准和真实用户行为验证，不能仅由标签或模型相似度宣称。
