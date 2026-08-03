# Content Intelligence V3 Phase 0/1 Baseline

日期：2026-07-13  
状态：自动基线、全量 approved 素材接入与 Quick Create AI V1 已完成，专家复核与真实缺口补充待后续阶段

## 已落地

- Audio ontology V3：69 个受控概念，包含父子关系和中英文同义词。
- Stem Metadata V3：63 个 approved、允许商用与二创的 Stem 已全部接入；其中 28 个为 `editorial_baseline`，35 个为待人工目标适配复核的 `catalog_baseline`。
- AudioIntent Gold Set V2：210 条 Prompt，覆盖 42 个中英文语义组；新增“用户只描述睡眠处境、拒绝音乐、要求低音量白噪音”的中英文需求表达。
- 声学基线：63/63 条可匹配 Stem 已提取时长、采样率、声道、LUFS、True Peak 和音量数据；61 条满足当前角色时长门槛。
- Compatibility Graph：已建立首批编辑和试听关系。
- Coverage Matrix：15 个首发需求单元按角色和候选阈值计算。
- Supply Gap：覆盖不足的单元已自动写入 `supply_gaps`。

## 当前覆盖结论

- 达到当前候选阈值：10/15 个需求单元。
- 存在明确缺口：5/15 个需求单元。
- 具备非水声降级：15/15 个需求单元。
- 生产人声缺口：睡前、夜醒回睡和呼吸冥想三个 guided 单元各缺 3 个 approved voice 候选。
- 专注音乐缺口：`deep_focus` 的 functional music 和 sound journey 各缺 2 个 approved music 候选。
- 新增供给提高了有效多样性，但没有伪造覆盖：睡前、回睡和专注的 base 候选由 7 增至 14，呼吸点缀由 3 增至 8；五个真实缺口保持不变。
- 历史壁炉缺口已由 `stem_fire` 解决并自动转为 `resolved`。

详细矩阵见 `reports/content-coverage-v3.md` 和 `reports/content-coverage-v3.json`。

## 声学风险事实

63 条文件中有 24 条原始文件的 True Peak 高于 `-3 dBTP`。以下是高于 `-1 dBTP` 的重点候选：

| Stem | True Peak |
| --- | ---: |
| Light Rain Loop | +0.42 dBTP |
| Long Rain Ambience | +0.13 dBTP |
| Soft Rain Loop | +0.05 dBTP |
| Windy Sea Loop | -0.07 dBTP |
| Sea Waves with Birds | -0.08 dBTP |
| River Water Flowing | -0.46 dBTP |
| Thunder Rumble | -0.59 dBTP |
| Rain on Car Glass | -0.86 dBTP |
| Breeze Through Trees | -0.89 dBTP |
| Sea Waves Loop | -0.92 dBTP |
| Close Sea Waves Loop | -0.97 dBTP |

这不直接代表当前 Mix 一定超标。Quick Create 现在会同时使用 LUFS 与 True Peak 计算初始音量，并对 base、environment、music 和 accent 使用不同的响度与峰值靶点；最终渲染仍必须执行母带 QA。两个短于环境底层门槛的素材保留元数据，但不会作为长循环候选。

## 数据可信度边界

- 28 条 `editorial_baseline` 是项目编辑基线；新增 35 条 `catalog_baseline` 的 source、role 和风险来自已审核目录事实，goal fit 标记为未人工确认并在通用排序中降权。
- 210 条 Gold Case 目前为 `seed_reviewed`，尚未由外部冥想内容专家逐条确认。
- Compatibility Graph 当前是首批关系，不代表所有两两组合都已完成长时间试听。
- TTS 音色问题按项目决定继续搁置，但系统已将其明确记录为供给缺口，而不是伪装为已覆盖。

## Quick Create AI V1 实施结果

- Quick Create 已从“17 个固定 Recipe 过滤”切换为动态素材级匹配。
- DeepSeek 只输出目标、场景、内容模式、需要、偏好、排除和阶段结构。
- 本地匹配器只查询 approved 且允许商用、二创的 Metadata V3 素材。
- required 没有候选时返回 `422 Supply Gap`，不跨家族替换。
- 每次请求保存 Selection Trace，包括 provider、候选、拒绝原因、选择和 seed。
- Recipe 仍使用现有 V2 模型，并继续由 Live Mix、冻结版本和最终渲染共同解释。
- 模型请求设置 12 秒上限，超时后使用本地标注匹配并明确返回 `provider=rules`。

已验证：

- “列车专注、不要雨水和音乐”选择 Train Carriage，并把目标修正为 focus。
- “不要任何水声”排除全部水声子类。
- “先安静、音乐之后进入”生成两层动态 sound journey。
- “只要壁炉，不要水声和音乐”现在明确选择 `stem_fire`；不会再返回水声或无关替代。

当前主线回归的 Quick Create 上限约为 12.1 秒。DeepSeek `deepseek-v4-pro` 在部分请求中可真实完成结构化理解，但响应延迟不稳定，部分请求会触发规则降级。后续若要达到 3 秒左右首播，需要更快的意图模型、缓存或异步二次优化，不能继续增加当前模型的阻塞等待。

## 后续门槛

进入下一轮匹配优化前需要：

1. 对 42 个 Gold Set 语义组完成人工语义复核。
2. 对 28 条 `editorial_baseline` 和 35 条 `catalog_baseline` 的 source event、角色、风险和 goal fit 做一次分级内容复核，优先复核新增候选。
3. 决定高原始峰值素材是保留源文件并在 Recipe 降增益，还是制作统一审核副本。
4. 保持 TTS 暂缓，同时先解决 2 条专注音乐候选缺口。
5. 用真实请求统计 `deepseek` 成功率、规则降级率和 P95 首播时间。

LLM Structured Output + 本地规则校验已经进入 Quick Create V1。完成以上复核后，再根据真实失败修订标注和匹配权重，不继续扩大手工语义系统。
