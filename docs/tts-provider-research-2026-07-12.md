# TTS Provider Research

日期：2026-07-12  
目标：为受控引导冥想找到可试听、可本地部署、并且能合法进入商业衍生音频的 TTS 路线。

## 结论先行

首选顺序：

1. **OpenVoice V2 本地 Spike**：GitHub MIT，项目 README 明确写明 V1/V2 可免费商用；支持中文、英文和跨语言。适合先在本地做 2 个脚本族的声音质量验证。使用他人参考音色仍需得到该声音所有者授权。
2. **Kokoro-82M 本地 English Spike**：GitHub Apache-2.0，README 明确可部署到生产；轻量、速度快。中文能力需要单独验证，不能仅根据项目语言代码宣称生产可用。
3. **CosyVoice 2/3 本地 Chinese Spike**：GitHub Apache-2.0，中文、多方言和跨语言能力强；但模型权重、ModelScope/Hugging Face 具体文件和参考音色许可必须逐项核对，不能只看代码仓库许可证。
4. **Google Cloud TTS / Azure Speech / Amazon Polly 商用 API**：都有公开免费额度或试用入口，适合快速做商业语音质量和成本验证；需要云账号、计费设置和逐项确认输出使用条款。
5. **ElevenLabs**：试听和质量验证很方便，但免费层不应假定可商用；正式生产要使用明确允许商业使用的付费计划并留存条款快照。

## GitHub 开源项目核对

| 项目 | 链接 | 仓库许可证 | 中文 | 商业判断 | 适合当前项目 |
| --- | --- | --- | --- | --- | --- |
| OpenVoice V2 | https://github.com/myshell-ai/OpenVoice | MIT | 原生支持 | README 明确写 Free Commercial Use；参考音色权利另算 | **最优先本地 Spike** |
| Kokoro-82M | https://github.com/hexgrad/kokoro | Apache-2.0 | 有 Mandarin 入口，但声音和中文质量需实测 | 代码/权重许可清晰，仍需核对具体 voice 文件 | 英文生产候选 |
| CosyVoice | https://github.com/FunAudioLLM/CosyVoice | Apache-2.0 代码 | 中文、多方言、跨语言 | 模型权重和音色须按具体下载条款核验 | 中文生产候选 |
| Piper | https://github.com/rhasspy/piper | 旧仓库 MIT；开发已迁移到 OHF-Voice/piper1-gpl | 依模型 | 项目和模型许可分离，当前迁移后的 GPL 边界不适合作为首选商业路径 | 轻量实验，不作为首发 |
| GPT-SoVITS | https://github.com/RVC-Boss/GPT-SoVITS | MIT 代码 | 中文、英日韩粤语等 | 参考音频、预训练权重和克隆对象权利必须单独确认 | 可做音色实验，不直接上线 |
| Edge-TTS | https://github.com/rany2/edge-tts | GitHub API 显示无明确 SPDX 许可证 | 微软 Edge 在线语音，多语言 | 仓库许可证不等于 Microsoft 服务输出商用许可；当前只做内部预览 | 现阶段内部体验 |

## 商用 API 试用路线

### Google Cloud Text-to-Speech

- 官方价格页：https://cloud.google.com/text-to-speech/pricing
- 优点：云端稳定、中文音色覆盖、适合批量脚本生成。
- 体验方式：新账号通常有云试用金，产品也有按字符计费的免费额度；具体额度随账户、地区和日期变化，必须以控制台和当前价格页为准。
- 商用要求：确认账号条款、API 条款和具体 voice/模型限制，并保存生成日期的条款快照。

### Azure AI Speech

- 官方价格页：https://azure.microsoft.com/pricing/details/cognitive-services/speech-services/
- 优点：中文神经语音覆盖好，SSML、语速、停顿和发音控制成熟。
- 体验方式：F0 免费层和 Azure 新账号试用是可验证入口；需要注册 Azure 账号，免费层和地区可用性会变化。
- 商用要求：确认 Azure 服务条款和语音输出使用权，不把免费层误读为无限免费。

### Amazon Polly

- 官方价格页：https://aws.amazon.com/polly/pricing/
- 优点：API 稳定，中文普通话、英文和 SSML 适合脚本块生产。
- 体验方式：AWS Free Tier 在满足账户条件时提供试用额度；额度和期限以当前 AWS 页面为准。
- 商用要求：确认 AWS 账户、区域、Free Tier 和输出使用条款。

### ElevenLabs

- 官方价格页：https://elevenlabs.io/pricing
- 优点：自然度和试听反馈好，适合快速比较音色。
- 风险：免费层不能默认用于商业发布；必须使用明确允许商业用途的计划，记录计划名称、条款版本、voice provenance 和生成时间。

## 不建议的判断

- 不要因为 GitHub 项目是 MIT/Apache 就认为所有模型权重、音色和参考音频都能商用。
- 不要把 Edge-TTS 能生成音频等同于 Microsoft 允许产品分发这些输出。
- 不要使用未经授权的真人音频做 OpenVoice/GPT-SoVITS 克隆。
- 不要在用户前台即时调用开源模型并跳过脚本、发音和授权 QA。

## 当前执行建议

### 本地体验（现在就可以做）

先用 OpenVoice V2 和 CosyVoice 做同一组 4 个脚本块的 A/B：

- 中文睡前安顿
- 中文夜醒回睡
- English Bedtime Release
- English Return to Sleep

保持同一文本、同一目标响度、同一停顿，比较发音、气息、尾音、长时间疲劳和与背景声的 ducking。

### 商业验证（获得凭证后）

优先接 Azure Speech 或 Google Cloud TTS 其中一个，生成同一组脚本；再用 ElevenLabs 做质量对照。只有在供应商条款和账号计划明确允许商业衍生使用后，才设置：

```text
TTS_PROVIDER=...
TTS_COMMERCIAL_USE_CONFIRMED=true
```

在此之前，系统继续使用 Edge/macOS 预览并保持 `needs_review`，公开导出继续阻断。

## 疗愈人声专项结论

### ASR 不能解决当前问题

ASR 负责把语音转成文字，只适合做参考音频转写、发音对齐和自动检查。当前“太响、像 AI 朗读”的根因是：

- TTS 韵律和停顿不自然。
- 语速、句末语调和重音不适合睡眠场景。
- 引导轨默认响度过高。
- 脚本块虽然安全，但句子仍需按口语呼吸重新分段。

因此 ASR 只能作为 QA 工具，不能作为音色修复器。

### 三层解决方案

1. **脚本与韵律层**：短句、更多停顿、避免连续指令；每句话只承载一个动作。优先使用能控制 speed、emotion、pause 和 intonation 的 TTS。
2. **模型层**：中文优先验证 CosyVoice/OpenVoice，英文优先验证 Kokoro/OpenVoice；如果本地质量不够，再用 Azure/Google/ElevenLabs 对照。
3. **后期层**：语音母版目标约 -28 LUFS、峰值不高于 -6dBTP，限制高低频，配方轨道默认控制在 22-36%，并通过 ducking 给人声让位。后期不能修复机器人式韵律。

### GitHub 候选的用途

- OpenVoice：适合使用自有授权参考音色做跨语言音色验证。
- CosyVoice：适合中文情绪、语速和方言控制，是中文首选 Spike。
- Kokoro：轻量，适合英文自然度和本地实时性验证。
- StyleTTS2 / Chatterbox：可作为英文表达力对照，但在使用具体权重前必须重新确认当前仓库和模型许可证。
- Whisper/FunASR：只用于生成结果的转写、漏字和发音 QA，不作为 TTS 生成器。
