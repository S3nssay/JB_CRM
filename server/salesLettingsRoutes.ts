import { Router } from "express";
import { pool } from "./db";

const slRouter = Router();

// Middleware - reuse the same auth pattern
const requireAgent = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    // Allow in development
    if (process.env.NODE_ENV === 'development') return next();
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// ============================================================
// SALES & LETTINGS COMMAND CENTRE
// ============================================================

// Summary KPIs
slRouter.get("/sl-command-centre/summary", requireAgent, async (req, res) => {
  try {
    const [propertiesR, listingsR, leadsR, viewingsR, offersR, recentLeadsR] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE is_listed_sale = true)::int as for_sale,
          COUNT(*) FILTER (WHERE is_listed_rental = true)::int as for_let,
          COUNT(*) FILTER (WHERE is_listed = true)::int as total_listed,
          COUNT(*) FILTER (WHERE status = 'under_offer')::int as under_offer,
          COUNT(*) FILTER (WHERE status = 'let_agreed')::int as let_agreed,
          COUNT(*) FILTER (WHERE status = 'sold_stc')::int as sold_stc,
          COUNT(*) FILTER (WHERE status = 'exchanged')::int as exchanged,
          COUNT(*) FILTER (WHERE status = 'completed')::int as completed_count
        FROM property WHERE (is_listed_sale = true OR is_listed_rental = true OR is_listed = true)
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE is_published_website = true)::int as website,
          COUNT(*) FILTER (WHERE is_published_zoopla = true)::int as zoopla,
          COUNT(*) FILTER (WHERE is_published_rightmove = true)::int as rightmove,
          COUNT(*) FILTER (WHERE is_published_onthemarket = true)::int as onthemarket
        FROM property WHERE (is_listed_sale = true OR is_listed_rental = true OR is_listed = true)
      `),
      pool.query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'new')::int as new_leads,
          COUNT(*) FILTER (WHERE status = 'contacted')::int as contacted,
          COUNT(*) FILTER (WHERE status = 'qualified')::int as qualified,
          COUNT(*) FILTER (WHERE status = 'viewing_booked')::int as viewing_booked,
          COUNT(*) FILTER (WHERE status = 'offer_made')::int as offer_made,
          COUNT(*) FILTER (WHERE priority = 'hot')::int as hot_leads,
          COUNT(*) FILTER (WHERE lead_type = 'rental')::int as rental_leads,
          COUNT(*) FILTER (WHERE lead_type = 'purchase')::int as purchase_leads
        FROM lead WHERE status NOT IN ('converted', 'lost')
      `),
      pool.query(`
        SELECT
          COUNT(*)::int as total_upcoming,
          COUNT(*) FILTER (WHERE status = 'confirmed')::int as confirmed,
          COUNT(*) FILTER (WHERE status = 'pending')::int as pending_count,
          COUNT(*) FILTER (WHERE scheduled_at::date = CURRENT_DATE)::int as today
        FROM lead_viewing WHERE scheduled_at >= NOW() AND status NOT IN ('cancelled', 'no_show')
      `),
      pool.query(`
        SELECT
          COUNT(*)::int as total_active,
          COUNT(*) FILTER (WHERE status = 'pending')::int as pending_count,
          COUNT(*) FILTER (WHERE status = 'accepted')::int as accepted,
          COUNT(*) FILTER (WHERE status = 'counter_offered')::int as counter_offered,
          COALESCE(AVG(offer_amount) FILTER (WHERE status = 'accepted'), 0)::numeric as avg_accepted
        FROM offer WHERE status NOT IN ('rejected', 'withdrawn', 'expired')
      `),
      pool.query("SELECT COUNT(*)::int as count FROM lead WHERE created_at > NOW() - INTERVAL '7 days'")
    ]);

    res.json({
      properties: propertiesR.rows[0] || {},
      portals: listingsR.rows[0] || {},
      leads: leadsR.rows[0] || {},
      viewings: viewingsR.rows[0] || {},
      offers: offersR.rows[0] || {},
      newLeadsThisWeek: recentLeadsR.rows[0]?.count || 0
    });
  } catch (error: any) {
    console.error("Error fetching SL command centre summary:", error);
    res.status(500).json({ error: error.message });
  }
});

