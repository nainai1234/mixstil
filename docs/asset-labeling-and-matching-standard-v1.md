# SNOOZE 素材标注与匹配规范 V1

日期：2026-07-13  
状态：Quick Create AI V1 执行标准

## 1. 分工原则

```text
大模型：理解用户说了什么
素材系统：证明库存里实际有什么
匹配器：用标注和硬约束选出候选
Recipe：把候选组织成可复现时间线
```

大模型不得直接编造素材、文件 URL、授权或审核状态。它只输出目标、场景、需要、偏好、排除项、内容模式和阶段结构。

## 2. 每条素材的必填标注

| 字段 | 目的 | 示例 |
| --- | --- | --- |
| `sourceConcepts` | 描述实际听到的声源 | `source.vehicle.rail.carriage` |
| `semanticDescriptions` | 用自然语言描述真实听感 | `Steady interior train carriage rumble` |
| `roles` | 说明能在 Mix 中承担什么角色 | `base.masking` |
| `goalFit` | 记录适用目标、场景和编辑评分 | `focus/deep_focus/0.95` |
| `temporal.loopMode` | 说明循环方式 | `seamless`、`crossfade`、`one_shot` |
| `temporal.recommendedPhases` | 说明适合出现的阶段 | `arrival`、`core` |
| `mix.recommendedGainDb` | 推荐混音增益范围 | `[-34, -26]` |
| `mix.frequencyRole` | 频谱占位 | `low`、`mid`、`high`、`full` |
| `risks` | 记录负面联想和使用风险 | `attention_capture` |
| `qa_status` 与权利字段 | 决定能否进入用户作品 | `approved + commercial + derivative` |

声学测量必须独立保存：时长、采样率、LUFS、True Peak、平均和最大音量。`default_volume` 不能替代真实测量。

## 3. 标注规则

1. **先标事实，再标用途。** “雨声”是事实；“适合睡眠”是编辑判断，两者不能混为一个标签。
2. **使用父子概念。** `source.natural.water` 是水声家族，`rain`、`ocean`、`flowing`、`waterfall` 是子类。
3. **排除项默认作用于家族。** “不要水声”排除全部水声子类；“不要海浪”只排除 ocean 分支。
4. **必须记录负面信息。** 鸟鸣可能抢注意力，水声可能产生排尿联想，钟声可能造成突发峰值。
5. **名称不能代替试听事实。** 文件叫 Fire 但实际像水或风时，必须拒绝或改标，不能按名称检索。
6. **未知就保持未知。** 不为了增加标签数量推测不存在的声源或效果。
7. **不标医疗效果。** 不使用“治疗失眠”“治愈焦虑”等标签。
8. **机器标签只是候选。** 未经人工内容确认不能把自动识别结果标记为 `verified`。

## 4. 角色规范

| 角色 | 定义 | 同时出现限制 |
| --- | --- | --- |
| `base.masking` | 稳定、低注意力的底层 | 可与一个环境或音乐层组合 |
| `environment.scene` | 建立真实场景的环境层 | 同一阶段原则上只有一个前景环境 |
| `music.bed` | 承担情绪和功能目标的音乐层 | 与强环境同时出现时必须控制主次 |
| `accent.event` | 短暂转场或觉察事件 | 低频次，不得循环平铺 |
| `voice.guide` | 受控引导人声 | 出现时背景需要 Ducking |

## 5. 匹配流程

```text
用户描述
-> LLM 输出结构化需求
-> 只查询 approved 且允许商用/二创的素材
-> 排除声音家族和风险硬过滤
-> required 必须满足
-> preferred、goalFit 和角色评分
-> 兼容关系检查
-> 选择 1-3 条素材
-> 构建 Recipe V2
-> 最终契约校验
```

初始评分只用于候选排序：

```text
目标场景适配度
+ required 命中
+ 任一 preferred 命中
+ 可复现的轻量随机因子
```

同一父子分支的多个偏好不能重复加分。例如模型同时输出 `domestic`、`room_tone` 和 `fan` 时，不能让室内声音因为标签更细而获得三倍权重。

## 6. 无匹配处理

- required 没有任何 approved 候选：返回 `422 Supply Gap`。
- 不允许跨声音家族偷换，例如用雨声替代壁炉或列车。
- 缺口记录原始描述、概念、目标、场景和内容模式。
- 后台根据请求频次决定采购、录制、本地合成或外部 API 生成。
- 新候选完成内容、声学、混音、授权和人工听感审核后才能进入匹配池。

### 元数据复核状态

- `editorial_baseline`：source、role、风险与 goal fit 已由项目内容侧复核，可作为通用默认候选。
- `catalog_baseline`：素材本身已通过当前 approved 与授权门槛，source 和 role 依据目录事实建立，goal fit 尚未完成人工确认。它可以满足用户明确点名的声音，但在通用排序中必须低于已确认候选。
- 两种状态都必须具备声学分析。低于角色最小时长的素材只保留标签和审核记录，不得作为长循环底层进入 Quick Create。

## 7. 当前技术边界

- 当前 28 条核心素材直接使用数据库结构化检索，不需要向量数据库。
- LLM 只生成检索条件，不读取整个素材库，也不直接决定最终文件。
- 前台 LLM 理解设定 12 秒上限；超时后使用同一标注体系的本地匹配器，响应必须明确记录实际 provider。
- CLAP、PANNs 和向量召回延后到素材规模明显扩大、结构化检索召回不足时再引入。
- 200 条 Gold Prompt 仅用于评估模型是否正确理解，不参与线上匹配逻辑。
