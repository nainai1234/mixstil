# 个性化冥想声景分享自传播机制 V2

日期：2026-07-13  
状态：已被 [分享机制产品方案 V3](./sharing-mechanism-product-design-v3-2026-07-13.md) 替代  
替代方案：[个性化冥想声景分享与自传播机制研究 V1](./sharing-growth-mechanism-research-2026-07-13.md)

## 1. 这次修正了什么

V1 的主要问题不是功能少，而是传播关系定义错了：

- 把接收者分成“客户”和“好友”，形成两套体验。
- 把接收者主要当作听众，传播仍然是单向交付。
- “为我生成一段”只是分享页末尾的获客 CTA，没有成为作品继续生长的机制。
- 过多讨论品牌页、客户管理和服务者分析，弱化了自传播最关键的“接收者参与”。

V2 作出三个产品决策：

1. **所有接收者统一称为朋友。** 不在接收页判断对方是客户、学员、粉丝还是私人好友。
2. **所有分享统一为声音邀请。** 发送者身份和使用目的可以不同，但朋友收到的是同一种简单体验。
3. **接收者必须能参与作品，而不只是消费作品。** 分享后的核心动作是基于原 Recipe 做一次低成本、可解释的个性化调整，并产生一份可继续分享的新版本。

## 2. 新的一句话定义

> 用户不是把一段音频发给朋友，而是发出一个声音邀请：朋友先听到这段声音，再用一个选择把它调成更适合自己的版本，并可以继续传给下一个朋友。

最终传播链：

```text
A 描述需求并得到 Live Mix
-> A 确认并冻结 Recipe Version A
-> A 发出声音邀请
-> B 打开即听 A 的版本
-> B 用一次轻选择参与调整
-> 系统生成有来源关系的 Recipe Version B
-> B 听到自己的版本并保存
-> B 把自己的声音邀请发给 C
-> C 继续参与
```

这比“制作 -> 分享页 -> 播放 -> 注册”更强，因为每个接收者都会获得一个新的、属于自己的传播资产。

## 3. 为什么其他产品能自传播

本轮新增调研的重点不是分享按钮，而是“接收者为什么愿意参与并继续传播”。

| 产品 | 核心机制 | 自传播成立的原因 | 对 SNOOZE 的直接启发 |
| --- | --- | --- | --- |
| Spotify Blend | 一个人发邀请，朋友接受后，系统基于双方偏好生成共同歌单；同时生成 Taste Match 分享卡 | 接收者的加入改变了结果；结果属于双方，而不是发送者单方面交付 | 分享后应生成“共同声景”，朋友的一次选择必须真正改变 Recipe |
| CapCut Templates | 用户看到一个成品后，可直接 Use Template，用自己的素材快速生成新成品 | 每个被传播的结果同时是下一次创作的入口 | 每个分享页都应提供低门槛 Recipe fork，而不是要求从空白 Prompt 开始 |
| Instagram Reels Templates | 模板预载音频与片段位置，用户只需放入自己的内容 | 保留稳定结构，降低参与成本，同时保证产出仍有个人差异 | 继承配方骨架，只让朋友调整一两个对体感最明显的维度 |
| Duolingo Friend Streak | 朋友接受邀请后，双方都要行动才能维持共同 streak | 分享建立持续的共同关系，而不是一次点击 | 有真实复听后可建立“今晚一起听”或共同练习，不应首版就做社区 |
| Wordle | 分享不泄露答案的结果格，既表达成绩，又制造好奇 | 分享卡暴露足够的结果，但保留必须亲自体验的部分 | 社交卡只展示声景结构和一句邀请，不直接塞入完整长音频或敏感描述 |
| Dropbox Referral | 推荐成功后奖励与核心价值直接相关的存储空间 | 奖励发生在对方完成有效激活之后，且奖励能继续促进使用 | 若做奖励，应在朋友有效试听或保存 fork 后增加作品额度，不奖励复制链接 |
| Calm Guest Pass | 会员把完整 Premium 体验送给朋友 | 接收者先获得明确价值，发送者是在赠送而不是拉人头 | 朋友首次进入应完整试听，不要先注册、付费或下载 App |
| myNoise | 用户调好的参数写入 URL，别人打开就是同一声音 | 分享对象本身可用且稳定复现 | 每个邀请必须绑定冻结 Recipe Version，不能每次打开重新随机生成 |

### 3.1 六种传播动力

优秀自传播机制通常至少命中其中三种：

