# 舒缓轻音乐与冥想音乐结构规范 V1

Date: 2026-07-23  
Status: production-guidance, no medical claims

## 1. 结论

当前 `lyria-foundational-expansion-v2` 的部分候选不够舒缓，主要不是因为音量，而是因为：

- 起音事件太密；
- 高频或点状细节偏亮；
- 有些素材有类似鼓点、脉冲、敲击或 groove 的听感；
- 乐句密度偏高，像“在演奏”，不是“在承托”；
- 环境声有太多可被注意力捕捉的小事件。

下一批候选必须按“低唤醒音频”设计，而不是按“好听的音乐片段”设计。

## 2. 调研依据

可靠资料的共同方向：

- 慢速度是降低唤醒感的重要音乐参数。音乐干预研究常把 60-80 BPM 或 60-90 BPM 的慢速区间作为放松相关音乐的参数之一。
- 睡眠音乐更倾向低速度、低响度、低能量、节奏变化小、音符密度低。
- 低唤醒音乐应避免快速、响亮、明亮、尖锐、staccato、突然变化、复杂纹理和明显节奏事件。
- ambient / meditation 更强调 atmosphere、texture、drone、loop、space，而不是传统主歌副歌、强旋律、强鼓点。
- 鼓点、percussiveness、清晰 pulse、复杂 rhythmic pattern 会提高身体跟随和唤醒风险，不适合当前 Sleep/Calm 基础素材。

Sources:

- de Witte et al., *Music therapy for stress reduction: A systematic review and meta-analysis*, Health Psychology Review, 2022. https://doi.org/10.1080/17437199.2020.1846580
- de Witte et al., *Effects of music interventions on stress-related outcomes: a systematic review and two meta-analyses*, Health Psychology Review, 2020. https://pubmed.ncbi.nlm.nih.gov/31167611/
- Yamasato et al., *Characteristics of music to improve the quality of sleep*, Music and Medicine, 2019. https://doi.org/10.47513/mmd.v11i3.643
- Sena Moore & Hanson-Abromeit, *Theory-guided Therapeutic Function of Music...*, Frontiers in Human Neuroscience, 2015. https://doi.org/10.3389/fnhum.2015.00572
- Gomez & Danuser, *Relationships between musical structure and psychophysiological measures of emotion*, Emotion, 2007. https://pubmed.ncbi.nlm.nih.gov/17516815/
- Durham University, Ambient Music research project. https://www.durham.ac.uk/research/institutes-and-centres/centre-for-research-into-inner-experience/projects/ambient-music/

## 3. 轻音乐结构

适用：Sleep / Calm 的轻音乐层；Focus 只使用低刺激版本。

### Tempo

- Sleep: 40-60 BPM, preferably free-time or implied pulse only.
- Calm / Meditation: 45-65 BPM, free-time acceptable.
- Focus: 60-76 BPM, but no drum groove; use slow arpeggio, pad motion, or sparse repeated tones instead.

### Rhythm

- 禁止鼓点、kick、snare、hi-hat、tabla、hand drum、明显 percussion loop。
- 禁止 backbeat、groove、dance pulse、march pulse。
- 允许：极弱、非打击性的呼吸式音量起伏。
- 节奏变化应小，重复应可预测，但不能形成“鼓机感”。

### Melody

- Sleep: 2-4 个音的短动机，长停顿，不要 hook。
- Calm: 3-5 个音的缓慢动机，避免大跳，避免清晰终止式。
- Focus: 可以稍微规律，但旋律必须后景化，避免占用语言/注意力系统。

### Harmony

- Sleep: open fifth, add9, sus2, sus4, slow modal color; 不要强终止。
- Calm: pentatonic, lydian/major add9, suspended harmony; 少量温暖变化。
- Focus: static modal vamp, open intervals, minimal harmonic change.

### Form

不采用传统“主歌-副歌-高潮”。

推荐结构：

```text
0-10% arrival: 音量渐入，建立安全空间
10-75% core: 稳定低变化，不新增刺激元素
75-100% release: 逐渐减少亮度、密度和音量
```

或者：

```text
free-time ambient bed
  + sparse phrase every 12-25 seconds
  + no cadence
  + no climax
  + loop boundary crossfade
```

## 4. 冥想音乐结构

适用：Calm / Meditation。

核心不是“曲子”，而是“注意力容器”。

- 可以没有传统节拍网格。
- Drone / Pad 是画布。
- 稀疏乐句只做注意力锚点，不能成为主旋律。
- 环境层要稳定，不能有鸟叫、虫鸣、清晰水滴、突然钟声。
- 点缀只能用于开始/转场，不能连续循环。

推荐层级：

```text
Pad/Drone: 60-80%
Environment/Noise: 15-35%
Sparse phrase: 5-18%
Accent: 0-5%, one-shot only
```

## 5. 频谱与声音质感

这里不做疗效承诺，只做可测的声学方向。

### 推荐

- dark / warm / low-mid body
- softened highs
- low brightness
- legato
- slow attack
- long decay
- low RMS variation
- low onset density

### 避免

- bright sparkle
- crisp transient
- metallic repeated ping
- staccato phrase
- sudden filter sweep
- rhythmic pulse
- high-frequency rain tick
- fire crackle pops
- handpan pattern
- obvious drum or mallet groove

## 6. 下一批 Lyria Prompt 硬规则

每个 prompt 必须包含：

```text
no drums
no percussion
no beat
no rhythmic pulse
no groove
no kick
no snare
no hi-hat
no tabla
no hand drum
no handpan rhythm
no crisp transient
no bright sparkle
no sudden change
no climax
no singing
no human voice
no human-like vocal texture
```

Sleep / Calm 的音乐类 prompt 必须包含：

```text
free-time or 40-60 BPM
intensity 0.5/10
very sparse
long pauses
dark warm timbre
soft attack
low brightness
no hook
no cadence
unfinished ending
```

## 7. 机器 QA 门槛

候选通过机器初筛，不代表可用；但不满足以下门槛必须重试。

| 类别 | onset density max | centroid max | 行为 |
|---|---:|---:|---|
| environment | 2.2/s | 1800 Hz | crossfade loop |
| texture | 2.0/s | 1500 Hz | crossfade loop |
| instrument phrase | 1.2/s | 1200 Hz | sparse phrase |
| accent one-shot | 1.4/s | 1100 Hz | one-shot only |

人工试听必须特别判断：

- 是否有鼓点或可数节拍；
- 是否有类似 handpan / bowl / bell 的连续 pattern；
- 是否有太亮的高频；
- 是否有让注意力跟随的 hook；
- 5 分钟循环后是否疲劳；
- 是否仍能作为“素材”，而不是“完整曲子”。

## 8. 对当前批次的处理

`lyria-foundational-expansion-v2` 不整体废弃，但不能按现有听感直接推广为舒缓基础库。

处理策略：

1. 保留身份较清楚的候选作为 coverage candidate。
2. 对事件密度高、亮度高、鼓点感强的候选降级为 retry-needed。
3. 新建 `lyria-foundational-soothing-retry-v1`，只重做低唤醒候选。
4. 新批次通过后，再替换正式非音乐注册表里的不舒缓候选。
