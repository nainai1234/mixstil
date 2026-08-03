# 个性化音频 V2 执行计划

日期：2026-07-11  
依据：[个性化冥想与助眠音频生成方案 V2.0](./personalized-audio-generation-plan-v2.md)

项目级约束：[个性化音频项目主线宪章](./project-mainline-charter.md)。每项任务进入开发前必须通过其中的优先级判断。

## 执行原则

- 每个 Sprint 必须产出可运行、可验证的结果。
- 未通过授权和 QA 的素材不能通过商业导出门槛。
- 用户端先组合已批准素材；新音乐和音效只在后台生产。
- Live Mix 和 Published Work 使用同一个版本化 Recipe 语义。
- 先证明保存、复听和分享，再增加模型复杂度。

## 里程碑

| Sprint | 目标 | 预计 | 退出标准 |
| --- | --- | ---: | --- |
| 0 | 资产与规则止血 | 3–4天 | 审计可重复运行；核心包和十个配方可解释 |
| 1 | Quick Create | 5–7天 | 无外部 API 也能一分钟内生成、调整、保存 |
| 2 | Recipe V2 | 5–7天 | 预览与导出轨道、阶段和事件一致 |
| 3 | 受约束人声 | 7–10天 | 中英文脚本、TTS、Ducking、失败回退可用 |
| 4 | 对话修改 | 5–7天 | 局部修改可预测、可撤销、不误改其他轨道 |
| 5 | 资产工厂 Spike | 5–8天 | 只补真实高频缺口，许可和可用率达标 |
| 6 | 小流量验证 | 至少2周 | 保存、复听、分享和成本指标达到发布线 |

## Sprint 0 工程任务

### S0-1 资产审计

- 新增 `pnpm audit:assets`。
- 对比 `public/audio`、数据库 `audio_stems` 和文件 Hash。
- 使用 ffprobe 记录时长、采样率、声道和编码。
- 输出 `reports/asset-audit.json` 与 `reports/asset-audit.md`。

### S0-2 审核门槛修复

- Mixkit 音乐候选默认改为 `needs_review`。
- `batch-04` 接入 Seed，但在听感/循环 QA 前保持 `needs_review`。
- 保持商业与二创许可元数据，使用 QA 状态阻断渲染。

### S0-3 内容目录

- 三个一级目标：Sleep、Calm、Focus。
- 五个二级场景：睡前、夜醒回睡、呼吸、情绪放松、专注。
- 首轮18个已批准核心 Stem。
- 4个待审音乐核心候选，审核通过后才加入默认配方。
- 十个不依赖外部 API 的默认配方。

### S0-4 验证

- `pnpm validate:catalog`
- `pnpm db:seed`
- `pnpm audit:assets`
- `pnpm typecheck:server`
- `pnpm build`
- 数据库确认待审音乐和 `batch-04` 无法通过渲染门槛。

## 后续 Sprint 工程拆分

### Sprint 1

- 新增 Quick Create API 和页面。
- 将自然语言解析映射到三个目标、五个场景。
- 在浏览器先返回 Recipe，再异步准备可选人声。
- 提供环境、音乐、人声三个强度控制。

### Sprint 2

- Recipe 增加 Schema Version、Phase、Role、Fade、Ducking、Event 和 Random Seed。
- 新增版本冻结，区分 Live Mix 与 Published Work。
- 增加循环区间与按素材配置的交叉淡化。
- 把自动 QA 结果写入数据库。

### Sprint 3

- 建立中英文审核脚本块。
- 增加 TTS Provider Adapter、任务、成本和授权记录。
- 生成前允许编辑脚本，生成后执行发音和响度 QA。
- TTS 失败时保留无人声作品。

### Sprint 4

- 定义受支持的修改操作和 JSON Patch 边界。
- 增加 Recipe 版本历史与撤销。
- 只重新生成受影响的人声或资产。

### Sprint 5

- 从未命中请求形成资产缺口排行。
- 对一个本地模型和一个外部 Provider 做限量 Spike。
- 候选通过技术、听感和许可审核后才能晋升。

### Sprint 6

- 埋点首播时间、首次接受率、修改、保存、导出、分享和复听。
- 设置外部成本、失败率和 QA 阻断看板。
- 根据真实行为决定是否扩充素材、语言和实时生成。
