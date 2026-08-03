# 开源可控音频生成栈调研 V1

日期：2026-07-21  
目标：用开源软件实现可控的音符、乐器、层、环境纹理和个性化组合

## 1. 结论

最符合 SNOOZE 要求的路线不是继续寻找“更听话的整曲生成模型”，而是：

```text
用户一句话
  -> LLM 输出结构化 CompositionBrief
  -> 作曲层生成音符、和声、节奏、段落和随机种子
  -> 开源渲染器调用指定乐器音源
  -> 合成器生成 Drone、Pad、Texture
  -> 环境素材按比例加入
  -> Recipe V2 组合和自动化
  -> 机器 QA + 人工试听
  -> 保存可重放的 score、seed、素材版本和 mix
```

这条路线可以精确控制：

- 音域和具体音符；
- 调式、和声、和弦变化速度；
- 每个乐器的独立音量和进入/退出时间；
- 旋律密度、乐句长度、重复方式；
- 鼓点、脉冲和人声是否存在；
- 循环边界、淡入淡出和长时结构；
- 同一用户需求生成不同作品，而不是固定一首曲子。

## 2. 推荐组件

### A. 符号作曲层：music21 + pretty_midi

用途：音符、和弦、调式、音域、拍号、节奏、MIDI 和乐谱结构。

- `music21`：音乐理论、和弦、调式、乐句和乐谱分析。
- `pretty_midi`：创建和编辑 MIDI，适合后端批量生成事件。

这一层不产生最终音频，正好避免文字模型无法保证音符的缺陷。它应该
接收 `CompositionBrief`，输出可复现的 `ScorePlan`。

许可证必须在依赖锁定时再次核对；不能因为 Python 包可安装就自动视为
允许闭源商业分发。

### B. 采样和乐器渲染：FluidSynth 或 sfizz

#### FluidSynth

适合：SoundFont 2、MIDI、钢琴、Rhodes、弦乐、基础乐器批量渲染。

- 开源实现成熟，适合无界面服务器渲染。
- 代码许可证为 LGPL 系列。
- 真正决定能否商用的是 SoundFont 音源文件的许可证，而不是 FluidSynth
  本身。

#### sfizz

适合：SFZ 格式的多采样乐器和精细音色映射。

- GitHub 项目许可证为 BSD-2-Clause。
- 支持逐音符、力度层、键区和样本轮换。
- 更适合建立钢琴、尼龙吉他、Rhodes、柔和弦乐等可控音源库。

推荐：先用 FluidSynth 跑通 MIDI 到 WAV 的流水线，再用 sfizz/SFZ 扩展
音色质量。音源文件单独维护 `sourceUrl`、作者、许可证、hash 和商业/衍生
使用字段。

### C. 程序化合成：Csound 或 SuperCollider

#### Csound

- LGPL-2.1。
- 适合生成 Drone、Pad、低频支持层、柔和噪声、呼吸式滤波和有机纹理。
- 参数完全可控，适合服务器批量渲染。

#### SuperCollider

- GPL-3.0。
- 适合复杂的实时合成、算法作曲和声音纹理实验。
- 若作为独立服务或工具使用需要单独评估 GPL 交付边界；它不是第一版
  商业后端的最简依赖。

推荐：生产后端优先 Csound；SuperCollider 保留为研究和实时原型工具。

### D. 音频后处理：FFmpeg + Python 音频分析

用途：裁剪、淡入淡出、交叉淡化、响度归一、循环拼接、格式转换和机器 QA。

机器 QA 至少包括：

- 时长与采样率；
- LUFS、真峰值和削波；
- 静音间隔和异常突变；
- 人声概率；
- 鼓点/脉冲概率；
- 高频瞬态；
- 循环接缝 RMS 差异；
- 主旋律密度和重复疲劳。

## 3. 不作为核心路线的开源音乐模型

### AudioCraft / MusicGen

代码仓库是 MIT，但公开预训练权重为 CC-BY-NC 4.0。项目已有试听记录，
低动态提示仍容易生成忙乱、摇滚或前景旋律。因此只保留研究用途，不进入
商业素材生产。

### Stable Audio Open

