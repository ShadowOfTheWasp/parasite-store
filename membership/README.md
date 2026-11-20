# Parasite Members Hub

Separate Vercel deployment rooted at this directory. The Fire launcher and GitHub Pages release workflow on main stay on the 1.1.0 baseline. The web Hub is an independent Wi-Fi entry point and can be opened in Silk. Member APKs are provisioned separately from the public instrument catalogue.

## Preview and launch

- With no billing environment set, the Hub is an interactive preview. All payment, authentication and download API operations return 503.
- For Stripe test mode, set `PARASITE_BILLING_MODE=test` with a matching test secret and an active recurring GBP price for 499 pence per month in `STRIPE_PRICE_ID`. Enable the Stripe customer portal with cancellation settings.
- Set `APP_ORIGIN` to the deployed Hub's exact HTTPS origin. In its dedicated Supabase project, run `setup.sql`. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`. Enable email authentication and set the email sign-in template to show `{{ .Token }}`. Configure outbound mail before opening sign-in to members.
- Upload member-only APKs to the private `parasite-members` bucket. Set `PARASITE_PRIVATE_RELEASES` to a JSON array of records such as `[{"id":"new-module","title":"New Module","path":"new-module/v1.apk"}]`. The API checks subscription status on every protected request and signs only configured files for two minutes. An APK already installed on a device remains playable offline.
- To accept live payments, configure the live Stripe price and secret, put at least one member release in private storage, and select `PARASITE_BILLING_MODE=live`. Check tax, customer terms, and the hosting plan before enabling live billing. Existing public APK links continue to work. Paid releases should be kept out of the public catalogue and public GitHub Pages uploads.
