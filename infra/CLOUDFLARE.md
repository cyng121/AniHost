# Cloudflare deployment

Both services deploy from the repository, branch `main`:

| Worker | Repository root | Build | Deploy |
| --- | --- | --- | --- |
| `anighost` | `/` | `npm run build:cloudflare` | `npm run deploy:cloudflare` |
| `ani-ghost-api` | `/api-worker` | `npm run build` | `npm run deploy` |

The website runtime variable `ANIGHOST_API_BASE` connects to the catalogue provider. Keep
`ANIGHOST_API_ORIGIN=https://senpaiflix.fun` to match the backend
origin allowlist. Existing secrets remain in Cloudflare, outside git.

The API worker contains the Hono catalogue provider source. Its
origin checks preserve the backend allowlist. Update provider
code under `api-worker/src`; changes to main trigger the linked Worker build.

The frontend uses the OpenNext Cloudflare adapter. Native `sharp` decoding is
optional and cannot be imported while loading a page in Workers. The theme
palette is used in Workers; Node retains optional image-derived palettes.

After a deployment, verify `/browse`, `/manga`, a title, search, and playback.
Do not point the website back to the unavailable Vercel API. Do not use a
dashboard-only code change as the source of future builds.
