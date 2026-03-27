---
status: partial
phase: 12-kanban-pipelines-lead-auto-matching
source: [12-VERIFICATION.md]
started: 2026-03-27T21:35:00Z
updated: 2026-03-27T21:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Drag property card between columns in Sales Property Pipeline
expected: Card moves immediately (optimistic update), stage is persisted, PATCH returns 200, toast confirms. If property moves to 'Listed' and a matching lead exists, toast shows the match count.
result: [pending]

### 2. Open /crm/lettings-property-pipeline
expected: 9 kanban columns render: Valuation Enquiry, Valuation Booked, Valuation Completed, Instruction Signed, Listed, Viewings, Holding Deposit, Tenancy Agreed, Move-in Complete. Rent displayed as e.g. '£1,200 pcm'. Empty state message if no properties.
result: [pending]

### 3. Open /crm/lead-matches with at least one pending match
expected: Match card shows property address/price, lead name/email, score badge (colour-coded), reason badges, 'Approve & Send Details' and 'Dismiss Match' buttons. Approve triggers email.
result: [pending]

### 4. Bulk approve multiple matches
expected: Select multiple via checkboxes, bulk approve bar appears, fires POST /api/crm/lead-matches/bulk-approve, toast shows count.
result: [pending]

### 5. Landlord lead pipeline owner type filter
expected: Switching to 'Letting Owners' shows only inquiry_type='letting', 'Selling Owners' shows only selling, 'All Owners' shows all.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