// Action queue
slRouter.get("/sl-command-centre/action-queue", requireAgent, async (req, res) => {
  try {
    const actions: any[] = [];

    // 1. New leads needing contact
    const newLeads = await pool.query(`
      SELECT id, full_name, lead_type, source, priority, created_at
      FROM lead WHERE status = 'new'
        AND (last_contacted_at IS NULL OR last_contacted_at < NOW() - INTERVAL '24 hours')
      ORDER BY CASE WHEN priority = 'hot' THEN 0 WHEN priority = 'warm' THEN 1 ELSE 2 END, created_at ASC
      LIMIT 20
    `);
    for (const row of newLeads.rows) {
      actions.push({
        type: 'new_lead', priority: row.priority === 'hot' ? 'high' : row.priority === 'warm' ? 'medium' : 'low',
        title: `New ${row.lead_type || ''} lead: ${row.full_name}`,
        subtitle: `Source: ${row.source || 'Unknown'}`,
        entityType: 'lead', entityId: row.id, dueDate: row.created_at, link: '/crm/leads/' + row.id
      });
    }

    // 2. Viewings happening today or tomorrow
    const upcomingViewings = await pool.query(`
      SELECT v.id, v.lead_id, v.property_id, v.scheduled_at, v.status, v.viewing_type,
        l.full_name as lead_name, COALESCE(p.address, p.address_line1) as property_address
      FROM lead_viewing v LEFT JOIN lead l ON v.lead_id = l.id LEFT JOIN property p ON v.property_id = p.id
      WHERE v.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '48 hours'
        AND v.status NOT IN ('cancelled', 'completed', 'no_show')
      ORDER BY v.scheduled_at ASC
    `);
    for (const row of upcomingViewings.rows) {
      actions.push({
        type: 'upcoming_viewing', priority: 'high',
        title: `Viewing: ${row.lead_name} at ${row.property_address}`,
        subtitle: row.viewing_type || 'In-person',
        entityType: 'viewing', entityId: row.id, dueDate: row.scheduled_at, link: '/crm/leads/' + row.lead_id
      });
    }

    // 3. Pending offers awaiting response
    const pendingOffers = await pool.query(`
      SELECT o.id, o.offer_amount, o.offer_type, o.created_at,
        l.full_name as lead_name, COALESCE(p.address, p.address_line1) as property_address
      FROM offer o LEFT JOIN lead l ON o.lead_id = l.id LEFT JOIN property p ON o.property_id = p.id
      WHERE o.status = 'pending' ORDER BY o.created_at ASC
    `);
    for (const row of pendingOffers.rows) {
      actions.push({
        type: 'pending_offer', priority: 'high',
        title: `Offer: \u00A3${Number(row.offer_amount).toLocaleString()} from ${row.lead_name}`,
        subtitle: `${row.property_address} \u2022 ${row.offer_type || 'purchase'}`,
        entityType: 'offer', entityId: row.id, dueDate: row.created_at, link: '/crm/offers'
      });
    }

    // 4. Follow-ups due today or overdue
    const followUps = await pool.query(`
      SELECT id, full_name, lead_type, next_follow_up_date, status, priority
      FROM lead WHERE next_follow_up_date <= CURRENT_DATE + 1 AND status NOT IN ('converted', 'lost')
      ORDER BY next_follow_up_date ASC LIMIT 15
    `);
    for (const row of followUps.rows) {
      actions.push({
        type: 'follow_up_due',
        priority: new Date(row.next_follow_up_date) < new Date() ? 'high' : 'medium',
        title: 'Follow up: ' + row.full_name,
        subtitle: (row.lead_type || '') + ' lead',
        entityType: 'lead', entityId: row.id, dueDate: row.next_follow_up_date, link: '/crm/leads/' + row.id
      });
    }

    // 5. Landlord leads needing action
    try {
      const landlordLeads = await pool.query(`
        SELECT id, full_name, COALESCE(property_address, '') as property_address, pipeline_stage, created_at
        FROM landlord_lead WHERE pipeline_stage NOT IN ('converted', 'lost')
          AND (last_contacted_at IS NULL OR last_contacted_at < NOW() - INTERVAL '3 days')
        ORDER BY created_at ASC LIMIT 10
      `);
      for (const row of landlordLeads.rows) {
        actions.push({
          type: 'landlord_lead', priority: 'medium',
          title: 'Landlord lead: ' + row.full_name,
          subtitle: row.property_address + ' \u2022 ' + (row.pipeline_stage || '').replace(/_/g, ' '),
          entityType: 'landlord_lead', entityId: row.id, dueDate: row.created_at, link: '/crm/landlord-leads/' + row.id
        });
      }
    } catch (e) { /* landlord_lead table may not exist */ }

    // 6. Properties not on portals
    const unlistedProperties = await pool.query(`
      SELECT id, COALESCE(address, address_line1) as address, status, price, rent_amount
      FROM property WHERE (is_listed_sale = true OR is_listed_rental = true OR is_listed = true)
        AND is_published_rightmove IS NOT TRUE AND is_published_zoopla IS NOT TRUE
      LIMIT 10
    `);
    for (const row of unlistedProperties.rows) {
      actions.push({
        type: 'unlisted_property', priority: 'low',
        title: 'Not on portals: ' + row.address,
        subtitle: row.price ? '\u00A3' + Number(row.price).toLocaleString() : row.rent_amount ? '\u00A3' + Number(row.rent_amount).toLocaleString() + '/m' : '',
        entityType: 'property', entityId: row.id, link: '/crm/properties/' + row.id + '/edit'
      });
    }

    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    actions.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));
    res.json(actions);
  } catch (error: any) {
    console.error("Error fetching SL action queue:", error);
    res.status(500).json({ error: error.message });
  }
});