1. **礼物价值**：我把一个现在就能用的东西送给你。
2. **关系价值**：这是“我们共同的一段”，不是陌生内容链接。
3. **参与价值**：我的一个动作真的改变了结果。
4. **表达价值**：结果能够表达我的状态、品味或关心，但不过度暴露隐私。
5. **生产价值**：我参与后自动得到自己的作品，不需要从零开始。
6. **持续价值**：这段作品可以复听、继续调整和再次分享。

V1 主要只有礼物价值和少量生产价值。V2 应同时建立礼物、关系、参与、生产和持续价值。

## 4. 唯一分享对象：声音邀请

产品内不再出现：

- 分享给客户。
- 交付卡。
- 客户版本。
- 客户 Portal。

产品统一使用：

- 发给朋友。
- 声音邀请。
- 一起调一段。
- 朋友的版本。

专业用户仍然可以把链接发给学员或付费用户，但接收者看到的仍是自然、平等的朋友体验。专业能力体现在发送者身份、作品质量、批量效率和数据，而不是另一套接收流程。

## 5. 完整用户流程

### 5.1 发送者

用户确认 Live Mix 后：

```text
保存并冻结
-> 点击“发给朋友”
-> 可选写一句话
-> 系统生成声音邀请
-> 调用原生分享 / 复制链接
```

默认分享文案：

> 我刚调了一段今晚想听的声音，也想让你听听。你可以把它调成更适合你的版本。

如果发送者是专业创作者，可以显示经过设置的名称、头像和一句介绍，但不改变接收流程。

### 5.2 朋友打开邀请

首屏只解决三个问题：谁发的、为什么值得听、如何开始。

```text
[发送者头像] Pang 邀请你听一段声音
“今晚想安静一点，也想让你听听。”

[播放]
轻雨 · 温暖氛围 · 少量人声 · 12 分钟
```

规则：

- 无需注册。
- 不自动播放，避免浏览器限制和社交打扰。
- 点击后立即开始，不等待重新生成或完整渲染。
- 首屏不出现价格、下载 App、创作工作台或专业参数。
- 不展示发送者的原始 Prompt、系统推断的情绪或敏感需求。

### 5.3 从听众变成参与者

朋友播放 30–60 秒后，在不中断声音的情况下出现：

> 想把它调得更适合你一点吗？

首版只给四个单选动作：

- 更安静。
- 更温暖。
- 少一点人声。
- 就这样，很适合我。

这些动作必须映射到确定性 Recipe Patch：

| 用户选择 | Recipe Patch 示例 |
| --- | --- |
| 更安静 | 降低 accent/voice，收窄动态变化，环境层小幅降低 |
| 更温暖 | 在兼容范围内替换或提高 warm pad，降低高频点缀 |
| 少一点人声 | 降低 voice density 或关闭后续 voice phase |
| 就这样 | 保留原 Recipe，只建立朋友的保存副本 |

不要让朋友回答问卷，也不要立刻回到完整 Quick Create。一次选择后应在几秒内听到变化。

### 5.4 产生“共同声景”

调整完成后页面表达：

```text
你和 Pang 的共同声景

保留：轻雨、温暖氛围
你的调整：更少人声

[播放新版本]
[保存到我的声音]
[发给另一位朋友]
```

这里不使用虚构的“默契度 92%”或疗效分数。关系感来自真实共同元素和真实调整。

### 5.5 注册时机

- 播放原版本：不注册。
- 试听调整后的版本：不注册。
- 临时保存到当前设备：不注册。
- 跨设备保存、继续编辑或再次分享：再要求创建轻量账号。

用户应在得到第二次价值，也就是听到自己的版本之后，才遇到账号门槛。

## 6. 三条传播循环

### 6.1 主循环：Recipe Fork Loop

```text
作品 A
-> 邀请
-> 朋友调整
-> 作品 B
-> 再邀请
-> 作品 C
```

这是首版必须成立的循环，对应 CapCut 的“成品也是模板”。

每个 fork：

- 继承源作品允许公开继承的 Recipe 骨架。
- 创建新的 `AudioIntent` 补丁、Recipe Version、所有者和随机种子。
- 不继承私人 Prompt、留言、接收者身份或敏感字段。
- 保留内部来源关系，用于归因和质量分析。
- 源作品后续修改不影响已经生成的 fork。

### 6.2 关系循环：Shared Sound Loop

```text
A 邀请 B
-> B 调整
-> 形成共同声景
-> A 收到“朋友已经听过并完成调整”
-> A 回来听共同版本
```

通知必须由 B 同意后才发送。只反馈“已听”和调整后的公开特征，不反馈 B 的情绪、使用时间或私人输入。

### 6.3 复听循环：Friend Ritual Loop

只有单次分享和复听数据成立后再做：

