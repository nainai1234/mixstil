# Google Lyria 3 使用与提示词调研 V1

日期：2026-07-21  
状态：官方资料调研完成；尚未开始新的付费生成测试

## 1. 结论先行

Lyria 3 是文字或图片到音乐的生成模型。它的基本产物是一个混合完成的
音乐片段或完整音乐，不是 MIDI、单音采样器、多轨工程或 Stem 分离接口。

当前项目使用的 `interactions` endpoint 和请求结构是正确的：

```json
{
  "model": "lyria-3-clip-preview",
  "input": [
    {
      "type": "text",
      "text": "PROMPT"
    }
  ]
}
```

此前真实调用成功，证明鉴权、endpoint、模型和音频解码路径可用。此前测试
不充分的地方是提示词：它使用了“缺失 Stem”“放在现有和声下面”等项目
内部语言，但没有向模型提供现有和声音频，也没有使用 Lyria 官方推荐的
音乐描述框架。

## 2. 两个 Lyria 3 模型

### `lyria-3-clip-preview`

- 输出：30 秒音乐片段。
- 每个 Prompt：最多一个片段。
- 音频：MP3、44.1 kHz、192 kbps。
- 支持：文字到音乐、图片到音乐、器乐模式、BPM、Intensity。
- 不支持：完整时长控制、负面提示词参数。
- 适合：低成本提示词实验、风格候选、短音乐层候选。

### `lyria-3-pro-preview`

- 输出：完整音乐，最长约 184 秒。
- 每个 Prompt：最多一个片段。
- 音频：MP3、44.1 kHz、192 kbps。
- 支持：器乐模式、Duration、BPM、Intensity、时间段结构。
- 不支持：官方模型卡仍将 Negative prompting 标为不支持。
- 适合：完整参考作品、2-3 分钟结构化音乐候选。

两个模型当前都处于 Preview。生产系统必须保存精确模型版本和生成时间，
不能假设预览模型行为永远不变。

## 3. 官方推荐的提示词结构

Google 的 Lyria 提示词指南建议按以下顺序描述：

```text
Genre and style
+ Mood and emotion
+ Instrumentation
+ Tempo and rhythm
+ Vocal policy
+ Optional arrangement and structure
+ Optional soundscape and ambiance
+ Optional production quality
```

对本项目，应固定为：

```text
1. 这是 instrumental music
2. 场景和风格
3. 情绪与注意力水平
4. 主导乐器和辅助乐器
5. BPM 或 free-time
6. 旋律密度、和声变化和节奏特征
7. 开头、稳定段、结尾
8. 音色、混响、动态和声场
9. 排除特征，以自然语言写在正文末尾
```

官方明确建议在正文中写出 `instrumental` 来排除人声。尽管如此，产品仍
必须执行无人声 QA，不能把提示词视为确定性保证。

## 4. Negative Prompt 的实际边界

Google 的通用音乐提示词指南展示了 `negative_prompt`，但 Lyria 3 Clip 和
Pro 的官方模型卡均将 Negative prompting 标为不支持。`negative_prompt` 是
旧的 Lyria 2 `predict` API 的正式字段，不应擅自加入当前 Lyria 3
`interactions` 请求。

因此 Lyria 3 当前做法是：

- 在正向 Prompt 中写 `instrumental`。
- 用清楚、少量且不冲突的句子描述低密度、无鼓点、无高潮。
- 不发送未经官方 Lyria 3 请求文档支持的字段。
- 生成后用机器 QA 和人工试听检查人声、鼓点、突发和主旋律。

## 5. 为什么原提示词不理想

原提示词的问题不是“不够长”，而是控制对象不匹配：

- `Generate only one missing Stem` 不是 Lyria 官方音乐概念。
- `sit underneath an existing harmony Stem` 没有提供现有和声音频。
- 连续堆叠十多个 `no ...` 容易被 Prompt rewriter 或模型弱化。
- 同时要求 felt piano、support bed、无旋律、无脉冲、无大混响，缺少明确的
  Genre、BPM、Intensity 和时间结构。
- Clip 模型固定输出 30 秒，要求“可循环”仍只是听感目标，不是接口参数。

这次返回的 29.49 秒文件符合 Clip 模型的技术规格。它不能证明提示词成功，
也不能证明模型失败；只能证明真实 API 路径正常。

## 6. 本产品如何使用 Lyria

Lyria 适合生产以下音乐级材料：

