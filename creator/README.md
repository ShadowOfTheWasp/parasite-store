# Parasite Hub Remote

Phone chat interface for the authenticated Parasite owner at https://parasite-creator.vercel.app/. Deploy these files to the existing Vercel project using its existing production environment. Add the page to the iPhone Home Screen through Safari.

The owner submits natural-language instrument build requests. A background worker checks the Supabase queue approximately hourly. The interface shows queue state, worker notes and verified published release links. This interface has no immediate conversational model endpoint. Follow-ups include the prior brief and release URL so the worker can revise the intended instrument.

Drafts are local to the phone and keyed by the selected request. Submitted briefs and statuses are kept in the existing private queue. Access uses the existing owner code and HttpOnly cookie. The interface cannot change queue states. Secrets are stored in Vercel environment variables and are excluded from source control. Do not apply queue.sql to an existing deployment. It documents initial provisioning.

The Fire Hub and instrument publication continue through the existing parasite-store GitHub Pages workflow. This deployment updates the phone portal only.
