# SELC role permissions

This document describes authorization boundaries, not just visibility of buttons. The Portal backend is the enforcement point. SELC Headquarters must show actions only to roles authorized to complete them.

## Organization hierarchy

Founder / Chair → SELC Coordinator → SELC Representative → SELC Advisor.

Staff, Dungeon Monitors, Educators, and certified IA Staff are **separate appointments**. No SELC title automatically grants operational Staff status, DM powers, IA Staff certification, or curriculum publishing.

## Role matrix

| Capability | Advisor | Representative | Coordinator |
| --- | --- | --- | --- |
| SELC chat and opted-in community rooms | Yes | Yes | Yes |
| Read/respond to routine member-authorized messages | Yes | Yes | Yes |
| Read and triage event feedback/suggestions | Yes | Yes | Yes |
| Publish/remove public-facing event reviews | No | Yes | Yes |
| Propose and comment on committee initiatives | Yes | Yes | Yes |
| Vote on education, events, outreach, community, accessibility | Yes | Yes | Yes |
| Vote on pricing, organizational rules, equipment, work sessions or other committee governance | Yes | Yes | Yes |
| Vote in Coordinator elections | Yes | Yes | Yes |
| Read full membership registry | No | Yes | Yes |
| Approve/deny routine membership applications | No | Yes | Yes |
| Correct authorized member registry records | No | Yes | Yes |
| Review and recommend Staff/DM/IA Staff applications | Non-sensitive assigned input only | Yes | Yes |
| Finalize Staff/DM/IA Staff appointments | No | No | Yes |
| Review private Internal Affairs cases and Ban Reports | No | Yes | Yes |
| Provide recorded Ban Report recommendations | No | Yes | Yes |
| Issue/lift bans solely through SELC appointment | No | No | Yes |
| Assign or reassign leadership review queues | No | No | Yes |
| Create unpublished event drafts | No | Assigned participation only | Yes |
| Publish approved Coordinator event drafts | No | No | Requires separately authorized Owner publication |
| Read approved education program summaries | Yes | Yes | Yes |
| Edit and administer SE Education courses | No (unless independently authorized Educator) | Yes | Yes |
| Free SE event admission from SELC title | No | Yes | Yes |
| Financial changes, account recovery, system ownership | No | No | Owner-controlled |

Authorized certified **IA Staff** may impose or lift bans by their separate IA authorization. A Representative or Advisor who is separately appointed Staff does **not** receive those powers from the SELC title.

## Seat caps and continuity

Five Advisors / three Representatives / two Coordinators (ten appointed positions total) plus the Founder/Chair. The Portal reserves five Advisor offers and three Representative approvals, and maintains Coordinator positions in existing stored slots 6–7. No existing leader is automatically demoted by reducing the Representative cap from five to three. During transition, additional incumbent Representatives retain their role, but new Representative appointments are blocked until the active/reserved count is below three. Coordinator promotions free a Representative place. Advisor advancement requires the Representative certification and a vacancy.

## Advisor scope

Advisors receive a dedicated 10-question assessment and must pass before their appointment activates. SELC has five Advisor positions, three Representative positions and two Coordinator positions, plus the Founder/Chair. Advisors do not consume Representative or Coordinator seats. Existing appointments beyond the new Representative cap remain active until a deliberate transition. They can work on community relations, feedback, learning and outreach, and may vote on all committee proposals while role-specific implementation powers remain restricted. Sensitive reports must be escalated; they cannot access private IA case content.

They may later apply for Representative without losing their documented Advisor contributions. That application must be accepted and the Representative certification completed before Representative permissions activate.

## Applications and appeals

The Founder may reopen a **declined** Advisor or Representative application, retaining the prior decision and notes, and may offer an Advisor certification to an undecided or declined Representative applicant. The offer does not activate Advisor permissions until the applicant completes certification.

A reopened application returns to review and can be accepted into its eligible role if a seat is available, or declined again. Existing records and review history are preserved. Coordinator elevation continues to require Representative appointment, voting eligibility, and Coordinator certification.

## Validation before production deployment

- Test eligibility for an approved Advisor, an Advisor with an unrelated active Staff appointment, an Advisor with an expired or revoked account, a Representative, a Coordinator and the Founder.
- Confirm Advisor voting counts toward all committee proposal and Coordinator-candidate ballots, without granting restricted execution rights.
- Verify previously declined applications can be reopened, accepted or converted into an Advisor offer with complete audit history.
- Verify no Advisor receives free admission, private IA files, member registry access, Staff/DM appointment decisions, publication permissions, or ban controls through the Advisor title.
- Confirm each role sees only its permitted navigation and can complete its permitted actions without relying on disabled UI buttons for security.
