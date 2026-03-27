# Maintenance Tasks Page - Implementation Plan

## What Exists Today
- Maintenance is buried inside `PropertyManagement.tsx` as a tab (not a standalone page)
- Backend is **fully built**: 17+ endpoints with real DB queries, contractor quotes, workflow events, communications
- Database schema is complete: `maintenance_ticket`, `maintenance_ticket_update`, `contractor_quote`, `ticket_workflow_event`, `contractor` tables
- CRMDashboard has a basic maintenance widget showing recent tickets

## What We're Building
A dedicated **Maintenance Tasks** page (`/crm/maintenance`) — a proper, full-featured maintenance management hub.

---

## Page Layout

### Top: Stats Bar
Real-time counts from DB: **New** | **Assigned** | **In Progress** | **Awaiting Parts** | **Completed** | **Closed**

### Left: Task List Panel (scrollable)
- Search bar + filters (status, urgency, category, contractor)
- Sortable list of maintenance tickets as cards showing:
  - Title, property address, urgency badge, status badge
  - Assigned contractor (or "Unassigned")
  - Time since created / last update
- "New Ticket" button at top
- Click a ticket → opens it in the right panel

### Right: Task Detail Panel (selected ticket)
**5 tabs:**

1. **Overview** — Property info, tenant info, description, images, urgency, AI assessment
2. **Workflow** — Visual status pipeline showing current stage with actions:
   - Assign contractor → Request quotes → Approve quote → Schedule → Start work → Complete → Close
   - Each step has action buttons relevant to the current state
3. **Comments & Updates** — Threaded timeline of:
   - Status changes (auto-logged)
   - Internal notes (staff only)
   - Comments (visible to tenant option)
   - File/photo attachments
4. **Quotes & Costs** — Contractor quotes, approval/reject actions, cost tracking, payment status
5. **Messages** — WhatsApp/email conversation with tenant, send message form, task allocation notifications sent to contractors

---

## Implementation Steps

### Step 1: Create the page file
- Create `client/src/pages/MaintenanceTasks.tsx`
- Split-panel layout: ticket list (left ~35%) + detail panel (right ~65%)
- Wire up all existing API endpoints (no backend changes needed)

### Step 2: Task List Panel
- Fetch from `GET /api/crm/maintenance/tickets`
- Filter controls: status select, urgency select, category select, search input
- Ticket cards with status/urgency badges, contractor name, property address
- Highlight selected ticket

### Step 3: Detail Panel - Overview Tab
- Display ticket details, property info, tenant contact info
- AI categorization and suggested contractor
- Quick action buttons: assign contractor, update status

### Step 4: Detail Panel - Workflow Tab
- Visual horizontal pipeline: New → Assigned → In Progress → Awaiting Parts → Completed → Closed
- Current step highlighted
- Action buttons per state (assign, start work, mark complete, close)
- Status change creates audit entry automatically (backend already does this)

### Step 5: Detail Panel - Comments & Updates Tab
- Fetch from `GET /api/crm/maintenance/tickets/{id}/history`
- Show timeline of all updates (status changes, assignments, comments)
- Add comment form with internal/external toggle
- Auto-scroll to latest

### Step 6: Detail Panel - Quotes & Costs Tab
- Fetch from `GET /api/crm/maintenance/tickets/{id}/quotes`
- Request quotes button → contractor selection dialog
- Quote cards with approve/reject/start-work/complete actions
- Cost summary: estimated vs actual
- Payment status

### Step 7: Detail Panel - Messages Tab
- Fetch from `GET /api/crm/maintenance/tickets/{id}/communications`
- Chat-style message bubbles (inbound/outbound)
- Send WhatsApp/email message form
- Show task allocation notifications sent to contractors

### Step 8: Register route + sidebar link
- Add route in `App.tsx`: `/crm/maintenance` → `MaintenanceTasks`
- Update sidebar in `CRMDashboard.tsx` to link to `/crm/maintenance` instead of setting `activeTab`
- Add "Support Tickets" link under PM section pointing to `/crm/support-tickets`

### Step 9: New Ticket Dialog
- Reuse the existing form schema (`maintenanceFormSchema`)
- Property select, category, urgency, title, description
- On submit → POST to `/api/crm/maintenance/tickets`

---

## Backend: No Changes Needed
All endpoints already exist and use real DB queries:
- CRUD for tickets, status updates, contractor assignment
- Quote workflow (request, approve, reject, start, complete)
- Workflow events and communications
- WhatsApp messaging via Twilio

## Files Modified
1. **NEW**: `client/src/pages/MaintenanceTasks.tsx` — The full page
2. **EDIT**: `client/src/App.tsx` — Add route
3. **EDIT**: `client/src/pages/CRMDashboard.tsx` — Update sidebar link
