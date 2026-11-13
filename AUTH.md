# BasePay account sign-in

This branch adds passwordless email sign-in via **Supabase Auth**; PostHog remains a separate, consent-based analytics system.

## Setup needed before sign-in works

1. Create a Supabase project at https://supabase.com/dashboard.
2. In **Authentication → Providers → Email**, enable email authentication and email OTP/magic link.
3. In **Authentication → URL Configuration**, set Site URL to your actual deployed BasePay site and add the exact deployed site URL to Redirect URLs. Include the GitHub Pages URL if testing there. Do not use a wildcard for production.
4. In Cloudflare Pages project **Settings → Environment variables**, set `SUPABASE_URL` to the Supabase project URL and `SUPABASE_ANON_KEY` to the **public anon/publishable key** (never a service_role/secret key). Add `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` if using PostHog.
5. Set Cloudflare Pages **build command** to `node scripts/build.mjs` and **build output directory** to `dist`, then redeploy.
6. Visit the deployed site, select **Sign in**, enter a real email address, follow the emailed link, and confirm that your account email appears and **Sign out** works.

**Important:** GitHub Pages direct-source deployment does **not** have the build-time Supabase settings, so account sign-in displays a configuration notice there. This intentionally prevents accidental disclosure of private keys. If using GitHub Pages, build locally with public keys and publish the generated `dist` output.

**Security and privacy:** Supabase handles users, session tokens and verification links. No passwords are stored by BasePay. The client uses only public project keys; enforce RLS for any future database tables. Do not treat email login as protection for simulator data: existing saved progress is only in this device's localStorage, not synced or backed up. Review your privacy notice for account emails handled by Supabase. Supabase's default email provider has sending limits; set up custom SMTP for production.

The PostHog wizard command `npx -y @posthog/wizard@latest` is an interactive local setup utility, **not** source code to paste into HTML. BasePay already has a consent-gated browser SDK: configure `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` to activate it. Don't insert a second wizard-generated SDK, which could duplicate events.