```text
A 与 B 保存共同声景
-> 约定今晚或本周一起听
-> 双方分别完成一次播放
-> 形成真实的共同练习记录
-> 可分享低敏感结果卡
```

这对应 Duolingo Friend Streak，但首版不做 streak、排行榜和高压提醒。冥想产品不能让“放松”变成新的任务焦虑。

## 7. 社交分享卡

分享卡的任务是制造好奇和关系感，不是解释产品功能。

### 私聊链接预览

```text
Pang 邀请你听一段声音
轻雨 · 温暖氛围 · 12 分钟
听完可以调成你的版本
```

### 朋友圈 / Story 卡

展示：

- 作品封面或真实声景视觉。
- 三个声音元素。
- 时长。
- “我今晚在听”。
- 二维码或深链。

不展示：

- “焦虑”“失眠”“创伤”等敏感推断。
- 医疗效果。
- 完整 Prompt。
- 夸张的频率、脑波或疗效标签。

### 共同声景卡

展示真实共同结果：

```text
我们共同保留了：轻雨 + 温暖氛围
我把人声调少了一点
```

这借鉴 Spotify Blend 的关系表达和 Wordle 的低泄露分享，但不制造虚假匹配分数。

## 8. 专业用户如何获得商业价值

统一“朋友”不等于放弃专业用户。专业版卖的是发送效率、身份和反馈，而不是把接收者标成客户。

### Free

- 发出普通声音邀请。
- 朋友可完整试听和生成一个 fork。
- 查看邀请打开数和有效试听数。

### Pro

- 专业头像、名称和主页入口。
- 自定义邀请短语和封面。
- 为同一作品生成不同来源链接或二维码。
- 批量创建邀请，但仍由专业用户在自己的渠道发送。
- 查看各来源的打开、首播、有效试听、调整和保存。
- 作品系列和后续内容入口。

专业用户仍可在邀请页下方放一个克制的 CTA，例如“查看老师的更多声音”或“预约下一次练习”，但必须在朋友开始播放之后出现，且不能压过“一起调一段”。

## 9. 激励机制

### 首版不奖励分享动作

以下行为不奖励：

- 点击分享按钮。
- 复制链接。
- 生成海报。
- 发送给多少联系人。

因为这些行为不能证明朋友获得了价值，而且容易制造骚扰。

### 只奖励有效传播

奖励触发建议：朋友完成有效试听，并且试听了自己的 fork。

双方奖励可以是：

- 各增加一个短作品保存位。
- 解锁一个非核心封面。
- 解锁一次更长时长试听。

不使用现金，不把核心睡眠/放松能力锁在邀请之后，不要求朋友继续拉人。

这借鉴 Dropbox 的“激活后奖励”，但奖励必须与继续创作和复听相关。

## 10. 数据模型

### 10.1 Sound Invitation

```text
sound_invitations
  id
  slug
  sender_id
  source_mix_id
  source_recipe_version_id
  message
  visibility
  expires_at
  revoked_at
  source_channel
  created_at
```

不需要 `client_mode`、`recipient_type` 或 `delivery_mode`。

### 10.2 Recipe Fork

```text
recipe_forks
  id
  invitation_id
  parent_recipe_version_id
  child_mix_id
  child_recipe_version_id
  anonymous_friend_id
  selected_adjustment
  recipe_patch
  ownership_claimed_by
  created_at
```

### 10.3 事件

```text
invitation_created
-> native_share_opened / link_copied
-> invitation_opened
-> playback_requested
-> playback_started
-> meaningful_listen
-> adjustment_selected
-> fork_ready
-> fork_playback_started
-> fork_saved
-> fork_shared
-> sender_returned_to_shared_version
```

每个关键事件都应关联 `invitation_id`、匿名朋友 ID、来源渠道和 Recipe Version。

## 11. 指标

### 北极星指标

> 每周由声音邀请带来的朋友有效声景体验数。

有效声景体验定义为：朋友完成有效试听，或开始播放自己调整后的 fork。

### 主漏斗

- 保存作品 -> 创建邀请率。
- 邀请创建 -> 实际发送率。
- 发送 -> 打开率。
- 打开 -> 首播率。
- 首播 -> 有效试听率。
- 有效试听 -> 选择调整率。
- 调整 -> fork 首播率。
- fork 首播 -> 保存率。
- fork 保存 -> 再分享率。

### 自传播系数

```text
Fork K-factor
= 每名邀请发送者带来的 fork 保存用户数
  × fork 保存用户的再分享率
```

不要用页面 PV、分享按钮点击或注册链接点击计算 K-factor。

### 质量护栏

