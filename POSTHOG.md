# BasePay analytics (PostHog)

The project already includes a consent-controlled PostHog browser integration. You do not need to paste `npx -y @posthog/wizard@latest` into the website: it is a CLI wizard, not browser code.

## Cloudflare Pages

Build command: `node scripts/build.mjs`; output directory: `dist`. Node 20.12+ recommended. No npm installation needed.

Configure `POSTHOG_PROJECT_TOKEN` (the public `phc_` token) and `POSTHOG_HOST` (`https://eu.i.posthog.com` or `https://us.i.posthog.com`). Set both variables or leave both unset to disable PostHog. Redeploy after changing environment variables. Never enter your PostHog personal API key.

You can also configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` for sign-in (see AUTH.md); PostHog and authentication can be enabled independently.

For local builds, copy `.env.example` to `.env`, fill any desired public configuration, and run `node --env-file=.env scripts/build.mjs`. Serve `dist` via HTTP. Never commit `.env`.

Source-only GitHub Pages deployments have analytics disabled; generated builds are required for configuration.

## Privacy and events

The analytics SDK only loads after Allow analytics. Visitors can withdraw through Analytics preferences. Prior to consent, events are not sent. Autocapture, session replay and surveys are disabled. No financial values, saved-game content, names, email addresses or free-text answers are sent as custom event properties. Authenticated users are not automatically identified in PostHog.

Custom events: simulator_started, simulator_resumed, section_viewed, lesson_started, lesson_step_viewed, quiz_answered, lesson_completed.

## Verification

Decline consent and confirm there are no PostHog calls. Accept consent, use the simulator, and inspect events in PostHog Activity. Withdraw consent and confirm no further events. Live ingestion requires a deployed site and a real consented visit.

References: https://posthog.com/docs/libraries/js and https://posthog.com/docs/privacy/data-collection
