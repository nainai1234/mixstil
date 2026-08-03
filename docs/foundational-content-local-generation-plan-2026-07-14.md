# 首发内容库与本地生成执行方案

日期：2026-07-14  
范围：Voice-free Beta 的 Home / Discover 基础作品库

## 结论

首发内容库定义为 24 个成品 Brief，其中 8 个进入 Home，其余进入 Discover 分类。第一阶段不是生成 24 条互不相关的 MP3，而是先补公共音乐层，再由 Recipe V2 把已审核自然声、噪声、点缀与音乐组合成可复现作品。

完整作品清单：`docs/foundational-listening-library-v1.json`。

## 本地工具路由

| 能力 | 当前状态 | 用途 | 发布边界 |
| --- | --- | --- | --- |
| FFmpeg 8.1.2 | 可用 | 解码、循环、混音、响度、最终编码 | 生产可用 |
| NumPy + SoundFile + pyloudnorm | `.venv-audio` 可用 | 噪声、Drone、Pad、精确频率与确定性音乐底床 | 首选本地生产路线 |
| ACE-Step 1.3.5B | 代码与 7.7GB checkpoint 可用，MPS 可用 | Calm / Focus 音乐候选 | 候选制；睡眠默认禁用 |
| MusicGen-small | Liaoyu 环境与 2.2GB 模型可用，MPS 可用 | 内部质量对照 | 权重非商用，不进入公开资产 |
| Liaoyu Content OS | 已有音乐、频率、混音和 QA 管线 | 后台内容生产参考和后续统一入口 | 不直接把历史生成物视为批准内容 |
| SoX | 未安装 | 当前不需要 | FFmpeg 已覆盖必要能力 |

## 为什么这样分工

- 睡眠要求无节拍、无惊吓、低变化，确定性合成比当前生成模型更可靠。
- ACE-Step 已有睡眠候选出现喜庆感和 129 BPM 脉冲，因此只做 Calm / Focus 候选。
- MusicGen 安装完整，但 `facebook/musicgen-small` 权重许可不适合商业发布，只能做内部对照。
- 自然声优先使用现有授权录音，不用简单合成冒充真实森林、雨或海浪。
- 频率内容记录真实基础频率，但不把 174Hz、432Hz 等写成疗效承诺。

## 第一批本地生成

批次：`docs/local-procedural-content-batch-2026-07-14.json`。

- Calm Grounded：2 条固定种子候选。
- Meditation Open：2 条固定种子候选。
- Focus Neutral：2 条固定种子候选。
- 每条 60 秒、48kHz、Float WAV，只进入候选目录。

生成后顺序固定为：技术分析 -> 20 秒开头试听 -> 全长试听 -> 30 分钟循环 -> 与现有环境/噪声组合 -> 通过后晋升为 approved Stem -> 再批量渲染 24 个 Works。

## Home 首批八条

1. Dry Quiet Room
2. Warm Music, Later
3. Quiet Room Return
4. Five Minute Arrival
5. After Work Release
6. Quiet Train Focus
7. Silent Room Sit
8. Dry Campfire Night

前四条可以完全使用当前已批准素材生产。After Work Release 需要本批 Calm Grounded 候选通过；Dry Campfire Night 需要把 Campfire 的场景适配从未验证状态完成听感确认。

## 放行条件

- 作品标题必须与实际声音一致。
- 水声只进入明确水声作品，不作为默认层。
- 睡眠和夜醒作品不使用突发点缀、鸟叫、雷声或强旋律。
- 每条音乐保留生成器、代码版本、Profile、Seed、基础频率、Hash 和 QA。
- 单条通过不等于集合通过；最终检查素材重复率与声音家族分布。
