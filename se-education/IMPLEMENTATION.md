# SE Education — integrated delivery specification
Status: **foundation only; do not deploy or advertise enrollment until the backend passes acceptance tests.**

## Netlify deployment identity
- Dedicated public website: **https://seeducational.netlify.app/** (proposed URL, not yet verified as deployed).
- In Netlify, use SELC repository with **base directory `se-education`**, **publish directory `public`**, and no automatic production deployment until the integration release gate passes.
- Configure the Portal connected-app target `education` with this precise origin.

## Source of truth
- Portal is canonical for membership, sessions, educator approval, event creation, enrollment, payment and attendance.
- SELC is the editorial and operations console; its gateway is a transport relay, not an authority.
- SE Education is a separate Netlify front end connected to the canonical Portal. It must not maintain another membership/password database.
- Do not use the public static JavaScript bundle as a place to hide restricted lessons, teacher scripts, answer keys, or unpublished plans.

## Event types
Extend event type enumeration to `social | play | workshop`, preserving existing event IDs and types. A workshop records `classId`, `classVersion`, `instructorIds`, `audienceAge`, `enrollmentOpen`, `enrollmentClose`, `capacity`, `waitlist`, `price`, `venue`, `deliveryMode`, `status`. Event creation, RSVP, pricing, eligibility, calendar, tickets, and existing administrative filters must all recognize workshop as an independent type. A workshop is neither a play party nor a social for returning-status policy purposes, unless Founder explicitly configures otherwise.

## Learner and educator authorization
- Public: course title, description, difficulty, estimated duration, requirements, date, price, availability, and lecturer bio (only with consent).
- Student: specific lessons/handouts/quiz **only** when Portal confirms approved class enrollment, paid/waived admission where applicable, and release window; authorized record is `class_id + event_id + account_id`, not simply an unlocked URL or localStorage state.
- Instructors: only their assigned and approved instructor plans; owner and SELC may see planning material according to existing permissions.
- Students cannot see answer keys or teacher-only timing, scripts, facilitator notes, private learner details, or draft revisions.
- Rejection, refunds, bans, removed RSVP, and event cancellation immediately revoke access; never trust role or enrollment flags sent from client.
- Couple tickets: both individuals must be uniquely identified; a paying account does not automatically grant one shared credential to the other person.
- Use the existing Portal login/session flow and security controls; cross-origin access should use an auditable one-time handoff/session exchange restricted to the known Education origin. Never place a long-lived bearer token in URL query parameters.
- Version every lesson and plan to preserve what attendees were shown at a specific event.

## Curriculum objects
`course`: title, description, outcomes, level, format, prerequisites, subject, categories, safety, sources, defaultRuntime, publishedVersion.
`module`: objective, teachingPoints, attendeeMaterial, activities, comprehensionChecks, accessibleAlternatives, duration.
`teacherPlan`: exact opening words, teaching transitions, demonstration script, supplies, room setup, timed facilitator run-of-show, expected answers, discussion prompts, live safety interruptions, debrief, follow-up and contingency plan.
`quiz`: question types, scored answer rubric, explanations, retries, accommodations, release conditions, minimum score, accessibility. Answers and score calculation must be server-side.
`classRun`: courseVersion, eventId, educators, student roster, publication windows, check-in and completion, instructor notes, quiz assignments, feedback.

## Proposed educator workflow
Educator creates draft -> assigned educator and SELC collaboratively edit -> SELC review and requests changes -> Founder approval -> class publishing -> Workshop event creation -> Portal registration -> enrollment-gated resources -> live instruction -> quiz -> feedback and optional completion statement. SELC can contribute but cannot approve its own content beyond existing governance powers; public release is Founder-controlled.

## Instructor plan acceptance standard
Every 90-minute lesson should include:
1. A timed timeline (minute-by-minute, including breaks).
2. Verbatim suggested opening and closing script; no requirement to read verbatim.
3. Learning objectives phrased as observable behaviors.
4. Materials, room arrangement, accessibility, content notices, and opt-out pathways.
5. Demonstration safety screening and explicit stop conditions.
6. Examples, realistic practice dialogue, anticipated misunderstandings, and instructor responses.
7. At least 6 assessment questions with reasoned answer explanations; separate private answer keys.
8. Sources and date reviewed, with license and attribution checks.
9. Instructor skill prerequisites and notes for guest speakers.
10. Participant take-home summary and feedback prompts.

## Teaching scope exclusions
- No standalone rope-tying, fire-play, choking-technique or first-aid class is planned.
- Introductory risk recognition for restraint pressure, hazardous anatomy, choking/neck compression and emergency escalation is included where relevant, without practical instruction in these high-risk methods.
- Impact Play Foundations remains a full safety-led workshop.

## First curriculum sequence
1. BDSM 101 — terminology and cultural diversity; consent; roles; risks; introductory negotiation; first-event etiquette; aftercare.
2. Consent & Negotiation — affirmative agreements, changeability, capacity, safewords, nonverbal signaling, case-based exercises.
3. Impact Play Foundations — anatomy-aware risks, equipment inspection, communication, basic sensation demonstrations by an approved educator, aftercare.
4. Psychological Play & Emotional Safety — negotiated topics and language, stop signals, distress recognition, de-role, follow-up.
5. Power Exchange — autonomy, authority, responsibilities, healthy limits, maintenance and renegotiation.
6. Aftercare & Drop — planning and follow-up; avoid framing trauma processing as treatment.

## Sources to review and cite in course metadata
- NCSF educational outreach and Explicit Prior Permission training: https://ncsfreedom.org/educational-outreach-overview/
- NCSF resource library: https://ncsfreedom.org/resource-library/
- East Coast Kink Events curated education paths: https://www.eastcoastkinkevents.com/education
- Kink Academy instructional format and expert-led video catalog: https://www.kinkacademy.com/
- National Kink Safety Alliance competency themes: https://www.kinksafetyalliance.org/

Respect original copyrights. Reference and summarize; do not copy courses, instructors' scripts or proprietary slides. NCSF Creative Commons terms and attribution rules must be reviewed per asset.

## Release gate
No deployment until:
- Tests cover workshop creation, listing, pricing, admission, RSVP, refund, waitlisting, payment/waiver, attendance, staff and SELC access.
- Anonymous and unenrolled accounts cannot retrieve a byte of restricted content.
- Enrolled learners cannot retrieve another event's content, teacher material, unpublished drafts, other learners' quiz data, or answers.
- Teacher permissions are scoped to assigned programs, not all private member records.
- Enrollment revocation works immediately.
- Links among Hub, SELC, Portal and SE Education target correct canonical URLs, including mobile.
- Netlify site has correct environment configuration, domain allowlist, CORS, rate limiting, CSRF handling and separate logs.
- Smoke tests exercise a full course from approval to learner completion with two separate user accounts.