// Property board - all listed properties with marketing status
slRouter.get("/sl-command-centre/property-board", requireAgent, async (req, res) => {
  try {
    const { type } = req.query;
    let filter = "(p.is_listed_sale = true OR p.is_listed_rental = true OR p.is_listed = true)";
    if (type === 'sale') filter = "p.is_listed_sale = true";
    else if (type === 'rental') filter = "(p.is_listed_rental = true OR p.is_rental = true)";

    const result = await pool.query(`
      SELECT p.id, COALESCE(p.address, p.address_line1) as address, p.postcode,
        p.property_type, p.bedrooms, p.bathrooms,
        p.price, p.rent_amount, p.rent_period,
        p.status, p.is_listed_sale, p.is_listed_rental, p.is_listed, p.is_rental,
        p.is_published_website, p.is_published_zoopla, p.is_published_rightmove,
        p.is_published_onthemarket, p.is_published_social,
        p.images, p.listed_at, p.listed_by,
        p.agent_id, p.vendor_id, p.landlord_id,
        l.name as landlord_name,
        (SELECT COUNT(*)::int FROM lead_viewing v WHERE v.property_id = p.id AND v.status NOT IN ('cancelled', 'no_show')) as viewing_count,
        (SELECT COUNT(*)::int FROM offer o WHERE o.property_id = p.id AND o.status NOT IN ('rejected', 'withdrawn', 'expired')) as active_offer_count,
        (SELECT COUNT(*)::int FROM lead_property_view lpv WHERE lpv.property_id = p.id) as enquiry_count
      FROM property p LEFT JOIN landlord l ON p.landlord_id = l.id
      WHERE ${filter}
      ORDER BY p.listed_at DESC NULLS LAST, p.created_at DESC
    `);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching property board:", error);
    res.status(500).json({ error: error.message });
  }
});

