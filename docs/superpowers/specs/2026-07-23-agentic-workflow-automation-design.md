# Agentic Workflow Automation — Design Spec

**Date:** 2026-07-23
**Status:** Draft for review
**Author:** Design session (brainstorming) with the user
**Context source:** KeyData operator video (20/07/2026 session) + Tasneem Daud's "Key Data processes" email (6 Mar 2026) defining the John Barclay admin workflows.

---

## 1. Purpose & Goal

Make JB_CRM **agentic**: a single trigger starts a workflow that runs to completion **autonomously**, pausing only at money/legal steps for a **one-click human approval**.

The concrete business goal, in the client's own terms: **eliminate the manual role hand-offs** so one person (Tasneem, the accounts manager) can run the operation herself.

Two roles are being automated:

- **Maisa's role → Workflow #2.** Today Tasneem copy-pastes a received-rent bank entry into an email to Maisa; Maisa processes the rent in KeyData, prepares the landlord statement + documents, and prepares the landlord payment instruction. **The agent becomes Maisa** — it does all of that automatically.
- **Iury's role → Workflow #4.** Iury (maintenance officer) captures repair/contractor work and its cost, which must appear as a deduction on the landlord statement. This is formalised as an automated capture→recharge workflow.

**Tasneem remains the human operator.** Her only manual acts are: (a) putting the rent entry into the CRM, (b) approving the money/legal gates, and (c) making the actual bank transfers in her own banking. Everything between is automated.

**Phased rollout is a hard requirement.** The system must be adoptable gradually — able to run *with* Maisa and Iury still involved and hand steps to the agent progressively via switches in System Settings, not a big-bang cutover. This is a first-class design concept (see §3.1): autonomy is a **per-step setting**, not a fixed property.

### Non-goals (explicit constraints)

- **No banking integration.** The client keeps banking separate and under Tasneem's control. The CRM never connects to a bank, never moves money via API. It prepares payment instructions / BACS files and records payments; Tasneem executes transfers herself.
- **No historical data migration** in this scope (the KeyData data dump since Aug 2005 is a separate one-off project).
- Not a no-code workflow *builder* for end users — workflow definitions are code-defined (but DB-registered and inspectable).

---

## 2. The banking boundary (how money is handled without integration)

The system does everything up to the edge of the bank; Tasneem does the single bank action and records it.

- **Payout side (landlord / contractor / deposit-to-DPS):** at the payment approval gate the system shows a **"Payment to make" card** — payee name, sort code, account number, amount, reference — all from **stored** data (no copy-paste, no Maisa), plus an optional **BACS file** (reuses the existing `/crm/bacs-payments`). Tasneem approves, makes the transfer in her own banking, and clicks **Mark paid** (records paid date, method, and optional bank reference).
- **Money-in side (rent received):** Tasneem downloads her bank statement and **imports the CSV** (reuses Bank Reconciliation import), or pastes the entries. The system **auto-matches** receipts to tenancies by reference. **This import is the trigger for Workflow #2.**
- **Two-stage audit:** every payment is recorded first as *intent* (Mark paid — who/when/ref, `workflow_event`) and later *confirmed* when the next statement import auto-matches the outbound line (`paid → reconciled`). Full closed loop with no bank API.

---

## 3. Architecture

A **deterministic state-machine spine** (auditable, safe for client money) + **agents/LLM only inside specific "smart" steps** (classification, matching, drafting) + **human approval gates** for money/legal actions.

### Reuse (do not reinvent)

The existing **deal-pipeline engine** is a durable, Postgres-backed step state machine (`deal`/`deal_step`/`deal_event`, pg-boss event bus, per-step executors, timeout/skip/override). We **generalise it** into a workflow engine rather than build a new one. Also reused: **pg-boss** (durable jobs/cron/events), the SDK **tool registry** (Zod-validated, permission-gated, audited actions) as step executors, `emailService`, WhatsApp/SMS `messageSender`, DocuSign, escalation, and the newly built Landlord Payments workbench + AML screening + one-off landlord charge.

### Flow

```
trigger event ──▶ trigger registry ──▶ engine creates workflow_run
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                        ▼                       ▼
             automatic action          smart step               approval gate
             (tool executor)          (SDK agent)            (pause → await human)
                    │                        │                       │
                    └──────────── advance / branch / fail ───────────┘
                                            │
                                     complete run
                                (may emit event → next workflow)
```

