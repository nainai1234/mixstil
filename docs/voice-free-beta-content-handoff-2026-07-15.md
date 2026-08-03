# Voice-free Beta 内容包交接说明

日期：2026-07-15  
内容负责人状态：已冻结，可供移动端与播放链路验证使用

## 1. 交付内容

- 发布清单：`reports/content-release-manifest-2026-07-15.json`
- 冻结基线：`reports/content-release-baseline-2026-07-15.json`
- 署名清单：`reports/release-attribution-credits-2026-07-15.json`
- App/Web/移动端随包署名数据：`public/content/voice-free-beta-attribution-credits.json`
- 内容指纹：`87a173f8b43fa5ad46d768d8bbb4ba9d7404b641793481bf0630247dc57a5a21`
- 发布素材：111 条
  - Accent 13
  - Music 26
  - Nature 66
  - Noise 6
- 场景覆盖：Sleep 5/5、Calm 5/5、Focus 6/6，共 16/16
- Voice/TTS：不属于本次 Beta，任何可听人声必须 fail closed
- 必须公开署名的素材：8 条；公开分享、移动端 credits 和导出公开作品元数据必须保留 source、license 和 adaptation notice

## 2. 移动/播放组应使用的内容边界

1. 只能播放发布清单 `items` 中列出的音频 URL。
2. 不得从 `public/audio/candidates`、试听页、QA 输出、loop master 或临时 render 目录自动发现素材。
3. 长时会话由 Recipe V2 的循环、淡入淡出、时间结构和确定性种子完成；不能要求单个 Stem 文件本身达到 30/60/90/120 分钟。
4. 离线缓存与恢复必须以 `fileSha256` 校验文件身份；哈希不一致时不得静默播放。
5. 多轨播放必须保留 Recipe V2 的 Stem、音量、mute、起止时间、循环和自动化关系，不能把“只成功播放一个轨道”算作配方通过。
6. 用户明确排除水声、鸟声、音乐、明亮高频或其他声音时，移动端恢复和离线回放不得绕过排除项。
7. Voice 类、历史 Voice 轨和 TTS 结果不得进入 Live Mix、冻结版本、离线包、系统媒体恢复或最终渲染。
8. 当活跃 Recipe 使用 8 条 attribution-required Stem 中任意一条时，公开展示必须包含对应 credit、source link、license link 和“已在 SNOOZE 声景中循环/裁剪/混合/分层使用”的改编说明。

## 3. 内容侧已完成的门禁

- 111/111 发布文件存在。
- 111/111 SHA256 与数据库记录一致。
- ffprobe 的时长、采样率与声道记录一致。
- source、creator、license 和本地权利证据完整。
- V3 语义、角色、概念和审核状态完整。
- Voice-free 检查通过。
- 有效内容覆盖为 16 covered / 0 partial / 0 gap。
- approvedFilesMissing=0，hashMismatches=0。

## 4. 移动/播放组负责验证的事项

以下不是内容组已完成证据，必须由移动/播放组在真实设备上验证：

- iOS/Android 前台、后台与锁屏连续播放。
- 来电、闹钟、耳机拔插、蓝牙切换和音频焦点中断后的暂停/恢复。
- 30/60/90/120 分钟多轨会话稳定性。
- 系统媒体控制的播放、暂停、上一段/下一段或 seek 行为。
- App 被系统回收或重启后的 Recipe、进度、音量和排除项恢复。
- 离线状态下冻结版本的完整多轨或等价渲染回放。

## 5. 交接前自检命令

```bash
pnpm audit:assets
pnpm report:effective-coverage-v3
pnpm report:content-release-manifest
pnpm validate:content-release-baseline
pnpm report:release-attribution-credits
pnpm validate:attribution-credits
pnpm validate:voice-free-beta
```

如果内容基线验证失败，不应通过更新期望值来绕过；应回到具体 Stem、版权证据、音频文件或语义记录定位变化，并重新走内容审核和批准流程。
