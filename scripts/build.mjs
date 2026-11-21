import { writeFileSync, mkdirSync, copyFileSync, cpSync } from 'node:fs';
const token = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST;
const validToken = /^phc_[A-Za-z0-9]+$/.test(token ?? '');
const validHost = ['https://eu.i.posthog.com', 'https://us.i.posthog.com'].includes(host);
const analyticsConfig = validToken && validHost ? { token, host } : null;
if (!analyticsConfig) {
  console.warn('PostHog disabled. Set POSTHOG_PROJECT_TOKEN to a public project token and POSTHOG_HOST to its regional ingestion host.');
}
mkdirSync('dist',{recursive:true});
for (const path of ['index.html','privacy.html','analytics.js','sitemap.xml','robots.txt','site.webmanifest','favicon.ico','apple-touch-icon.png','supabase-config.js','basepay-cloud.js','basepay-auth.js']) copyFileSync(path,'dist/'+path);
cpSync('assets', 'dist/assets', { recursive: true });
writeFileSync('dist/analytics-config.js','window.BASEPAY_ANALYTICS_CONFIG = '+JSON.stringify(analyticsConfig)+';\n');