- **Trigger** → **trigger registry** maps event → workflow definition (with optional conditions) → engine creates a `workflow_run`.
- Engine walks steps. A step is **automatic** (executor from the tool registry), **smart** (an SDK agent call for judgement), or an **approval gate**.
- Reaching a gate sets the run `awaiting_approval` and creates a `workflow_approval`; the run **pauses durably** (survives restart).
- A human acts in the **Approvals queue**; approve → resume, reject → pause + escalate.
- Timeouts/failures escalate to staff (reuse existing escalation). A global **kill-switch** disables all automation instantly.
- **Chaining:** a step can emit an event that triggers another workflow (e.g. `applicant_approved` from #0 triggers #1).

### 3.1 Configurable autonomy (phased rollout)

Autonomy is a **per-step setting** so the client can phase the agent in while Maisa and Iury stay involved. Before executing a step, the engine resolves its **effective mode**:

- **`manual`** — the step becomes a **task** assigned to the responsible person (Maisa → statement steps, Iury → maintenance capture, Tasneem → payments). The agent still prepares/drafts everything; the human executes or confirms. This is the starting state for phase-in.
- **`review` (supervised)** — the agent performs the step, but it **pauses for that person's one-click approval** before taking effect (reuses the approval-gate mechanism).
- **`auto`** — the agent performs the step autonomously.

Resolution: `effective = override(setting) ?? step.defaultMode`, then **capped by a global automation level** (`off | assist | supervised | auto`) and **overridden by the kill-switch**. Money/legal gates (pay landlord, DPS payment/claim, send contract) are **always** at least `review` regardless of settings — they can never be flipped to unattended `auto`.

Switches live in **System Settings** (a new "Automation" screen), stored in `workflow_automation_setting` (per workflow + step), editable by an admin without code changes. Typical rollout: everything `manual` → move Maisa's statement steps to `review` → then `auto`; same for Iury; Tasneem's payment steps stay `review` (hard-gated) throughout.

---

## 4. Data model (additive tables)

- **`workflow_definition`** — id, key, name, version, description, enabled. Steps are code-defined and registered here for inspection.
- **`workflow_run`** — id, definition_key, entity_type, entity_id, status (`running | awaiting_approval | paused | completed | failed | cancelled`), context (JSONB), started_by, started_at, finished_at.
- **`workflow_step_run`** — id, run_id, step_key, executor, status (`pending | running | awaiting_approval | done | skipped | failed`), input (JSONB), output (JSONB), attempts, approval_id, error, started_at, finished_at.
- **`workflow_approval`** — id, run_id, step_run_id, action_type (e.g. `pay_landlord`, `send_contract`, `pay_deposit_dps`, `dps_claim`), action_payload (JSONB — the *exact* action + amount awaiting sign-off), status (`pending | approved | rejected`), decided_by, decided_at, reason.
- **`workflow_trigger`** — id, event_name, definition_key, conditions (JSONB), enabled. Config-driven "when event X → run workflow Y".
- **`workflow_event`** — id, run_id, step_run_id, type, message, payload (JSONB), actor_id, created_at. Full audit log (doubles as CMP/RICS evidence).
- **`workflow_automation_setting`** — id, definition_key, step_key (nullable = applies to whole workflow), mode (`manual | review | auto`), assignee_role, updated_by, updated_at. The switches behind §3.1. Plus a global automation level + kill-switch held in the existing `system_setting` table.
- **`workflow_task`** — id, run_id, step_run_id, assignee_role, assignee_id, title, status (`open | done | skipped`), due_at, completed_by, completed_at. Created when a step resolves to `manual` mode, so Maisa/Iury/Tasneem can execute or confirm it. (Step definitions carry a `defaultMode` and `assigneeRole`.)

All money in integer pence. Singular physical table names.

---

## 5. Adapters (external services — automated-or-manual)

Each adapter has an **automated (provider) mode** and a **manual fallback**, selected by env config. Pattern already established by the AML sanctions feature.

- **Identity / KYC + Right-to-Rent** — automated via a configurable IDV/IDSP provider (e.g. Onfido / Yoti / Credas / SumSub); a certified IDSP satisfies **both** KYC and the Right-to-Rent digital identity check in one. Manual mode stores ID docs + KYC fields to the existing `personal_kyc` / `corporate_kyc` / `kyc_documents` tables. Result recorded as a `screening_request`.
- **AML sanctions** — **already built**: automated feed (OpenSanctions/OFSI CSV, `SANCTIONS_FEED_URL`), live provider API (`SANCTIONS_PROVIDER_URL`), batch screening, proof documents.
- **DPS (deposit protection)** — automated via DPS API if credentials exist; otherwise **guided-manual**: the workflow opens the exact DPS action (register tenant / pay deposit / submit claim) as an approval task with all data pre-filled; staff does the portal step and marks done. Stores the deposit certificate to `document`.
- **Documents** — capture/scan → AI-classify → store to existing `document` table → **extract expiry dates → auto-create certificate reminders** (contracts, references, EPC, gas, EICR). Serves Tasneem's scan-and-store requirement.
- **Banking** — *no adapter* (see §2): payment-instruction/BACS export + Mark paid + reconcile-on-import.

---

## 6. Workflows (step DAGs; 🔒 = human approval gate)

### #0 Applicant Registration
Trigger: manual "Register applicant" on a lead, or an inbound `application_submitted` event (website/portal).
Steps: capture applicant + property interest → **KYC / Right-to-Rent identity verification** (adapter) 🔒 *if refer/fail* → **AML sanction screen** 🔒 *if hit* → request references / send application pack → record referencing outcome → **await landlord decision** (approve/reject) → on approve + move-in date, emit `applicant_approved`.

### #1 New Tenancy (triggered by `applicant_approved`)
Steps: convert applicant → tenant → set rent, commission %, due dates, tenancy dates → **e-sign tenancy contract** (DocuSign) 🔒 *(send)* → record certificate expiries (gas, electrical, EICR, EPC) + auto-reminders → record deposit (custodial/agency/landlord) → **register + pay deposit to DPS** (adapter) 🔒 → store DPS certificate → notify parties. Emits `tenancy_started`.

### #2 Rent → Landlord ("the agent is Maisa")
Trigger: **rent entry imported/pasted into the CRM** (replaces Tasneem's email to Maisa), or a scheduled sweep.
Steps: match receipt → tenancy → record tenant receipt + **email receipt to tenant** → pull maintenance/one-off landlord charges for the period → **generate landlord statement + documents** (rent − fee − charges − repairs − NRL tax + BBF = net) → **email statement to landlord** → **prepare payment instruction / BACS** → **pay landlord** 🔒 *(Tasneem approves, transfers in her bank, Mark paid)* → commit to ledgers + reconcile.

### #3 End of Tenancy
Trigger: notice served / check-out booked.
Steps: schedule check-out inspection → confirm no rent arrears → collect utility-clearance evidence (council tax, electricity, water) → agree deductions with landlord → **submit DPS claim** (adapter) 🔒 → on release, **pay landlord** 🔒 → close account. Emits `tenancy_ended`.

### #4 Maintenance Recharge (Iury's role; feeds #2)
Trigger: maintenance ticket raised / "Charge landlord" on a Support Ticket.
Steps: capture job + property + contractor + cost → (optional **landlord approval** 🔒 above a threshold) → complete work → **record recharge to landlord account** (`property_transaction`, category `maintenance`, or a one-off `recurring_landlord_charge`) → auto-deducts on the next #2 statement.
*Note:* the statement's repairs line now reads `property_transaction` (fixed 2026-07-23) so Iury's charges reliably reach the statement.

---

## 7. Triggers

Three routes, all via `workflow_trigger`:
1. **Event-driven** — rent-import → #2; `applicant_approved` → #1; notice → #3; ticket → #4; `application_submitted` → #0.
2. **Manual "Run workflow"** button on the relevant record.
3. **Scheduled sweeps** (pg-boss cron) — daily catch-ups (e.g. certificate reminders, arrears chase, stalled runs).

Idempotent: at most one active run per (entity, workflow) so nothing double-fires.

---

## 8. Approvals & Tasks UX

New `/crm/approvals` queue with two kinds of items:

- **Approvals** (from `review` steps and money/legal gates) — each card shows the workflow, the case, and the **exact action + amount** awaiting sign-off (e.g. "Pay £1,913 to Mr Moydul Hoque — 20-96-55 / 00054127 — ref 540B HARROW ROAD"), with **Approve** / **Reject (+reason)**. Approve → resume run; Reject → pause + escalate.
- **Tasks** (from `manual` steps) — routed to the responsible role (Maisa / Iury / Tasneem) with the agent's prepared draft; the person executes or confirms, then marks done to advance the run.

A nav badge shows pending count; items also appear on the case timeline. Money/legal executors **refuse to run** without an approved `workflow_approval`. A **System Settings → Automation** screen exposes the per-step switches (§3.1) and the global automation level + kill-switch.

---

## 9. Safety, audit, error handling

- Every step + approval written to `workflow_event` (who/what/when/payload) — the client-money audit trail.
- Money/legal actions only reachable through an approved `workflow_approval` (never unattended `auto`, regardless of settings).
- Transient failures: retry with backoff. Permanent failure: pause run + escalate to staff.
- **Global automation level** (`off | assist | supervised | auto`) caps every step's effective mode; the **kill-switch** disables all automation instantly. New/changed workflows start at `manual`/`assist` and are promoted deliberately.
- Runs are durable (pg-boss) and survive restarts.

---

## 10. Build order (each is its own plan → build → verify cycle)

1. **Engine core** — `workflow_definition/run/step_run/approval/trigger/event/automation_setting/task` tables, the run executor (generalised from the deal pipeline) with **per-step effective-mode resolution** (§3.1), approval + task models, trigger registry, global automation level + kill-switch, the `/crm/approvals` (Approvals & Tasks) queue, and the **System Settings → Automation** switch screen. Phasing must work from day one.
2. **Workflow #2 (Rent → Landlord)** on top of the engine — reuses the Landlord Payments workbench, one-off charges, and the repairs fix. Proves "the agent is Maisa" end-to-end. **First build.**
3. **Workflow #4 (Maintenance recharge)** — small; makes #2's statements correct.
4. **Workflow #1 (New Tenancy)** — needs Identity/KYC + DPS + Documents adapters.
5. **Workflow #0 (Applicant Registration)** — Identity/KYC + AML (built) + references.
6. **Workflow #3 (End of Tenancy)** — DPS claim + payout.

---

## 11. Open questions for implementation planning

- DPS: is there API access, or guided-manual only for the first cut?
- Which IDV/IDSP provider (if any) for KYC + Right-to-Rent, or manual-store first?
- Landlord-approval threshold for #4 (auto-approve small repairs under £X?).
- Statement documents: PDF (needs a per-landlord statement PDF generator) vs HTML email first cut.