1. Instrument-dominant clip：某一种乐器占主导的 30 秒器乐片段。
2. Harmonic bed：低密度和声床候选。
3. Motif candidate：短动机候选，后续只选可控、低显著性的结果。
4. Texture-music hybrid：音乐性纹理候选。
5. Full reference work：Pro 模型生成的完整结构候选。

Lyria 不应被当作以下工具：

- 钢琴 C3、D3 等单音逐键采样器；
- MIDI 或乐谱生成器；
- 多轨 Stem 导出器；
- 已有音乐的分轨器；
- 无需 QA 的最终用户即时生成接口。

本产品的正确组合是：

```text
LLM 理解用户需求
  -> 输出 CompositionBrief 和 ScorePlan
  -> 确定性作曲器生成音符、和声、节奏和结构
  -> 采样器或项目音源渲染可控乐器音符
  -> Lyria 补充音乐床、器乐片段和风格候选
  -> 环境声/纹理来自专用生成或录音库存
  -> QA 后进入可复用库存
  -> Recipe V2 按用户需求组合
```

这样 Lyria 是音乐素材生产工具之一，不承担整个作曲系统，也不承担单音
音源库的全部责任。

## 7. 下一轮正确测试矩阵

先用 Clip 模型，三种场景各生成三个候选，共九次真实请求。每个 Prompt
只改变一个主要变量，避免无法判断结果来自哪里。

### Sleep

目标：低动态、低旋律显著性、无节拍、柔和起音。

```text
Instrumental ambient sleep music, 48 BPM, intensity 1/10. Peaceful and dark-warm,
led by soft felt piano in a low register with a quiet sustained pad underneath.
Very sparse notes, long spaces, slow harmonic motion, and no foreground hook.
A stable 30-second texture with a gentle beginning and an unresolved soft ending.
Clean intimate mix, restrained reverb, soft attacks. No singing, spoken voice,
drums, percussion, rhythmic pulse, arpeggios, bright chimes, climax, or sudden change.
```

### Meditation / Calm

目标：呼吸感、留白、轻微变化，无叙事高潮。

```text
Instrumental ambient meditation music, free-time, intensity 2/10. Spacious,
grounded, and inward-looking, led by warm Rhodes with a restrained soft woodwind
response. Short phrases separated by long silence, open harmony, slow timbral
movement, and no dramatic resolution. Clean natural production with moderate
space. No singing, spoken voice, drums, strong pulse, dense melody, cinematic
build, sharp attacks, or sudden transition.
```

### Focus

目标：稳定推进、低干扰、无歌词、不过度催眠。

```text
Instrumental minimal ambient focus music, 68 BPM, intensity 3/10. Neutral,
steady, and quietly alert, led by dry warm Rhodes and a soft common-tone synth
bed. A narrow repeating motif with small variations, stable dynamics, restrained
low pulse, and no emotional climax. Clean close mix with limited reverb. No
singing, spoken voice, catchy lead, dramatic chord changes, loud drums, cymbal
crashes, bass drops, or sudden transitions.
```

### 每个候选的 Gate

- 是否完全无人声；
- 是否符合目标场景；
- 是否出现未要求的鼓点或明显节拍；
- 是否有过强主旋律或记忆性 Hook；
- 是否有突然变化、高潮或明亮瞬态；
- 是否能裁剪成独立音乐床、短动机或音乐纹理；
- 30 秒结尾是否可通过交叉淡化形成长时层；
- 同一 Prompt 的三个候选是否足够不同。

九个候选全部只进入审核区。没有任何候选因 API 成功而自动注册为基础素材。

## 8. 后续模型选择规则

- 提示词和风格探索：`lyria-3-clip-preview`。
- 需要 60-184 秒结构、时间戳段落和完整作品：`lyria-3-pro-preview`。
- 需要单音、音阶、和弦逐层控制：不用 Lyria，使用 ScorePlan + 可控音源。
- 需要真正 Stem：先独立生成各音乐层或使用专门分轨工具，不能把 Lyria 的
  混合音频命名为 Stem。

## 9. 官方来源

- Google Cloud, Generate music using Lyria:  
  https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/music/generate-music
- Google Cloud, Lyria music generation prompt guide:  
  https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/music/music-gen-prompt-guide
- Google Cloud, Lyria 3 model card:  
  https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/lyria/lyria-3

以上资料在 2026-07-21 核对。模型仍处于 Preview，正式批量生产前应再次核对
模型卡、接口字段、配额和定价。
