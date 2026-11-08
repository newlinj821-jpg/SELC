# Sanctum Eros Leadership Committee (SELC)

The independent public website and private Leadership Headquarters for **Sanctum Eros Leadership Committee**. The public site, Community Leaders account flow, and authenticated Headquarters are hosted at [se-selc.netlify.app](https://se-selc.netlify.app/).

## Site roles and boundaries

SELC is the *internal* committee of Sanctum Eros, not an independent nonprofit or an organization-wide electorate. Eros is Founder & Chair and retains final approval over appointments, removals, publication, policy, financial decisions, and exceptional access. There are five Representative seats and at most two Coordinators, who remain counted within those five seats.

**An SELC Representative must:**
1. Hold an approved, active Sanctum Eros membership. Attending events or purchasing supporter membership is **not** required.
2. Complete a separate SELC application; approved SE membership alone does not qualify.
3. Receive Founder acceptance after review.
4. Complete the required, server-scored **SELC Representative certification**. Acceptance without a passing assessment grants no committee or voting privileges.

Existing Representatives seeking Coordinator appointment must complete the Coordinator application, meet the committee election requirement, receive Founder acceptance, and complete the **Coordinator certification** before advancement activates. Only the Founder and currently active Coordinators review SELC applications. Specialized Internal Affairs work has its own distinct authorization/certification and does not automatically follow every SELC role.

**Community Leaders** is separate. An owner/authorized organizer of another kink organization may sign in using an existing Portal account **or** create a separate verified organizer-only account, without joining Sanctum Eros. The Founder reviews applications. Approved organizers may communicate with SELC, Eros, and each other, and propose minimized safety notices subject to controlled disclosure approval. They do **not** receive SELC votes, Staff roles, internal case-file access, tickets, member applications, or venue permissions. There is **no External Advisor role**.

## System integration

- Canonical Portal & datastore: [sanctumportal.org](https://sanctumportal.org)
- Organization Hub: [sanctumeroshub.org](https://sanctumeroshub.org)
- SELC: [se-selc.netlify.app](https://se-selc.netlify.app)
- GitHub: `newlinj821-jpg/SELC`, **production branch `main`**
- Netlify: **`se-selc`** project; publish directory `.`; use existing `netlify.toml`
- Authentication and password recovery reuse Portal services; no second password database.
- Cross-site requests use Portal-issued sessions and the allowlisted SELC origin. The local `portal-gateway` is a same-origin transport fallback and cannot confer authorization.

## QA

Run source smoke checks with `node qa/smoke.mjs` and `node --test tests/*.test.mjs`. The `selc-smoke.yml` workflow validates source and syntax. The `selc-browser-certification.yml` workflow uses isolated Playwright sessions to verify committee acceptance, certification attempts, activation, and organizer isolation without creating or accessing real member data.

**Deployment checks:** verify the production Netlify build for the exact merged `main` commit, public route navigation, Community Leaders verification and recovery, Portal sign-in/handoff, and authenticated operation with safe controlled test accounts. A successful preview build is not proof that private production workflows are live.