代码和权重访问受 gated/其他许可证约束，商业使用条件需要账户级确认。当前
不作为第一条生产路线。

### ACE-Step

代码快照为 MIT，但项目已有批次试听显示容易出现酒吧、兴奋、强旋律和非目标
风格。可以作为模型对比，不作为当前 Sleep/Calm/Focus 核心生成器。

### Lyria

Lyria 适合完整音乐片段和风格候选，但官方能力不是单音、MIDI 或 Stem 导出。
继续保留为外部质量基准或完整音乐候选，不作为基础元素工厂。

## 4. 基础元素的具体生产方式

### 乐器音符

```text
ScorePlan note event
  -> MIDI note / velocity / duration
  -> FluidSynth 或 sfizz
  -> 单独 instrument stem
  -> WAV master + loop/one-shot metadata
```

第一批应覆盖：

- 低音区和中音区柔和钢琴；
- Rhodes/电钢琴；
- 尼龙吉他；
- 柔和弦乐长音；
- 低动态 Pad；
- 温暖低音支持。

### 环境声

环境声不应伪装成音乐音符。每个素材独立描述：

- 风、雨、海、室内空气、森林、夜间室内；
- 事件密度、频谱亮度、循环方式、突发风险；
- Sleep、Calm、Focus 的适配度；
- 是否有水声联想、鸟叫、人声或机械噪声风险。

### 纹理和点缀

用 Csound 或已审核的短素材生成：

- 柔和空气层；
- 低注意力房间底；
- 木质、布料和轻微自然摩擦；
- 稀疏、低峰值的过渡点缀。

禁止把连续正弦波、蜂鸣、廉价铃声或固定噪声当作“基础元素”。

## 5. 对用户请求的处理

LLM 不直接输出音频，也不直接选择文件名。它只输出：

```json
{
  "goal": "sleep",
  "scene": "bedtime",
  "durationSeconds": 1800,
  "instruments": ["felt_piano", "soft_strings"],
  "environment": ["distant_wind"],
  "tempo": {"mode": "free_time", "bpm": null},
  "mode": "a_minor",
  "register": {"lowMidi": 38, "highMidi": 72},
  "density": "very_low",
  "exclusions": ["voice", "drums", "bright_attacks"],
  "variationSeed": 19304
}
```

本地作曲器随后从合法素材库存中选择音源、生成不同 ScorePlan，再由 Recipe
V2 组合。这样“明天生成 B 曲子”只需换 seed、动机、和声池或乐器角色，不需要
重新调用商业 API。

## 6. 第一阶段落地顺序

1. 锁定 `music21 + pretty_midi + FluidSynth + FFmpeg` 的最小流水线。
2. 导入两套可商用钢琴/电钢琴音源，完成音符到 WAV 的验证。
3. 用 Csound 生成三类低动态 Pad/Drone，不接外部音乐 API。
4. 生成 12 个不同 ScorePlan，每个目标 4 个，保证不是同一曲换音色。
5. 对每个结果做 30 分钟长时化、循环和人工试听。
6. 通过后扩展吉他、弦乐、环境和纹理库存。
7. Lyria 仅作为同一 Prompt 的外部质量对照，不作为默认生产路径。

## 7. 放行条件

只有同时满足以下条件，元素才进入基础库存：

- 每个元素单独可听且身份明确；
- 可解码、无削波、无异常静音；
- 无人声硬门禁通过；
- 音符、音域、乐器角色与 manifest 一致；
- 可循环或明确标为 one-shot；
- 具有场景标签、推荐增益和冲突标签；
- 音源文件的商业/衍生使用许可有记录；
- 人工试听通过；
- 与至少两个不同 ScorePlan 组合后仍然自然。

## 8. 来源

- SuperCollider: https://github.com/supercollider/supercollider
- FluidSynth: https://github.com/FluidSynth/fluidsynth
- sfizz: https://github.com/sfztools/sfizz
- Csound: https://github.com/csound/csound
- music21: https://github.com/cuthbertLab/music21
- pretty_midi: https://github.com/craffel/pretty-midi
- AudioCraft: https://github.com/facebookresearch/audiocraft
- ACE-Step: https://github.com/ace-step/ACE-Step-1.5
