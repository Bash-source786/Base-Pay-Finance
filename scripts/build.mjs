import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
const token = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST;
if (!token || !host) throw new Error('Set POSTHOG_PROJECT_TOKEN and POSTHOG_HOST before building.');
if (!/^phc_[A-Za-z0-9]+$/.test(token)) throw new Error('Use a public PostHog project token, never a personal API key.');
if (!['https://eu.i.posthog.com','https://us.i.posthog.com'].includes(host)) throw new Error('Set your regional PostHog ingestion host.');
mkdirSync('dist',{recursive:true});
for (const path of ['index.html','analytics.js','sitemap.xml']) copyFileSync(path,'dist/'+path);
writeFileSync('dist/analytics-config.js','window.BASEPAY_ANALYTICS_CONFIG = '+JSON.stringify({token,host})+';\n');
