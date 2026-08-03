# GitHub TTS 与冥想编排工作流调研

日期：2026-07-12  
目的：解决当前“人声生硬、语速像播报、没有和背景声配合”的问题。

## 结论

GitHub 上没有一个可以直接安装的“冥想生成 Skill”自动解决全部问题。当前问题必须拆成一条工作流：

```text
冥想目标
  -> 脚本分段与呼吸标记
  -> TTS 韵律/情绪生成
  -> 句间留白与呼吸空间
  -> 人声响度和频段处理
  -> 背景声自动 ducking
  -> Arrival / Guidance / Silence / Release 编排
```

之前的实现只完成了 TTS + ducking，缺少脚本节奏和人声导演层，所以听起来像把播报轨道放到音乐上面。

## TTS 候选仓库

### 1. OpenVoice V2

仓库：https://github.com/myshell-ai/OpenVoice

- MIT，README 明确写明 V1/V2 可免费商用。
- 支持中文、英文、跨语言和音色迁移。
- 有音色、风格、节奏和情绪控制方向。
- 适合：用固定的自有参考音色，生成睡前安顿和夜醒回睡的 A/B 版本。
- 风险：参考音频必须拥有授权，模型权重和依赖需锁定版本。

**优先级：P0 本地体验。**

### 2. CosyVoice 2/3

仓库：https://github.com/FunAudioLLM/CosyVoice

- Apache-2.0 代码仓库。
- 中文、多方言、跨语言能力强。
- README 提供 speed、volume、emotion、dialect、pronunciation inpainting 等控制方向。
- 适合：中文冥想脚本、较慢语速和自然句末处理。
- 风险：模型权重和具体 voice 文件要单独核对，不因代码许可证直接放行。

**优先级：P0 中文体验。**

### 3. StyleTTS2

仓库：https://github.com/yl4579/StyleTTS2

- 重点是 style/prosody 建模，不是简单改变播放速度。
- 适合研究“温柔、低能量、呼吸感”的韵律控制。
- 工程复杂度和模型许可需要重新锁定，不适合作为第一条生产路径。

**优先级：P1 韵律研究。**

### 4. Chatterbox

仓库：https://github.com/resemble-ai/chatterbox

- 面向表达力和情绪控制的现代 TTS 路线。
- 适合做英文情绪/自然度对照。
- 需要核对当前仓库和模型权重许可证，再决定是否进入商业候选。

**优先级：P1 英文对照。**

### 5. GPT-SoVITS / Fish-Speech

- GPT-SoVITS：https://github.com/RVC-Boss/GPT-SoVITS
- Fish-Speech：https://github.com/fishaudio/fish-speech

两者更偏音色克隆和高表现力生成，适合实验室对照，不应在没有参考音频权利、数据来源和模型权利记录时直接用于生产。

**优先级：Later。**

## 冥想编排 Skill 应该包含什么

### A. Script Director

不能把整篇文字一次交给 TTS。脚本必须拆成：

- `permission`：允许调整姿势、允许不追随指令。
- `arrival`：感受支撑、环境和呼吸。
- `practice`：一次只给一个动作。
- `silence`：3-6 秒无声或只有背景声。
- `release`：减少指令，允许退出。

### B. Prosody Profile

每种模式使用不同 profile：

| 模式 | 连续讲话 | 句间停顿 | 人声占比 |
| --- | ---: | ---: | ---: |
| 睡前安顿 | 3-6 秒 | 4-8 秒 | 25-35% |
| 夜醒回睡 | 2-5 秒 | 5-10 秒 | 15-30% |
| 呼吸练习 | 2-4 秒 | 配合呼吸周期 | 20-40% |
| 情绪安定 | 3-8 秒 | 3-6 秒 | 30-45% |

这些是内部产品实验参数，不是医学标准。

### C. Mix Director

- 人声进入前，背景先独立播放 20-60 秒。
- 人声出现时，背景 ducking 6-10dB，而不是只降 2-3dB。
- 每句结束后恢复背景，让用户听见“空间”而不是等下一句。
- 人声结束后，至少保留 2-5 分钟无语音背景。
- 语音不能全程持续，也不能每个阶段都保持同样响度。

### D. QA Director

不能只看文件能否解码，还要测：

- WPM/中文字符每分钟。
- 连续发声最长时长。
- 句间静默分布。
- 人声/背景 RMS 和 LUFS 差。
- 人声开始后背景是否有平滑 ducking。
- 人声结束后的纯背景时长。
- 是否存在“听力考试式”连续信息输入。

## 当前建议的最快路线

1. 不再继续调 Edge-TTS 的 `rate` 作为最终解决方案。
2. 用 OpenVoice V2 和 CosyVoice 生成同一套四段脚本。
3. 脚本先经过 Script Director 分段，再交给 TTS。
4. 用 Mix Director 把人声安排在整段作品的 25-35%，其余时间交给自然声、音乐和留白。
5. 只做 2 个样板：中文睡前安顿、中文夜醒回睡。
6. 先比较“是否像冥想产品”，再比较音色和版权。

## 当前判断

最需要升级的不是再找更多音频，而是增加一个真正的 `MeditationVoiceDirector` 层。它负责把脚本、韵律、留白和背景交接组织成一个整体；TTS 只是其中一个执行器。
