# GGLADMIN

Standalone copy of the GGL admin portal, based on `vpansak/gorakhpursgotlatent` at `f47ddc3`.

The root opens the admin portal. Public website navigation and the home link are omitted. The original email OTP and mobile/password forms authenticate through the existing GGL backend. Existing accounts, password hashes, OTP authorization, payment verification and role checks remain authoritative there. No passwords, application records, documents or database credentials are committed to this repository.

## Live data

`app/api/[...path]/route.ts` forwards only the explicit admin workflow allowlist to `https://www.gkpgotlatent.in`. Only the GGL session cookies are forwarded; they stay host-only and HTTP-only. API responses are private and never cached. Cross-origin mutations are rejected. The original backend checks authentication and roles for each protected operation.

Both portals operate on the same existing Neon database through that backend. There is no replication lag or separate database copy to reconcile. The visible dashboard checks for committed updates every second while online and visible, without overlapping refreshes. Network and server time can make display updates take longer. It pauses while hidden or offline and refreshes on return. Login is required separately on each hostname.

Includes applications, notes/status/payment controls, Excel and ZIP exports, Computer Ji scores, leads, tickets and scanning, invitations, Talent Trip and the operator room. Participant payment and form links continue to point at the original public website. Existing deletion, refunds and messaging controls still require the user's action; do not use them for verification.

## Deploy and verify

Deploy the `ggladmin` Vercel project from this repository. No new database or shared signing credentials are needed for the portal gateway. The old standalone password login is retired in favor of the existing GGL accounts. `admin.gkpgotlatent.in` must point at this project using its recommended CNAME in Vercel; DNS is managed separately.

```sh
npm ci
npm test
npm run build
```

After deployment, verify login with an existing administrator account, compare all category counts with the main portal, open a record and test a read-only export. Never create real payments, send messages, delete records or reset credentials as a test.
