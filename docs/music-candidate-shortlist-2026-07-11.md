# Music Candidate Pre-screen

日期：2026-07-11  
状态：候选清单，尚未批准，不得直接进入公开 Recipe

## 第一批 8 条候选

| Stem | 家族 | 目标场景 | 预筛理由 | 必须验证 |
| --- | --- | --- | --- | --- |
| `stem_mixkit_music_614` Silent Descent Piano | Piano | bedtime / return_to_sleep | 稀疏、夜间、低刺激 | 循环接缝、长尾是否打断入睡、商业衍生许可 |
| `stem_mixkit_music_587` Quiet Discovery Piano | Piano | emotional_settling | 温和、非戏剧性 | 是否有旋律过强或重复疲劳、Content ID |
| `stem_mixkit_music_584` Rest Now Pad | Pad | bedtime | 直接对应睡前、可作低层 | 低频能量、持续叠加后是否浑浊、循环 |
| `stem_mixkit_music_109` Deep Meditation Drone | Drone | bedtime / deep_focus | 可替代 brown noise 的音乐底层 | 是否有持续嗡鸣疲劳、音量上限、循环 |
| `stem_mixkit_music_127` Valley Sunset Pad | Pad | emotional_settling | 为 Calm 提供温暖非水选择 | 频谱刺耳点、与人声 ducking 的兼容性 |
| `stem_mixkit_music_493` Beautiful Dream Guitar | Guitar | bedtime / emotional_settling | 提供除钢琴和 Pad 外的音色 | 拨弦瞬态是否过于唤醒、旋律重复 |
| `stem_mixkit_music_441` Meditation Tones | Bowl/Tone | breathing | 可作为呼吸段落稀疏标记 | 事件密度、混响尾音和突发峰值 |
| `stem_mixkit_music_251` Ambient Low Bed | Drone | deep_focus | 专注场景稳定低层 | 是否遮蔽语音、低频疲劳、长时段稳定性 |

## 暂不进入首批默认 Recipe

- `stem_mixkit_music_22` Piano Reflections：可能旋律存在感较强，先作为 Calm 备选。
- `stem_mixkit_music_599` Possible Dreams Piano：与多条钢琴候选用途重叠。
- `stem_mixkit_music_31` Dreaming Soft Piano：与 614/584 的睡前定位重叠。
- `stem_mixkit_music_522` Relaxing Nature Guitar：需确认自然声叠加后不会继续强化水声心智。
- `stem_mixkit_music_759` Soft Evening Guitar：与 493 音色位重叠。
- 其余 Pad/Drone：待首批试听结果决定是否扩展，不以文件数量为理由放行。

## 放行门槛

候选只有同时满足以下条件才可将 `qa_status` 改为 `approved`：

1. 来源、许可和商业衍生使用记录完整。
2. Content ID/版权冲突检查完成。
3. 文件可解码，时长、采样率、声道和哈希记录完整。
4. 无削波、爆音、异常瞬态，循环或长时段播放稳定。
5. 耳机试听通过：不刺耳、不催促、不产生明显旋律疲劳。
6. 指定至少两个兼容场景、推荐音量和与 Voice Ducking 的混音规则。

## 预期结果

这 8 条如果通过，将把“正式音乐轨”从 1 条增加到最多 9 条，并覆盖 Piano、Pad、Drone、Guitar、Tone 五个家族。随后才重做 10 个默认 Recipe 的结构平衡；若其中超过 3 条未通过，再按缺失家族采购或生成，不盲目扩大候选数量。
