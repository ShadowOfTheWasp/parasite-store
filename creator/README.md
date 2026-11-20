# Parasite Creator

The iPhone Home Screen app is deployed separately to the existing `parasite-creator` Vercel project. The public Fire Hub remains the GitHub Pages site from the main branch. This Creator can capture a private request and show its status. It never loads or publishes a module itself.

Apply `queue.sql` to a dedicated Supabase database. Store the SHA-256 digest of a randomly generated server-to-database token in the single config row. Configure the production Vercel environment with `PARASITE_CREATOR_OWNER` (the owner's independent, random access code), `PARASITE_CREATOR_DB_URL`, `PARASITE_CREATOR_DB_KEY` (a publishable API key), and `PARASITE_CREATOR_DB_TOKEN` (the unhashed server-to-database token). Secrets must be configured outside Git. Serve the application at `https://parasite-creator.vercel.app`.

The phone can add and view its requests. A trusted worker with the connected database account claims requests and writes status updates. Publishing still uses the existing Parasite workflow. Rotate the owner access code to revoke past phone sessions. Cached files are the static interface only. Drafts stay on the phone until submitted.
