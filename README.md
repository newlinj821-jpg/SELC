# Sanctum Eros Leadership Committee (SELC)

SELC is Sanctum Eros's **internal leadership and operations committee**. Its public website and authenticated Headquarters are hosted at https://se-selc.netlify.app/.

## Three connected websites with distinct responsibilities

| Site | Responsibility |
| --- | --- |
| [Sanctum Eros Hub](https://sanctumeroshub.org/about/) | Public identity, mission, venue, community participation, education resources and introductory event guidance |
| [Member Portal](https://sanctumportal.org/) | Authoritative Dungeon Rules, membership vetting, event admission and pricing, RSVPs, courses, member records, messages, safety reports and Staff assignments |
| [SELC](https://se-selc.netlify.app/) | Committee structure, leadership applications, authorized operational work, feedback and governance |

Do not duplicate a full event price table, Dungeon Rules, vetting form or member record inside SELC pages. Explain the committee's responsibility and link to the Portal for official processes or to the Hub for the organization’s purpose.

## Committee structure

The leadership structure provides **two Coordinator seats, four Representative seats and two Advisor seats**, alongside the **Founder/Director**. These are authorized positions, not a statement that every seat is currently occupied.

- **Coordinators** oversee designated operational and administrative duties within the authority granted to their role.
- **Representatives** help with approved member applications, RSVPs, member communication and event operations.
- **Advisors** bring member perspectives, evaluate feedback and suggestions, and participate in eligible internal proposals. Advisors do not independently approve membership, access restricted IA cases, admit attendees or issue bans.
- **Staff and Dungeon Monitors** have separate event duties, approval and training requirements. A committee role does not grant Staff privileges.
- **Internal Affairs and access restrictions** are handled by the specific authorized role holders and processes. Filing a report does not establish wrongdoing.

SELC positions are internal to Sanctum Eros; applicants must hold the required active SE membership and complete the applicable review and certification. The organization membership is free and available to adults 18+, but Dungeon Nights and Kinky Game Nights are 21+. Other public events follow their posted requirements.

The former external **Community Leaders network is retired**; its old public route is an informational notice and not an application or sign-in pathway.

## Authentication and access

- Approved committee members and the Founder use their existing [Portal account](https://sanctumportal.org/member.html).
- The dedicated handoff starts at https://sanctumportal.org/selc-connect.html.
- Portal server-side permissions are authoritative. The local `portal-gateway` is only a transport fallback, not an authorization bypass.
- Staff scheduling, shift assignments and member tickets belong in the Portal. SELC may display authorized operational information but must not create a second assignment system.
- The online committee site is not a public incident-report repository. Confidential reports are made using https://sanctumportal.org/safety.html.

## Deployment

- GitHub repository: `newlinj821-jpg/SELC`
- Production branch: `main`
- Netlify project: `se-selc`
- Publish directory: `.` using `netlify.toml`
- Changes to SELC do not deploy the Hub or Member Portal.

## QA

Run `node qa/smoke.mjs` and `node --test tests/*.test.mjs`. The `selc-smoke.yml` workflow checks frontend syntax and basic integration contracts; other release workflows check safe browser and service behavior.

After merging, verify the deployed build matches the merge commit, check public desktop/mobile navigation, and test Portal sign-in/handoff with an authorized safe test account. A successful source commit, preview build, or public HTTP 200 is not proof that authenticated production workflows work.

## Historical materials

Earlier role structures and external Community Leaders materials may appear in historical implementation documents. They are not current operating policy; public SELC pages and authoritative Portal permissions take precedence.