// Lead pipeline grouped by status
slRouter.get("/sl-command-centre/lead-pipeline", requireAgent, async (req, res) => {
  try {
    const { type } = req.query;
    let filter = "status NOT IN ('converted', 'lost')";
    if (type === 'rental') filter += " AND lead_type = 'rental'";
    else if (type === 'purchase') filter += " AND lead_type = 'purchase'";

    const result = await pool.query(`
      SELECT id, full_name, email, phone, lead_type, source, status, priority, score,
        min_budget, max_budget, preferred_areas, preferred_bedrooms,
        last_contacted_at, next_follow_up_date, created_at,
        (SELECT COUNT(*)::int FROM lead_viewing v WHERE v.lead_id = l.id) as viewing_count,
        (SELECT COUNT(*)::int FROM offer o WHERE o.lead_id = l.id) as offer_count
      FROM lead l WHERE ${filter}
      ORDER BY CASE WHEN priority = 'hot' THEN 0 WHEN priority = 'warm' THEN 1 ELSE 2 END,
        last_activity_at DESC NULLS LAST
    `);

    const pipeline: Record<string, any[]> = { new: [], contacted: [], qualified: [], viewing_booked: [], offer_made: [] };
    for (const row of result.rows) {
      const s = row.status || 'new';
      if (!pipeline[s]) pipeline[s] = [];
      pipeline[s].push(row);
    }
    res.json(pipeline);
  } catch (error: any) {
    console.error("Error fetching lead pipeline:", error);
    res.status(500).json({ error: error.message });
  }
});

// Activity feed
slRouter.get("/sl-command-centre/activity-feed", requireAgent, async (req, res) => {
  try {
    const activities: any[] = [];

    const viewings = await pool.query(`
      SELECT v.id, v.scheduled_at, v.status, v.feedback,
        l.full_name as lead_name, l.lead_type,
        COALESCE(p.address, p.address_line1) as property_address
      FROM lead_viewing v LEFT JOIN lead l ON v.lead_id = l.id LEFT JOIN property p ON v.property_id = p.id
      ORDER BY v.created_at DESC LIMIT 10
    `);
    for (const v of viewings.rows) {
      activities.push({ type: 'viewing', timestamp: v.scheduled_at, title: 'Viewing ' + v.status + ': ' + v.lead_name, subtitle: v.property_address, status: v.status });
    }

    const offers = await pool.query(`
      SELECT o.id, o.offer_amount, o.status, o.created_at,
        l.full_name as lead_name, COALESCE(p.address, p.address_line1) as property_address
      FROM offer o LEFT JOIN lead l ON o.lead_id = l.id LEFT JOIN property p ON o.property_id = p.id
      ORDER BY o.created_at DESC LIMIT 10
    `);
    for (const o of offers.rows) {
      activities.push({ type: 'offer', timestamp: o.created_at, title: 'Offer \u00A3' + Number(o.offer_amount).toLocaleString() + ' - ' + o.status, subtitle: o.lead_name + ' \u2022 ' + o.property_address, status: o.status });
    }

    try {
      const leadActivity = await pool.query(`
        SELECT la.id, la.activity_type, la.description, la.created_at, l.full_name as lead_name
        FROM lead_activity la LEFT JOIN lead l ON la.lead_id = l.id
        ORDER BY la.created_at DESC LIMIT 10
      `);
      for (const a of leadActivity.rows) {
        activities.push({ type: 'activity', timestamp: a.created_at, title: a.activity_type + ': ' + a.lead_name, subtitle: a.description });
      }
    } catch (e) { /* table may not exist */ }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(activities.slice(0, 30));
  } catch (error: any) {
    console.error("Error fetching activity feed:", error);
    res.status(500).json({ error: error.message });
  }
});

export { slRouter };