- 分享页首播耗时 P50/P95。
- Recipe Patch 失败率。
- fork 后立即退出率。
- 邀请撤销率和举报率。
- 每个有效 fork 的生成成本。
- 被分享 Recipe 的授权与 QA 阻断率。

## 12. 首轮实验

### 实验 A：单向分享与参与式邀请

- A 组：播放原作品 + 收藏。
- B 组：播放原作品 + 一次调整 + fork。

核心判断：B 组是否提高保存率和再分享率，而不是只提高按钮点击率。

### 实验 B：参与动作出现时机

- A 组：打开页面立即出现“一起调一段”。
- B 组：播放 45 秒后出现。

预期 B 组参与人数可能更少，但 fork 首播和保存质量更高。

### 实验 C：关系语言

- A 组：“为我生成一段”。
- B 组：“一起调成更适合你的版本”。

判断有效试听到 fork 首播的转化。B 组更可能保持发送者与朋友的关系感。

### 实验 D：四个 Recipe Patch

分别观察“更安静、更多温暖、减少人声、保持不变”的选择分布、fork 完播和再次调整率。高失败选项应收窄规则，不靠增加更多选项解决。

### 实验 E：有效传播奖励

- A 组：无奖励。
- B 组：朋友试听 fork 后，双方各增加一个短作品保存位。

同时观察再分享率、无效邀请率和举报率。

## 13. P0 实现范围

当前只实现能验证主循环的最小集合：

1. Published Recipe Version 生成稳定、可撤销的声音邀请 slug。
2. 朋友无需登录即可点击播放原版本。
3. 播放后出现四个确定性 Recipe Patch。
4. Patch 在几秒内生成并播放 fork，Live Mix 与冻结语义继续一致。
5. 朋友在听到 fork 后可保存并再次分享。
6. 完整采集邀请、首播、有效试听、Patch、fork 首播、保存和再分享。
7. 分享前统一执行授权、QA 和公开表达检查。

P0 不做：

- 客户管理和客户 Portal。
- 复杂专业主页。
- streak、排行榜和社群。
- 现金奖励。
- 多人同时在线混音。
- 任意开放式 Prompt 继承。
- 复杂海报编辑器。

### P0 退出门槛

- 10–20 名发送者发出真实声音邀请。
- 至少 50 次朋友打开。
- 能得到可解释的打开、首播、有效试听和 fork 数据。
- 至少 10 个朋友开始播放 fork。
- 至少 3 个朋友保存 fork。
- 至少观察到 1 次自然再分享；这是方向信号，不是规模结论。
- fork 不能破坏 Recipe V2 的可复现性、授权门槛和首播速度。

## 14. 产品决策

建议正式采用以下分享机制：

> 分享不是把完成品交给一个被动听众，而是邀请一个朋友进入作品。朋友先获得即时体感，再用一次选择改变作品，得到一份属于自己的可复现声景，并自然成为下一位分享者。

其中：

- “声音邀请”是唯一分享对象。
- “朋友”是唯一接收者角色。
- “一起调一段”是核心参与动作。
- “Recipe fork”是自传播的技术基础。
- “fork 保存后再分享”是产品真正要验证的增长结果。

## 15. 官方资料

- [Spotify: Blend Creates a Playlist for You and Your Bestie](https://newsroom.spotify.com/2021-08-31/how-spotifys-newest-personalized-experience-blend-creates-a-playlist-for-you-and-your-bestie/)
- [Spotify: Blend With More Friends and Family](https://newsroom.spotify.com/2022-03-30/discover-and-listen-to-music-with-even-more-friends-and-family-plus-some-of-your-favorite-artists-with-spotifys-newest-blend-update/)
- [CapCut: How to Use and Export Templates](https://www.capcut.com/help/use-and-export-templates-in-capcut)
- [Meta: Reels Templates and Remix](https://about.fb.com/news/2022/07/new-ways-to-create-instagram-reels-remix/)
- [Duolingo: Friend Streak](https://blog.duolingo.com/friend-streak/)
- [Duolingo: Friends Quests](https://blog.duolingo.com/friends-quests/)
- [The New York Times: The Sudden Rise of Wordle](https://www.nytimes.com/2022/01/31/crosswords/nyt-wordle-purchase.html)
- [Dropbox: Refer Friends to Earn Space](https://help.dropbox.com/storage-space/earn-space-referring-friends)
- [Calm: Guest Passes](https://support.calm.com/hc/en-us/articles/360017887793-How-to-Share-Redeem-Calm-Guest-Passes-30-Day-Free-Trial)
- [myNoise: Save and Share Settings](https://mynoise.net/NoiseMachines/help.php)
