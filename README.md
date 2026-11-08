# Sanctum Eros Leadership Committee (SELC)

A separate, deployable website for the Sanctum Eros Leadership Committee.

## Deploy this initial website
1. In Netlify, choose **Add new project → Import an existing project → GitHub**.
2. Select `newlinj821-jpg/SELC` and use the `main` branch.
3. Leave the base directory and build command blank; publish directory: `.`.
4. Deploy and copy the generated `*.netlify.app` website URL.

The initial website is a **public shell**. It does not collect usernames/passwords, expose member records, or process applications/RSVPs. Its sign-in screen directs members to the existing Portal until secure authentication and SELC permissions are connected.

## Governance to enforce in the connected application
- Eros is **Founder & Chair**, with final authority over appointments, removals, spending, event publishing, rules, pricing, venue access, and exceptional decisions.
- Exactly five SELC Representative seats: three with physical and online participation; two with primarily online participation and optional physical participation.
- Representatives choose their own focus areas, share general SELC permissions, and can review/approve routine RSVPs and ordinary member applications after authorization.
- At most **two** Coordinators at once; Coordinators are elected from the active Representatives, require final appointment by the Chair, and retain one of the five seats.
- Only the Chair and active Coordinators can view/review **SELC membership applications**. Only active Representatives can apply for Coordinator.
- Coordinators have operational administration but cannot approve their own elevation, remove committee members, or bypass Chair final authorization. Deep IA access is separate and Chair-granted.
- Proposals and discussions encompass events, educational workshops, venue work sessions, equipment, prices, rules, and the dungeon guide. Venue work sessions and educational events require Chair approval before publication or physical access.
- SELC active members get free **individual** admission to SE events subject to eligibility, RSVP, and capacity rules.
- Use the existing Portal member identity for SELC and the separate Portal staff login; do not clone password databases. Actual DM shifts still require DM certification.

## Security / deployment
The separate site's production URL must be configured as an exact allowed origin in the Portal for cross-site identity handoff. A hostname has deliberately **not** been hardcoded before Netlify creates it.

**Status:** Deployable static website shell only. Authentication, application workflows, private directory, membership actions, and Portal integrations are not enabled in this initial public scaffold.
