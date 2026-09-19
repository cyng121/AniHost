# Domain and DNS

Where anighost.com actually lives, and how to put it back if something clears it.

## The shape of it

| | |
|---|---|
| Registrar | Namecheap (`anighost.com`, auto-renew **on**, expires 22 Aug 2027) |
| Nameservers | **Namecheap BasicDNS** (`dns1`/`dns2.registrar-servers.com`) |
| DNS records | Held at Namecheap, pointing at Vercel (below) |
| Site | Vercel project `anighost`, deployed from `main` of this repo |
| Email | **Not set up** - see below |

The two records that matter:

| Type | Host | Value |
|---|---|---|
| A | `@` | `216.198.79.1` |
| CNAME | `www` | `3b4476dfdb62e8ff.vercel-dns-017.com.` |

`www` redirects to the apex with a **308 Permanent**, set in Vercel, so there is
one canonical host. That matches the canonical tags and the sitemap, which both
use `https://anighost.com`.

A note on the apex value, because it looks wrong and is not: `216.198.79.1` is
Vercel's **current** edge address. Vercel's own panel describes `76.76.21.21`
and `cname.vercel-dns.com` as *legacy* records that "will continue to work" -
so swapping the apex to `76.76.21.21` would move backwards, not forwards.

Vercel's own zone still exists on `ns1`/`ns2.vercel-dns.com` and still resolves
correctly. That is deliberate: while any resolver still holds the older
delegation, **both** nameserver sets answer with Vercel, so it stops mattering
which one a device asks. Leave it alone.

## Why it is set up this way

The obvious setup - point the nameservers at Vercel and let Vercel manage DNS -
was tried first and caused a real outage that was hard to see.

Namecheap kept an orphaned zone from the (now cancelled) shared hosting, and its
nameservers went on answering `anighost.com` with `198.54.126.124` long after the
delegation moved. Any resolver still holding the old delegation asked Namecheap
and got a dead host, while everyone else reached Vercel normally. The failure
looked random: the apex would break while `www` worked, then swap, depending on
which entry a given resolver had cached. Editing that zone was impossible while
the domain used Custom DNS - Namecheap only exposes host records once the domain
is on its own DNS.

Moving DNS to Namecheap BasicDNS and pointing it at Vercel fixed it, because the
poisoned nameservers became the correct ones. **Do not move the nameservers back
to Vercel** without first confirming Namecheap is no longer serving a stale zone.

If the half-broken symptom ever returns, check which server is answering before
suspecting the build:

```bash
curl -sI https://anighost.com/browse | grep -i '^server'
```

`Server: Vercel` is correct. `LiteSpeed`, `Apache`, or a cPanel error page means
the domain is resolving to Namecheap's hosting rather than Vercel.

## Email is not currently set up

The three MX records point at `mx*-hosting.jellyfish.systems`, which was the
mail service belonging to the cancelled shared hosting. **That service is gone,
so mail to anighost.com has nowhere to land.**

Nothing was lost with it: the package had zero mailboxes and zero bytes of mail,
so no address on this domain has ever received anything. But the records now
describe a destination that does not exist, which is worse than having none -
mail is routed toward a dead host rather than rejected outright.

Pick one when email is wanted:

- **Leave it.** Nobody can send to the domain either way. Fine while the site is
  the only thing that matters.
- **Remove the stale records** so mail fails immediately and honestly:
  ```bash
  vercel dns rm <record-id>   # ids from: vercel dns ls anighost.com
  ```
- **Point them at a real provider** - Namecheap Private Email, Google Workspace,
  Fastmail - using whatever MX records that provider gives you.

## Restoring the records

`infra/dns-anighost.com.json` holds the live record set. DNS now lives at
Namecheap, so restore it there: **Domain List -> anighost.com -> Advanced DNS ->
Host Records**, and re-add the A and CNAME from the table above.

There are only two records, and both are in this repo. Losing them takes the
site down; re-adding them takes about a minute.

## How a change travels

```
your machine
     |  git push
     v
anighost/anighost (main)
     |
     +----------------------------+
     |                            |
     |  Vercel git hook           |  sync-to-apiflix.yml
     v                            v
Vercel build                 cyng121/apiflix
     |                         (web/ only)
     v
anighost.com
```

**To Vercel** - already live. The project is connected to this repo with Root
Directory `.`, so a push to `main` builds and promotes to anighost.com on its
own, and any other branch gets a preview URL. Nothing to run by hand.

**To apiflix** - the workflow copies this tree into that repo's `web/`, which
is where the front end lives there; its backend sits at the root and is never
touched. The copy is rebuilt each run, so deleting a file here deletes it there.

The workflow needs a secret named `APIFLIX_PUSH_TOKEN` - a GitHub token with
push access to `cyng121/apiflix`. Add it under *Settings -> Secrets and
variables -> Actions*. Until it exists the job skips quietly instead of failing.

This is deliberately **one way**. Making the two repos write to each other means
the same file can change in both between runs, and there is no sensible
automatic answer to that. Edit here; apiflix follows.

## Checks worth keeping

```bash
curl -sI https://anighost.com/browse | grep -i '^server'   # expect: Server: Vercel
curl -sI https://www.anighost.com/    | grep -i '^server'   # expect: Server: Vercel
```

Confirm the previously poisoned nameservers are still answering correctly - this
is the check that would have caught the outage early:

```bash
nslookup anighost.com dns1.registrar-servers.com   # expect 216.198.79.1
```

Namecheap two-factor authentication is currently **off** on the account that
holds the domain. Everything above rests on that login.
