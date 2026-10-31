# BasePay analytics

## Cloudflare Pages deployment
Set build command to `node scripts/build.mjs` and output directory to `dist`.
Set `POSTHOG_PROJECT_TOKEN` to the public project token and `POSTHOG_HOST` to the ingestion host from PostHog project settings, then redeploy. Use Node 20.12 or later. No npm dependencies are required.

For local builds, copy `.env.example` to `.env`, fill the values, run `node --env-file=.env scripts/build.mjs` and serve `dist` over HTTP. Never commit `.env` or use a personal API key. The public project token is expected to appear in the browser build.

Direct source deployments (including GitHub Pages branch deployments) continue working with analytics disabled. Deploy generated `dist` to activate analytics.

## Events and privacy
The SDK only loads after Allow analytics. Analytics preferences lets visitors withdraw consent. Events before consent are discarded. Autocapture, session replay and surveys are disabled. No financial values, saved-game contents, names or free-text answers are sent as custom properties. There is no login system, so no identify call is added.

| Event | Properties | Trigger |
| --- | --- | --- |
| `$pageview` | Standard SDK page properties | Page load after consent |
| `simulator_started` | None | New simulation |
| `simulator_resumed` | None | Saved simulation resumed |
| `section_viewed` | section | Different app section opened |
| `lesson_started` | lesson_id | Lesson opened |
| `lesson_step_viewed` | lesson_id, step | Lesson step displayed |
| `quiz_answered` | lesson_id, correct | Quiz answer submitted |
| `lesson_completed` | lesson_id | First successful completion |

## Live verification
Decline in a fresh browser session and confirm there are no PostHog network requests. Accept through Analytics preferences, start a simulation and complete a lesson; confirm events in PostHog Activity. Withdraw consent and verify no further events. Test blocked SDK loading to ensure learning continues. Live ingestion requires deployment and a real consented visit.

References: https://posthog.com/docs/libraries/js and https://posthog.com/docs/privacy/data-collection
