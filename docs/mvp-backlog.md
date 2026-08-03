# MVP Backlog

> Historical backlog superseded on 2026-07-14 by
> [ToC Product Development Master Plan](./toc-product-development-master-plan.md)
> and [Project Mainline Charter](./project-mainline-charter.md). Creator-first
> milestones below are reference material, not current execution priority.

## Milestone 1: Product Foundation

- Define listener, creator, and platform roles.
- Define sound asset schema.
- Define template schema.
- Define work schema.
- Define share-page analytics events.
- Define review and featured status model.

Acceptance:

- A creator can own multiple works.
- A work can be private, shared, reviewable, rejected, or featured.
- Each shared work has a stable public slug.
- Analytics events can be linked to a shared work.

P0 data entities:

- User.
- CreatorProfile.
- SoundAsset.
- SoundTemplate.
- Work.
- WorkMetrics.
- ReviewApplication.
- AnalyticsEvent.

## Milestone 2: Creator Workbench

- Template picker.
- Asset picker.
- Duration selector.
- Layer controls.
- Voice guidance toggle.
- Preview player.
- Save work.
- Duplicate work.
- Rename work.
- Delete work.

Acceptance:

- A creator can produce a draft from a template.
- A creator can preview the soundscape before sharing.
- A creator can manage saved works from one library view.

P0 screens:

- Creator Home.
- Scene Picker.
- Template Picker.
- Mixer Workbench.
- Work Metadata.
- My Works.

## Milestone 3: Public Share Page

- Public work URL.
- Cover/title/creator display.
- Audio player.
- Favorite action.
- Share action.
- Creator profile entry.
- Event tracking for visit, play start, 25%, 50%, 90%, favorite, share click.

Acceptance:

- A listener can open a shared link without logging in.
- The page records playback progress events.
- The creator sees aggregated metrics.

P0 screens:

- Public Work Page.
- Lightweight Login for favorite action.

P1 screens:

- Creator Public Profile.

## Milestone 4: Creator Analytics

- Plays.
- Unique visitors.
- Favorites.
- Share clicks.
- 50% completion rate.
- 90% completion rate.
- Top referrers when available.
- Entry-to-featured progress.

Acceptance:

- Creator can see whether a work is close to review eligibility.
- Dashboard explains the missing threshold in plain language.

P0 screens:

- Work Analytics.
- Share Tools.
- Entry-to-featured progress panel.

## Milestone 5: Review And Featured Pool

- Review eligibility check.
- Apply for review.
- Manual review queue.
- Approve as featured.
- Reject with reason.
- Hide or unpublish violating works.

Acceptance:

- Data threshold does not automatically publish to featured.
- A platform reviewer controls final inclusion.
- Rejected creators get a clear reason.

## Milestone 6: Paid Tool Layer

- Free plan limits.
- Paid plan limits.
- Premium templates.
- Premium assets.
- Longer duration.
- Advanced analytics.
- Larger work storage.

Acceptance:

- Free users can complete the MVP loop with limits.
- Paid users receive practical creation and distribution benefits.

P0 screens:

- Billing Upgrade.
- Locked premium template state.
- Locked premium asset state.
- Locked premium share tool state.

P0 value messages:

- Make better soundscapes with premium assets and templates.
- Share more professionally with cover, QR poster, and preview video.
- Understand performance with completion and referrer analytics.
- Build a creator presence with profile and larger work space.
