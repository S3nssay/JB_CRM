import { pgTable, text, serial, integer, boolean, timestamp, uniqueIndex, decimal, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// AI Chat and Search Schemas
export const SearchFiltersSchema = z.object({
  listingType: z.enum(["sale", "rental"]).optional(),
  propertyType: z.array(z.string()).optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  postcode: z.string().optional(),
  areas: z.array(z.string()).optional()
});

export const ParsedIntentSchema = z.object({
  intent: z.enum(["conversation", "property_search", "unknown"]),
  filters: SearchFiltersSchema,
  explanation: z.string().optional(),
  confidence: z.number().min(0).max(1)
});

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;
export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

// User schema with multiple roles for CRM
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("user"), // 'admin', 'agent', 'tenant', 'landlord', 'user', 'maintenance_staff'

  // Additional fields for different user types
  companyName: text("company_name"), // For landlords/companies
  department: text("department"), // For maintenance staff (plumbing, electrical, etc)
  specialties: text("specialties").array(), // For maintenance staff expertise areas
  assignedProperties: integer("assigned_properties").array(), // Properties a tenant/landlord is associated with

  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").notNull().defaultNow(),

  // Password management
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  lastPasswordChangeAt: timestamp("last_password_change_at"),
  tempPassword: boolean("temp_password").default(false) // True if password needs to be changed
}, (table) => {
  return {
    usernameIdx: uniqueIndex("username_idx").on(table.username),
    emailIdx: uniqueIndex("email_idx").on(table.email)
  };
});

// Session table for connect-pg-simple
export const session = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

// London areas covered
export const londonAreas = pgTable("london_areas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  postcode: text("postcode").notNull(),
  description: text("description").notNull(),
  investmentPerspective: text("investment_perspective").notNull(),
  marketAnalysis: text("market_analysis").notNull(),
  positiveAspects: text("positive_aspects").array().notNull(),
  negativeAspects: text("negative_aspects").array().notNull(),
  averagePrice: integer("average_price"),
  priceGrowthPercentage: decimal("price_growth_percentage"),
  nearestTubeStation: text("nearest_tube_station"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Estate agent properties schema (for sales and rentals)
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  // Listing type
  listingType: text("listing_type").notNull(), // 'sale' or 'rental'
  propertyCategory: text("property_category").notNull().default("residential"), // 'residential' or 'commercial'
  status: text("status").notNull().default("active"), // 'active', 'under_offer', 'sold', 'let', 'withdrawn'

  // Basic property information
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(), // in pence for precision
  priceQualifier: text("price_qualifier"), // 'guide_price', 'offers_over', 'poa', etc.

  // Property details
  propertyType: text("property_type").notNull(), // 'flat', 'house', 'maisonette', 'penthouse', etc.
  bedrooms: integer("bedrooms").notNull(),
  bathrooms: integer("bathrooms").notNull(),
  receptions: integer("receptions"),
  squareFootage: integer("square_footage"),

  // Address and location
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  postcode: text("postcode").notNull(),
  areaId: integer("area_id"), // Link to london_areas (optional if no areas configured)

  // Geolocation
  latitude: decimal("latitude"),
  longitude: decimal("longitude"),

  // Property characteristics
  tenure: text("tenure").notNull(), // 'freehold', 'leasehold', 'share_of_freehold'
  councilTaxBand: text("council_tax_band"),
  energyRating: text("energy_rating"), // A, B, C, D, E, F, G
  yearBuilt: integer("year_built"),

  // Features (JSON arrays for flexibility)
  features: text("features").array(), // ['garden', 'parking', 'balcony', 'recently_renovated', etc.]
  amenities: text("amenities").array(), // local amenities

  // Images
  images: text("images").array(), // Array of image URLs/paths
  floorPlan: text("floor_plan"), // Floor plan image URL

  // Viewing and contact
  viewingArrangements: text("viewing_arrangements"), // 'by_appointment', 'viewing_times', etc.
  agentContact: text("agent_contact"),

  // Property manager (agent responsible for this property)
  propertyManagerId: integer("property_manager_id"), // FK to users.id with role='agent'

  // Rental specific fields
  rentPeriod: text("rent_period"), // 'per_month', 'per_week' for rentals
  furnished: text("furnished"), // 'furnished', 'unfurnished', 'part_furnished'
  availableFrom: timestamp("available_from"),
  minimumTenancy: integer("minimum_tenancy"), // in months
  deposit: integer("deposit"), // deposit amount for rentals

  // Management fields (when status = 'let')
  isManaged: boolean("is_managed").default(false), // Is this property under John Barclay management?
  landlordId: integer("landlord_id"), // FK to landlords table (when property is managed)

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Property portal listings - tracking property syndication to external portals
export const propertyPortalListings = pgTable("property_portal_listings", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  portalName: text("portal_name").notNull(), // 'zoopla', 'propertyfinder', 'rightmove', etc

  // Portal credentials (encrypted)
  portalAccountId: text("portal_account_id"),
  portalListingId: text("portal_listing_id"), // The ID on the external portal

  // Syndication status
  status: text("status").notNull().default("pending"), // 'pending', 'active', 'paused', 'removed', 'error'
  lastSyncStatus: text("last_sync_status"), // 'success', 'failed', 'partial'
  lastSyncMessage: text("last_sync_message"),
  lastSyncAt: timestamp("last_sync_at"),

  // Listing details
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"),
  viewsCount: integer("views_count").default(0),
  inquiriesCount: integer("inquiries_count").default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Maintenance tickets system
export const maintenanceTickets = pgTable("maintenance_tickets", {
  id: serial("id").primaryKey(),

  // Property and tenant information
  propertyId: integer("property_id").notNull(),
  tenantId: integer("tenant_id").notNull(), // User ID of tenant
  landlordId: integer("landlord_id"), // User ID of landlord

  // Ticket details
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // 'plumbing', 'electrical', 'heating', 'appliance', 'structural', 'other'
  urgency: text("urgency").notNull(), // 'emergency', 'urgent', 'routine', 'low'

  // AI routing
  aiCategorization: text("ai_categorization"), // AI-determined category
  aiUrgencyScore: integer("ai_urgency_score"), // 1-10 scale
  aiSuggestedAssignee: integer("ai_suggested_assignee"), // Suggested maintenance staff ID
  aiRoutingReason: text("ai_routing_reason"), // Explanation of AI routing decision

  // Status tracking
  status: text("status").notNull().default("new"), // 'new', 'assigned', 'in_progress', 'awaiting_parts', 'completed', 'closed'
  assignedToId: integer("assigned_to_id"), // Maintenance staff user ID
  assignedContractorId: integer("assigned_contractor_id"), // FK to contractors.id for external contractor
  assignedAt: timestamp("assigned_at"),

  // Resolution
  resolutionNotes: text("resolution_notes"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),

  // Attachments and evidence
  images: text("images").array(), // Photos of the issue
  documents: text("documents").array(), // Any related documents

  // Cost tracking
  estimatedCost: integer("estimated_cost"), // In pence
  actualCost: integer("actual_cost"), // In pence
  paidBy: text("paid_by"), // 'landlord', 'tenant', 'agency'

  // Communication
  internalNotes: text("internal_notes"), // Notes for staff only
  tenantCanSeeNotes: boolean("tenant_can_see_notes").default(false),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Maintenance ticket comments/updates
export const maintenanceTicketUpdates = pgTable("maintenance_ticket_updates", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  userId: integer("user_id").notNull(), // Who made the update

  updateType: text("update_type").notNull(), // 'comment', 'status_change', 'assignment', 'cost_update'
  message: text("message").notNull(),

  // Status change tracking
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),

  // Assignment tracking
  previousAssignee: integer("previous_assignee"),
  newAssignee: integer("new_assignee"),

  isInternal: boolean("is_internal").default(false), // Internal notes not visible to tenants

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Maintenance categories for AI routing rules
export const maintenanceCategories = pgTable("maintenance_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),

  // AI routing rules
  keywords: text("keywords").array(), // Keywords that trigger this category
  defaultUrgency: text("default_urgency"), // Default urgency level
  defaultAssigneeId: integer("default_assignee_id"), // Default staff member

  // Escalation rules
  escalationHours: integer("escalation_hours"), // Hours before escalation
  escalationToId: integer("escalation_to_id"), // Who to escalate to

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Staff profiles and management
export const staffProfiles = pgTable("staff_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(), // Link to users table

  // Personal Information
  employeeId: text("employee_id").unique(),
  nationalInsuranceNumber: text("ni_number"), // Encrypted
  dateOfBirth: timestamp("date_of_birth"),
  emergencyContact: text("emergency_contact"),
  emergencyContactPhone: text("emergency_contact_phone"),

  // Employment Details
  jobTitle: text("job_title").notNull(),
  department: text("department").notNull(), // 'sales', 'lettings', 'maintenance', 'admin', 'management'
  employmentType: text("employment_type"), // 'full_time', 'part_time', 'contractor'
  startDate: timestamp("start_date").notNull(),
  contractEndDate: timestamp("contract_end_date"), // For contractors

  // Compensation
  salaryType: text("salary_type"), // 'hourly', 'salary', 'commission_only'
  baseSalary: integer("base_salary"), // In pence
  commissionRate: decimal("commission_rate"), // Percentage for agents
  targetMonthly: integer("target_monthly"), // Monthly targets for agents

  // Work Schedule
  workingDays: text("working_days").array(), // ['monday', 'tuesday', ...]
  workingHours: json("working_hours"), // { monday: { start: "09:00", end: "17:00" }, ... }
  lunchBreak: integer("lunch_break"), // Minutes

  // Skills and Certifications
  skills: text("skills").array(),
  certifications: json("certifications"), // [{ name: "", issueDate: "", expiryDate: "" }]
  languages: text("languages").array(),

  // Performance Metrics
  performanceRating: decimal("performance_rating"), // 1-5 scale
  lastReviewDate: timestamp("last_review_date"),
  nextReviewDate: timestamp("next_review_date"),

  // Status
  isActive: boolean("is_active").default(true),
  onLeave: boolean("on_leave").default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Staff attendance and time tracking
export const staffAttendance = pgTable("staff_attendance", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),

  date: timestamp("date").notNull(),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),

  // Break tracking
  breakStart: timestamp("break_start"),
  breakEnd: timestamp("break_end"),
  totalBreakMinutes: integer("total_break_minutes"),

  // Hours calculation
  scheduledHours: decimal("scheduled_hours"),
  actualHours: decimal("actual_hours"),
  overtimeHours: decimal("overtime_hours"),

  // Status
  status: text("status").notNull(), // 'present', 'absent', 'late', 'holiday', 'sick', 'remote'
  notes: text("notes"),

  // Location tracking (for remote work)
  workLocation: text("work_location"), // 'office', 'home', 'client_site'

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Staff leave/holiday management
export const staffLeave = pgTable("staff_leave", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),

  leaveType: text("leave_type").notNull(), // 'annual', 'sick', 'maternity', 'paternity', 'unpaid', 'emergency'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  totalDays: decimal("total_days").notNull(),

  reason: text("reason"),
  medicalCertificate: text("medical_certificate"), // File path for sick leave

  // Approval workflow
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected', 'cancelled'
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),

  // Cover arrangements
  coveredBy: integer("covered_by"), // Staff member covering
  coverNotes: text("cover_notes"),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Staff performance and KPIs
export const staffPerformance = pgTable("staff_performance", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),

  // Sales/Lettings Agent Metrics
  propertiesListed: integer("properties_listed"),
  propertiesSold: integer("properties_sold"),
  propertiesLet: integer("properties_let"),
  viewingsConducted: integer("viewings_conducted"),
  valuationsCompleted: integer("valuations_completed"),

  // Revenue Metrics
  totalRevenue: integer("total_revenue"), // In pence
  commissionEarned: integer("commission_earned"), // In pence
  targetAchievement: decimal("target_achievement"), // Percentage

  // Maintenance Staff Metrics
  ticketsCompleted: integer("tickets_completed"),
  averageResolutionTime: decimal("average_resolution_time"), // Hours
  customerSatisfaction: decimal("customer_satisfaction"), // 1-5 scale

  // General Metrics
  attendanceRate: decimal("attendance_rate"), // Percentage
  punctualityRate: decimal("punctuality_rate"), // Percentage

  // Manager Notes
  managerNotes: text("manager_notes"),
  improvementAreas: text("improvement_areas").array(),
  achievements: text("achievements").array(),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Staff training and development
export const staffTraining = pgTable("staff_training", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),

  trainingTitle: text("training_title").notNull(),
  trainingType: text("training_type"), // 'internal', 'external', 'online', 'workshop'
  provider: text("provider"),

  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  duration: integer("duration"), // Hours

  // Completion
  status: text("status").notNull().default("enrolled"), // 'enrolled', 'in_progress', 'completed', 'failed'
  completionDate: timestamp("completion_date"),
  certificateUrl: text("certificate_url"),

  // Cost
  cost: integer("cost"), // In pence
  paidBy: text("paid_by"), // 'company', 'employee', 'shared'

  // Effectiveness
  preAssessmentScore: integer("pre_assessment_score"),
  postAssessmentScore: integer("post_assessment_score"),
  feedbackRating: integer("feedback_rating"), // 1-5

  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Property workflow management - tracks entire property journey
export const propertyWorkflows = pgTable("property_workflows", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id"),

  // Workflow stages
  currentStage: text("current_stage").notNull().default("valuation_requested"),
  // 'valuation_requested', 'valuation_scheduled', 'valuation_completed', 'instruction_pending', 
  // 'instruction_signed', 'listing_preparation', 'listed', 'viewing_scheduled', 'offer_received',
  // 'offer_accepted', 'contracts_preparing', 'contracts_sent', 'contracts_exchanged', 'completed'

  // Valuation details
  valuationRequestDate: timestamp("valuation_request_date"),
  valuationDate: timestamp("valuation_date"),
  valuationAmount: integer("valuation_amount"),
  valuationNotes: text("valuation_notes"),
  valuationAgent: integer("valuation_agent"), // User ID of valuation agent

  // Instruction details
  instructionDate: timestamp("instruction_date"),
  vendorId: integer("vendor_id"), // User ID of vendor/landlord
  askingPrice: integer("asking_price"),
  minimumAcceptablePrice: integer("minimum_acceptable_price"),

  // Marketing
  marketingStartDate: timestamp("marketing_start_date"),
  marketingMaterials: json("marketing_materials"), // Photos, floor plans, EPC, etc.

  // Tracking
  totalViewings: integer("total_viewings").default(0),
  totalOffers: integer("total_offers").default(0),
  daysOnMarket: integer("days_on_market"),

  // Sale/Let completion
  buyerId: integer("buyer_id"), // User ID of buyer/tenant
  agreedPrice: integer("agreed_price"),
  exchangeDate: timestamp("exchange_date"),
  completionDate: timestamp("completion_date"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Viewing appointments management
export const viewingAppointments = pgTable("viewing_appointments", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),

  // Viewer details
  viewerName: text("viewer_name").notNull(),
  viewerEmail: text("viewer_email").notNull(),
  viewerPhone: text("viewer_phone").notNull(),
  viewerNotes: text("viewer_notes"),

  // Appointment details
  scheduledDate: timestamp("scheduled_date").notNull(),
  duration: integer("duration").default(30), // Minutes
  appointmentType: text("appointment_type"), // 'in_person', 'virtual', 'open_house'

  // Agent assignment
  assignedAgentId: integer("assigned_agent_id"),

  // Status tracking
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
  confirmationSent: boolean("confirmation_sent").default(false),
  reminderSent: boolean("reminder_sent").default(false),

  // Feedback
  attended: boolean("attended"),
  feedbackRating: integer("feedback_rating"), // 1-5
  feedbackNotes: text("feedback_notes"),
  interestedInOffer: boolean("interested_in_offer"),

  // Follow-up
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date"),
  followUpNotes: text("follow_up_notes"),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Offers management
export const propertyOffers = pgTable("property_offers", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  workflowId: integer("workflow_id"),

  // Offer details
  offerAmount: integer("offer_amount").notNull(),
  offerType: text("offer_type"), // 'asking_price', 'below_asking', 'above_asking'

  // Buyer details
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerPhone: text("buyer_phone").notNull(),
  buyerPosition: text("buyer_position"), // 'cash', 'mortgage_approved', 'mortgage_required', 'chain'

  // Chain details
  isInChain: boolean("is_in_chain").default(false),
  chainDetails: text("chain_details"),

  // Conditions
  conditions: text("conditions").array(), // ['subject_to_survey', 'subject_to_mortgage', etc.]
  proposedCompletionDate: timestamp("proposed_completion_date"),

  // Status
  status: text("status").notNull().default("pending"), // 'pending', 'under_review', 'accepted', 'rejected', 'withdrawn'

  // Negotiation
  counterOfferAmount: integer("counter_offer_amount"),
  counterOfferDate: timestamp("counter_offer_date"),
  finalAgreedAmount: integer("final_agreed_amount"),

  // Decision
  decisionDate: timestamp("decision_date"),
  decisionBy: integer("decision_by"), // User ID who made decision
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Contract and document management
export const contractDocuments = pgTable("contract_documents", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  workflowId: integer("workflow_id"),
  offerId: integer("offer_id"),

  // Document details
  documentType: text("document_type").notNull(),
  // 'sales_contract', 'tenancy_agreement', 'instruction_letter', 'epc', 'gas_safety',
  // 'electrical_safety', 'property_questionnaire', 'fixtures_fittings', 'memorandum_of_sale'

  documentName: text("document_name").notNull(),
  documentUrl: text("document_url"),

  // DocuSign integration
  docusignEnvelopeId: text("docusign_envelope_id"),
  docusignStatus: text("docusign_status"), // 'created', 'sent', 'delivered', 'signed', 'completed', 'voided'

  // Signatories
  signatories: json("signatories"), // [{ name, email, role, signedAt }]

  // Tracking
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  signedAt: timestamp("signed_at"),
  completedAt: timestamp("completed_at"),

  // Reminders
  reminderCount: integer("reminder_count").default(0),
  lastReminderSent: timestamp("last_reminder_sent"),

  // Status
  status: text("status").notNull().default("draft"), // 'draft', 'pending_signature', 'signed', 'executed'

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Customer enquiry automation
export const customerEnquiries = pgTable("customer_enquiries", {
  id: serial("id").primaryKey(),

  // Enquiry source
  source: text("source").notNull(), // 'website', 'phone', 'email', 'portal', 'walk_in'
  sourceDetails: text("source_details"), // Which portal, which email, etc.

  // Customer details
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),

  // Enquiry details
  enquiryType: text("enquiry_type").notNull(), // 'buying', 'selling', 'renting', 'letting', 'valuation'
  propertyId: integer("property_id"), // If about specific property
  message: text("message"),

  // Requirements
  budget: text("budget"),
  moveDate: timestamp("move_date"),
  requirements: json("requirements"), // { bedrooms, location, propertyType, etc. }

  // Lead scoring
  leadScore: integer("lead_score"), // AI-calculated 1-100
  leadTemperature: text("lead_temperature"), // 'hot', 'warm', 'cold'

  // Assignment and follow-up
  assignedToId: integer("assigned_to_id"),
  assignedAt: timestamp("assigned_at"),

  // Automation status
  autoResponseSent: boolean("auto_response_sent").default(false),
  propertyMatchesSent: boolean("property_matches_sent").default(false),
  viewingInviteSent: boolean("viewing_invite_sent").default(false),

  // Status tracking
  status: text("status").notNull().default("new"), // 'new', 'contacted', 'qualified', 'viewing_booked', 'offer_made', 'converted', 'lost'

  // Conversion tracking
  convertedToViewing: boolean("converted_to_viewing").default(false),
  convertedToOffer: boolean("converted_to_offer").default(false),
  convertedToSale: boolean("converted_to_sale").default(false),

  // Follow-up schedule
  nextFollowUp: timestamp("next_follow_up"),
  followUpCount: integer("follow_up_count").default(0),
  lastContactedAt: timestamp("last_contacted_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Automated communication templates
export const communicationTemplates = pgTable("communication_templates", {
  id: serial("id").primaryKey(),

  templateName: text("template_name").notNull(),
  templateType: text("template_type").notNull(),
  // 'email', 'sms', 'whatsapp', 'letter', 'contract'

  triggerEvent: text("trigger_event"),
  // 'new_enquiry', 'valuation_booked', 'viewing_scheduled', 'offer_received', 
  // 'offer_accepted', 'contract_ready', 'exchange_complete'

  subject: text("subject"),
  content: text("content").notNull(), // Can include placeholders like {{customer_name}}

  // Attachments
  attachments: text("attachments").array(),

  // DocuSign template
  docusignTemplateId: text("docusign_template_id"),

  // Settings
  isActive: boolean("is_active").default(true),
  sendDelay: integer("send_delay"), // Minutes after trigger

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Property Management - Maintenance Requests
export const maintenanceRequests = pgTable("maintenance_requests", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  tenantId: integer("tenant_id").notNull(),

  // Request details
  issueType: text("issue_type").notNull(),
  // 'plumbing', 'electrical', 'heating', 'appliance', 'structural', 'pest', 'cleaning', 'other'

  priority: text("priority").notNull().default("medium"), // 'emergency', 'high', 'medium', 'low'
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location"), // Room/area in property

  // AI categorization
  aiCategory: text("ai_category"), // AI-determined category
  aiPriority: text("ai_priority"), // AI-assessed priority
  aiSuggestedContractor: text("ai_suggested_contractor"),

  // Status tracking
  status: text("status").notNull().default("reported"),
  // 'reported', 'triaged', 'assigned', 'in_progress', 'awaiting_parts', 'completed', 'closed'

  // Assignment
  assignedContractorId: integer("assigned_contractor_id"),
  assignedAt: timestamp("assigned_at"),

  // Timeline
  reportedAt: timestamp("reported_at").notNull().defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  scheduledDate: timestamp("scheduled_date"),
  completedAt: timestamp("completed_at"),
  closedAt: timestamp("closed_at"),

  // Cost tracking
  estimatedCost: integer("estimated_cost"), // In pence
  actualCost: integer("actual_cost"),
  paidBy: text("paid_by"), // 'landlord', 'tenant', 'agency', 'insurance'

  // Attachments
  photos: text("photos").array(), // URLs to uploaded photos
  documents: text("documents").array(), // Invoices, reports, etc.

  // Feedback
  tenantSatisfaction: integer("tenant_satisfaction"), // 1-5 rating
  completionNotes: text("completion_notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Work Orders for maintenance
export const workOrders = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  maintenanceRequestId: integer("maintenance_request_id").notNull(),
  contractorId: integer("contractor_id").notNull(),

  // Work details
  workOrderNumber: text("work_order_number").notNull(),
  scope: text("scope").notNull(), // Detailed work description

  // Schedule
  scheduledStart: timestamp("scheduled_start").notNull(),
  scheduledEnd: timestamp("scheduled_end"),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),

  // Access
  accessInstructions: text("access_instructions"),
  keyLocation: text("key_location"),
  tenantPresenceRequired: boolean("tenant_presence_required").default(false),

  // Status
  status: text("status").notNull().default("scheduled"),
  // 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'failed'

  // Cost
  quotedAmount: integer("quoted_amount"),
  invoiceNumber: text("invoice_number"),
  invoiceAmount: integer("invoice_amount"),
  invoiceUrl: text("invoice_url"),

  // Completion
  completionReport: text("completion_report"),
  photosBeforeWork: text("photos_before_work").array(),
  photosAfterWork: text("photos_after_work").array(),

  // Follow-up
  followUpRequired: boolean("follow_up_required").default(false),
  followUpNotes: text("follow_up_notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Landlords table for property management (can be company or individual)
export const landlords = pgTable("landlords", {
  id: serial("id").primaryKey(),

  // Type: company or individual
  landlordType: text("landlord_type").notNull().default("individual"), // 'company' or 'individual'

  // Landlord/Company details
  name: text("name").notNull(),
  email: text("email"),
  mobile: text("mobile"),
  phone: text("phone"),

  // Address
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  postcode: text("postcode"),

  // Company details (if applicable - landlordType = 'company')
  companyName: text("company_name"),
  companyRegistrationNo: text("company_registration_no"),
  companyVatNo: text("company_vat_no"),
  companyAddressLine1: text("company_address_line1"),
  companyAddressLine2: text("company_address_line2"),
  companyCity: text("company_city"),
  companyPostcode: text("company_postcode"),
  directorName: text("director_name"),
  directorEmail: text("director_email"),
  directorPhone: text("director_phone"),

  // Individual-specific fields (landlordType = 'individual')
  dateOfBirth: timestamp("date_of_birth"),
  nationalInsuranceNo: text("national_insurance_no"),

  // Bank details for rent payments
  bankAccountNo: text("bank_account_no"),
  sortCode: text("sort_code"),
  bankName: text("bank_name"),
  accountHolderName: text("account_holder_name"),

  // KYC references - FK to separate KYC tables
  personalKycId: integer("personal_kyc_id"), // FK to personal_kyc (for individuals)
  corporateKycId: integer("corporate_kyc_id"), // FK to corporate_kyc (for companies)

  // Status
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Personal KYC - for individual landlords
export const personalKyc = pgTable("personal_kyc", {
  id: serial("id").primaryKey(),

  // Identity documents
  passportUrl: text("passport_url"),
  passportNumber: text("passport_number"),
  passportExpiry: timestamp("passport_expiry"),

  drivingLicenseUrl: text("driving_license_url"),
  drivingLicenseNumber: text("driving_license_number"),
  drivingLicenseExpiry: timestamp("driving_license_expiry"),

  nationalIdUrl: text("national_id_url"),
  nationalIdNumber: text("national_id_number"),

  // Proof of address
  proofOfAddressUrl: text("proof_of_address_url"),
  proofOfAddressType: text("proof_of_address_type"), // 'utility_bill', 'bank_statement', 'council_tax'
  proofOfAddressDate: timestamp("proof_of_address_date"),

  // Verification status
  verified: boolean("verified").default(false),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: integer("verified_by"), // User ID who verified
  verificationNotes: text("verification_notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Corporate KYC - for company landlords
export const corporateKyc = pgTable("corporate_kyc", {
  id: serial("id").primaryKey(),

  // Company registration documents
  certificateOfIncorporationUrl: text("certificate_of_incorporation_url"),
  companyRegistrationNumber: text("company_registration_number"),

  memorandumOfAssociationUrl: text("memorandum_of_association_url"),
  articlesOfAssociationUrl: text("articles_of_association_url"),

  // Director/Shareholder information
  proofOfDirectorIdUrl: text("proof_of_director_id_url"),
  shareholderListUrl: text("shareholder_list_url"),

  // Bank and financial
  companyBankStatementUrl: text("company_bank_statement_url"),
  vatCertificateUrl: text("vat_certificate_url"),

  // Registered address proof
  registeredAddressProofUrl: text("registered_address_proof_url"),

  // Verification status
  verified: boolean("verified").default(false),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: integer("verified_by"), // User ID who verified
  verificationNotes: text("verification_notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Rental agreements/tenancies linking properties to landlords
export const rentalAgreements = pgTable("rental_agreements", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  landlordId: integer("landlord_id").notNull(),
  tenantId: integer("tenant_id"), // User ID of tenant

  // Rent details
  rentAmount: integer("rent_amount").notNull(), // In pence
  rentFrequency: text("rent_frequency").notNull(), // 'Monthly', 'Weekly', 'Quarterly', 'Annually'
  rentStartDate: timestamp("rent_start_date"),
  rentEndDate: timestamp("rent_end_date"),

  // Management
  managementFeePercent: decimal("management_fee_percent"),
  managementFeeFixed: integer("management_fee_fixed"), // Fixed fee in pence if not percentage
  managementPeriod: text("management_period"), // 'Monthly', 'Quarterly', 'Annually'
  managementStartDate: timestamp("management_start_date"),
  managementEndDate: timestamp("management_end_date"),

  // Tenancy dates
  tenancyStart: timestamp("tenancy_start"),
  tenancyEnd: timestamp("tenancy_end"),

  // Deposit
  depositHeldBy: text("deposit_held_by"), // 'DPS', 'TDS', 'Landlord', 'Agency'
  depositAmount: integer("deposit_amount"),
  depositProtectionRef: text("deposit_protection_ref"), // Reference number

  // Standing Order
  standingOrderSetup: boolean("standing_order_setup").default(false),
  standingOrderRef: text("standing_order_ref"),

  // Status
  status: text("status").notNull().default("active"), // 'active', 'expired', 'terminated'

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Tenants - linking users to properties they rent with due diligence tracking
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Reference to users table
  propertyId: integer("property_id").notNull(), // Reference to properties table
  rentalAgreementId: integer("rental_agreement_id"), // Reference to rental_agreements

  // Tenant details
  moveInDate: timestamp("move_in_date"),
  moveOutDate: timestamp("move_out_date"),

  // Contact preferences
  preferredContactMethod: text("preferred_contact_method").default("email"), // 'email', 'phone', 'whatsapp', 'sms'
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),

  // Due diligence - Reference checks
  workReference: text("work_reference"), // 'pending', 'verified', 'not_required', 'failed'
  workReferenceNotes: text("work_reference_notes"),
  workReferenceDate: timestamp("work_reference_date"),

  bankReference: text("bank_reference"), // 'pending', 'verified', 'not_required', 'failed'
  bankReferenceNotes: text("bank_reference_notes"),
  bankReferenceDate: timestamp("bank_reference_date"),

  previousLandlordReference: text("previous_landlord_reference"), // 'pending', 'verified', 'not_required', 'failed'
  previousLandlordReferenceNotes: text("previous_landlord_reference_notes"),
  previousLandlordReferenceDate: timestamp("previous_landlord_reference_date"),

  // ID Verification
  idVerified: boolean("id_verified").default(false),
  idDocumentUrl: text("id_document_url"),
  idVerificationDate: timestamp("id_verification_date"),

  // Guarantor details
  guarantorName: text("guarantor_name"),
  guarantorContact: text("guarantor_contact"),
  guarantorAddress: text("guarantor_address"),
  guarantorAgreementSigned: boolean("guarantor_agreement_signed").default(false),
  guarantorAgreementUrl: text("guarantor_agreement_url"),

  // Status
  status: text("status").notNull().default("active"), // 'active', 'notice_given', 'moved_out', 'evicted'

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Managed Property Documents - checklist items and file references
export const managedPropertyDocuments = pgTable("managed_property_documents", {
  id: serial("id").primaryKey(),
  rentalAgreementId: integer("rental_agreement_id").notNull(),
  propertyId: integer("property_id").notNull(),

  // Document type
  documentType: text("document_type").notNull(),
  // 'tenancy_agreement', 'notices', 'guarantor_agreement', 'standing_order',
  // 'inventory', 'deposit_dps', 'deposit_tds', 'deposit_landlord',
  // 'work_reference', 'bank_reference', 'previous_landlord_reference',
  // 'tenant_id', 'authorization_landlord', 'terms_conditions',
  // 'info_sheet_landlord', 'gas_safety_certificate'

  // Document status
  status: text("status").notNull().default("pending"), // 'pending', 'uploaded', 'verified', 'expired'

  // File details (if uploaded)
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),

  // Metadata
  notes: text("notes"),
  expiryDate: timestamp("expiry_date"),
  uploadedBy: integer("uploaded_by"),
  verifiedBy: integer("verified_by"),
  verifiedAt: timestamp("verified_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Property Inventory
export const propertyInventories = pgTable("property_inventories", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  rentalAgreementId: integer("rental_agreement_id"),

  // Inventory details
  checkInDate: timestamp("check_in_date"),
  checkOutDate: timestamp("check_out_date"),
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed'

  // Clerk/Inspector
  clerkName: text("clerk_name"),
  clerkCompany: text("clerk_company"),

  // Summary
  overallCondition: text("overall_condition"), // 'excellent', 'good', 'fair', 'poor'
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Inventory Items
export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id").notNull(),

  // Item details
  room: text("room").notNull(),
  itemName: text("item_name").notNull(),
  description: text("description"),
  condition: text("condition").notNull(), // 'new', 'good', 'fair', 'worn', 'damaged'
  quantity: integer("quantity").default(1),

  // Photos
  photos: text("photos").array(),

  // Check-out comparison
  checkOutCondition: text("check_out_condition"),
  checkOutNotes: text("check_out_notes"),
  damageAssessed: boolean("damage_assessed").default(false),
  damageAmount: integer("damage_amount"),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Contractors/Vendors
export const contractors = pgTable("contractors", {
  id: serial("id").primaryKey(),

  // Company details
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  emergencyPhone: text("emergency_phone"),

  // Specializations
  specializations: text("specializations").array(),
  // ['plumbing', 'electrical', 'gas', 'general', 'roofing', 'painting', etc.]

  // Certifications
  gasRegistrationNumber: text("gas_registration_number"),
  electricalCertNumber: text("electrical_cert_number"),
  insuranceExpiryDate: timestamp("insurance_expiry_date"),

  // Service area
  serviceAreas: text("service_areas").array(), // Postcodes/areas covered

  // Availability
  availableEmergency: boolean("available_emergency").default(false),
  responseTime: text("response_time"), // '1 hour', '4 hours', '24 hours', '48 hours'

  // Pricing
  callOutFee: integer("call_out_fee"),
  hourlyRate: integer("hourly_rate"),

  // Performance
  rating: integer("rating"), // Average rating 1-5
  completedJobs: integer("completed_jobs").default(0),

  // Status
  isActive: boolean("is_active").default(true),
  preferredContractor: boolean("preferred_contractor").default(false),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Property Certifications Management
export const propertyCertifications = pgTable("property_certifications", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),

  // Certification type
  certificationType: text("certification_type").notNull(),
  // 'gas_safety', 'electrical_safety', 'epc', 'eicr', 'fire_safety', 
  // 'legionella', 'asbestos', 'hmo_license', 'selective_license'

  // Certificate details
  certificateNumber: text("certificate_number"),
  issuedBy: text("issued_by"), // Contractor/inspector name
  issuedByCompany: text("issued_by_company"),

  // Dates
  inspectionDate: timestamp("inspection_date").notNull(),
  issueDate: timestamp("issue_date").notNull(),
  expiryDate: timestamp("expiry_date").notNull(),

  // Document
  certificateUrl: text("certificate_url"),

  // Status
  status: text("status").notNull().default("valid"), // 'valid', 'expiring_soon', 'expired'

  // Reminders sent
  firstReminderSent: boolean("first_reminder_sent").default(false), // 60 days before
  secondReminderSent: boolean("second_reminder_sent").default(false), // 30 days before
  finalReminderSent: boolean("final_reminder_sent").default(false), // 7 days before
  expiryNoticeSent: boolean("expiry_notice_sent").default(false),

  // Next inspection
  nextInspectionScheduled: timestamp("next_inspection_scheduled"),
  nextInspectionContractorId: integer("next_inspection_contractor_id"),

  // Compliance
  complianceNotes: text("compliance_notes"),
  failureReasons: text("failure_reasons"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Certification reminder schedule
export const certificationReminders = pgTable("certification_reminders", {
  id: serial("id").primaryKey(),
  certificationId: integer("certification_id").notNull(),
  propertyId: integer("property_id").notNull(),

  // Reminder details
  reminderType: text("reminder_type").notNull(), // 'first', 'second', 'final', 'expired'
  daysBeforeExpiry: integer("days_before_expiry").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),

  // Recipients
  sendToLandlord: boolean("send_to_landlord").default(true),
  sendToAgent: boolean("send_to_agent").default(true),
  sendToTenant: boolean("send_to_tenant").default(false),

  // Status
  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'failed', 'cancelled'
  sentAt: timestamp("sent_at"),

  // Response
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),

  // Action taken
  actionTaken: text("action_taken"), // 'inspection_booked', 'contractor_assigned', 'ignored'

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Property inspection reports
export const inspectionReports = pgTable("inspection_reports", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),

  // Inspection details
  inspectionType: text("inspection_type").notNull(),
  // 'routine', 'move_in', 'move_out', 'quarterly', 'annual', 'emergency'

  inspectorId: integer("inspector_id"), // User ID of inspector
  inspectionDate: timestamp("inspection_date").notNull(),

  // Condition assessment
  overallCondition: text("overall_condition"), // 'excellent', 'good', 'fair', 'poor'

  // Room-by-room assessment
  roomAssessments: json("room_assessments"),
  // [{ room: 'kitchen', condition: 'good', issues: [], photos: [] }]

  // Issues found
  issuesFound: json("issues_found"),
  // [{ type: 'maintenance', severity: 'high', description: '', action: '' }]

  // Meter readings
  gasReading: text("gas_reading"),
  electricityReading: text("electricity_reading"),
  waterReading: text("water_reading"),

  // Documentation
  reportUrl: text("report_url"),
  photos: text("photos").array(),

  // Follow-up
  maintenanceRequired: boolean("maintenance_required").default(false),
  urgentIssues: boolean("urgent_issues").default(false),
  followUpDate: timestamp("follow_up_date"),

  // Tenant present
  tenantPresent: boolean("tenant_present"),
  tenantSignature: text("tenant_signature"),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Favorites Lists (for organizing saved properties)
export const favoritesLists = pgTable("favorites_lists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),

  // List details
  listName: text("list_name").notNull(), // "Dream Homes", "Investment Properties", etc.
  description: text("description"),

  // Settings
  isDefault: boolean("is_default").default(false), // Default list for quick saves
  isPublic: boolean("is_public").default(false), // Can be shared with others

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Saved Properties by users (now linked to favorites lists)
export const savedProperties = pgTable("saved_properties", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  propertyId: integer("property_id").notNull(),
  listId: integer("list_id"), // Optional: can be in a specific list or standalone

  // Save details
  savedAt: timestamp("saved_at").notNull().defaultNow(),
  notes: text("notes"), // User's personal notes about the property

  // Notifications
  priceAlerts: boolean("price_alerts").default(true), // Alert if price changes
  statusAlerts: boolean("status_alerts").default(true), // Alert if status changes

  // Unique constraint to prevent duplicate saves in same list
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => {
  return {
    userPropertyListUnique: uniqueIndex("user_property_list_unique").on(table.userId, table.propertyId, table.listId)
  };
});

// Tenant Support Tickets
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  propertyId: integer("property_id").notNull(),

  // Ticket details
  ticketNumber: text("ticket_number").notNull().unique(),
  category: text("category").notNull(),
  // 'plumbing', 'electrical', 'heating', 'appliances', 'structural', 'pest', 'exterior', 'billing', 'general'

  subject: text("subject").notNull(),
  description: text("description").notNull(),

  // Priority and status
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
  status: text("status").notNull().default("open"), // 'open', 'in_progress', 'waiting_tenant', 'resolved', 'closed'

  // Workflow status - tracks the maintenance job lifecycle
  workflowStatus: text("workflow_status").default("new"),
  // 'new' - ticket just created
  // 'contractor_notified' - job sent to contractor
  // 'awaiting_quote' - waiting for contractor quote
  // 'quote_received' - quote received from contractor
  // 'quote_approved' - property manager approved
  // 'quote_rejected' - property manager rejected, needs re-routing
  // 'scheduled' - work scheduled with contractor
  // 'in_work' - contractor working on job
  // 'completed' - work completed
  // 'invoiced' - invoice received
  // 'paid' - invoice paid

  // Assignment - now tracks both property manager and contractor
  assignedToId: integer("assigned_to_id"), // Property manager handling the ticket
  assignedAt: timestamp("assigned_at"),
  contractorId: integer("contractor_id"), // Assigned contractor
  contractorAssignedAt: timestamp("contractor_assigned_at"),

  // Current active quote
  activeQuoteId: integer("active_quote_id"),

  // Related maintenance request if applicable
  maintenanceRequestId: integer("maintenance_request_id"),

  // Resolution
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),

  // Satisfaction
  satisfactionRating: integer("satisfaction_rating"), // 1-5
  satisfactionComment: text("satisfaction_comment"),

  // Attachments
  attachments: text("attachments").array(), // URLs to uploaded files

  // Escalation tracking
  escalationLevel: integer("escalation_level").default(0),
  lastEscalatedAt: timestamp("last_escalated_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Ticket Comments/Conversation
export const ticketComments = pgTable("ticket_comments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  userId: integer("user_id").notNull(),

  comment: text("comment").notNull(),
  isInternal: boolean("is_internal").default(false), // Internal notes not visible to tenant

  attachments: text("attachments").array(),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Contractor Quotes for Support Tickets
export const contractorQuotes = pgTable("contractor_quotes", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  contractorId: integer("contractor_id").notNull(),

  // Quote details
  quoteAmount: integer("quote_amount"), // In pence
  quoteDescription: text("quote_description"),
  estimatedDuration: text("estimated_duration"), // '2 hours', '1 day', etc.
  availableDate: timestamp("available_date"), // When contractor can do the work

  // Status workflow
  status: text("status").notNull().default("pending"),
  // 'pending' - waiting for contractor response
  // 'accepted' - contractor accepted the job
  // 'quoted' - contractor provided a quote
  // 'declined' - contractor declined
  // 'approved' - property manager approved quote
  // 'rejected' - property manager rejected quote
  // 'scheduled' - work scheduled
  // 'in_progress' - work in progress
  // 'completed' - work completed
  // 'cancelled' - quote/job cancelled

  // Response tracking
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  contractorResponse: text("contractor_response"), // Raw response from contractor

  // Approval workflow
  approvedById: integer("approved_by_id"), // Property manager who approved
  approvedAt: timestamp("approved_at"),
  approvalNotes: text("approval_notes"),

  // Scheduling
  scheduledDate: timestamp("scheduled_date"),
  scheduledTimeSlot: text("scheduled_time_slot"), // 'morning', 'afternoon', '9am-12pm'

  // Completion
  completedAt: timestamp("completed_at"),
  completionNotes: text("completion_notes"),
  completionPhotos: text("completion_photos").array(),

  // Invoice
  invoiceNumber: text("invoice_number"),
  finalAmount: integer("final_amount"), // Actual amount charged
  invoicePaid: boolean("invoice_paid").default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Ticket Workflow Events - tracks every state change for property manager visibility
export const ticketWorkflowEvents = pgTable("ticket_workflow_events", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  quoteId: integer("quote_id"), // Link to contractor quote if applicable

  // Event details
  eventType: text("event_type").notNull(),
  // 'ticket_created', 'contractor_notified', 'contractor_accepted', 'contractor_declined',
  // 'quote_received', 'quote_approved', 'quote_rejected', 'work_scheduled',
  // 'work_started', 'work_completed', 'tenant_notified', 'ticket_closed',
  // 'escalated', 'reassigned'

  previousStatus: text("previous_status"),
  newStatus: text("new_status"),

  // Who triggered the event
  triggeredBy: text("triggered_by"), // 'system', 'contractor', 'property_manager', 'tenant'
  userId: integer("user_id"), // User ID if triggered by a person

  // Event details
  title: text("title").notNull(),
  description: text("description"),
  metadata: json("metadata"), // Additional event-specific data

  // Communication tracking
  notificationSent: boolean("notification_sent").default(false),
  notificationChannels: text("notification_channels").array(), // ['whatsapp', 'email', 'sms']

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Property search alerts for users
export const propertyAlerts = pgTable("property_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),

  // Alert criteria
  alertName: text("alert_name").notNull(),
  searchCriteria: json("search_criteria").notNull(),
  // { minPrice, maxPrice, minBedrooms, propertyType, areas: [], features: [] }

  // Frequency
  frequency: text("frequency").notNull().default("daily"), // 'instant', 'daily', 'weekly'

  // Delivery
  emailAlert: boolean("email_alert").default(true),
  smsAlert: boolean("sms_alert").default(false),
  pushAlert: boolean("push_alert").default(false),

  // Status
  isActive: boolean("is_active").default(true),
  lastTriggered: timestamp("last_triggered"),
  matchCount: integer("match_count").default(0),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Mailing list subscriptions
export const mailingListSubscriptions = pgTable("mailing_list_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  email: text("email").notNull(),

  // Subscription preferences
  generalNewsletter: boolean("general_newsletter").default(true),
  propertyUpdates: boolean("property_updates").default(true),
  marketInsights: boolean("market_insights").default(false),
  investmentOpportunities: boolean("investment_opportunities").default(false),

  // Status
  isActive: boolean("is_active").default(true),
  unsubscribedAt: timestamp("unsubscribed_at"),
  unsubscribeToken: text("unsubscribe_token").unique(),

  // Source
  source: text("source"), // 'website_signup', 'registration', 'viewing_request', etc.

  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => {
  return {
    emailIdx: uniqueIndex("mailing_email_idx").on(table.email)
  };
});

// User property preferences/profiles
export const userPropertyPreferences = pgTable("user_property_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),

  // Profile name
  profileName: text("profile_name").notNull(), // "Family Home", "Investment Property", etc.

  // Property preferences
  propertyTypes: text("property_types").array(), // ['house', 'flat', 'apartment']
  listingTypes: text("listing_types").array(), // ['sale', 'rent']

  // Price range
  minPrice: integer("min_price"),
  maxPrice: integer("max_price"),

  // Property details
  minBedrooms: integer("min_bedrooms"),
  maxBedrooms: integer("max_bedrooms"),
  minBathrooms: integer("min_bathrooms"),

  // Location preferences
  preferredAreas: text("preferred_areas").array(), // Array of area names
  maxDistanceFromTransport: integer("max_distance_from_transport"), // in meters

  // Features
  mustHaveFeatures: text("must_have_features").array(), // ['parking', 'garden', etc.]
  niceToHaveFeatures: text("nice_to_have_features").array(),

  // Investment criteria (if applicable)
  minYield: decimal("min_yield"),
  investmentBudget: integer("investment_budget"),

  // Status
  isActive: boolean("is_active").default(true),
  isPrimary: boolean("is_primary").default(false), // Is this the main profile?

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// User activity tracking
export const userActivities = pgTable("user_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),

  activityType: text("activity_type").notNull(),
  // 'property_view', 'property_save', 'enquiry_sent', 'viewing_booked', 
  // 'ticket_created', 'document_uploaded', 'payment_made'

  entityType: text("entity_type"), // 'property', 'ticket', 'viewing', etc.
  entityId: integer("entity_id"),

  metadata: json("metadata"), // Additional activity details
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Admin User Audit Logs
export const adminUserAuditLogs = pgTable("admin_user_audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(), // Admin who performed the action
  targetUserId: integer("target_user_id"), // User being modified

  action: text("action").notNull(),
  // 'user_created', 'user_updated', 'user_deleted', 'role_changed', 
  // 'user_activated', 'user_deactivated', 'password_reset', 'bulk_update'

  previousData: json("previous_data"), // Data before change
  newData: json("new_data"), // Data after change

  details: text("details"), // Human-readable description

  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Social media posts tracking
export const socialMediaPosts = pgTable("social_media_posts", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  platform: text("platform").notNull(), // 'facebook', 'instagram', 'twitter', 'linkedin'

  // Post details
  postId: text("post_id"), // Platform's post ID
  postUrl: text("post_url"), // Direct link to the post
  postType: text("post_type"), // 'image', 'carousel', 'video', 'story'

  // Content
  caption: text("caption").notNull(),
  hashtags: text("hashtags").array(), // Array of hashtags used
  mediaUrls: text("media_urls").array(), // URLs of images/videos posted

  // Engagement metrics
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  views: integer("views").default(0),
  reach: integer("reach").default(0),

  // Status
  status: text("status").notNull().default("draft"), // 'draft', 'scheduled', 'published', 'failed'
  scheduledFor: timestamp("scheduled_for"),
  publishedAt: timestamp("published_at"),
  lastMetricsUpdate: timestamp("last_metrics_update"),

  // Campaign tracking
  campaignName: text("campaign_name"),
  targetAudience: text("target_audience"), // 'first_time_buyers', 'investors', 'families', etc

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Social media accounts configuration
export const socialMediaAccounts = pgTable("social_media_accounts", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull().unique(), // 'facebook', 'instagram', 'twitter'

  // Account details
  accountName: text("account_name"),
  accountId: text("account_id"),
  pageId: text("page_id"), // For Facebook pages

  // Authentication (encrypted)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),

  // Configuration
  isActive: boolean("is_active").default(true),
  autoPost: boolean("auto_post").default(false), // Auto-post new properties
  postTemplate: text("post_template"), // Default caption template
  defaultHashtags: text("default_hashtags").array(),

  // Metrics
  followers: integer("followers").default(0),
  following: integer("following").default(0),
  totalPosts: integer("total_posts").default(0),

  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});


// ==========================================
// PRD V3.0 UNIFIED CONTACTS & KYC SCHEMA
// ==========================================

// Unified contacts table for all stakeholder types
export const unifiedContacts = pgTable("unified_contacts", {
  id: serial("id").primaryKey(),
  contactType: text("contact_type").notNull(), // 'tenant', 'landlord', 'buyer', 'renter', 'contractor', 'vendor'
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),

  // Entity type
  isCompany: boolean("is_company").default(false),
  companyDetailsId: integer("company_details_id"), // FK to company_details

  // Status and Category
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'prospective', 'archived'
  category: text("category").notNull(), // 'hot', 'warm', 'cold'

  // Communication preferences
  preferredContactMethod: text("preferred_contact_method").default("email"),

  // Address info
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  postcode: text("postcode"),
  country: text("country").default("United Kingdom"),

  // Metadata
  notes: text("notes"),
  metadata: json("metadata"),

  // Compliance/KYC pointers
  kycVerified: boolean("kyc_verified").default(false),
  kycLastCheckedAt: timestamp("kyc_last_checked_at"),

  // Tracking
  source: text("source"), // 'website', 'referral', 'portal', etc.
  assignedAgentId: integer("assigned_agent_id"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Extended details for corporate entities
export const companyDetails = pgTable("company_details", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  companyName: text("company_name").notNull(),
  registrationNumber: text("registration_number"),
  vatNumber: text("vat_number"),
  registeredAddress: text("registered_address"),
  companyType: text("company_type"), // 'UK_LTD', 'UK_PLC', 'OVERSEAS', etc.
  jurisdiction: text("jurisdiction").default("United Kingdom"),

  // Contact persons within company
  primaryContactName: text("primary_contact_name"),
  primaryContactRole: text("primary_contact_role"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Beneficial owners for corporate contacts (25%+ ownership)
export const beneficialOwners = pgTable("beneficial_owners", {
  id: serial("id").primaryKey(),
  companyDetailsId: integer("company_details_id").notNull(),
  fullName: text("full_name").notNull(),
  ownershipPercentage: decimal("ownership_percentage"),
  isTrustee: boolean("is_trustee").default(false),
  nationality: text("nationality"),
  dateOfBirth: timestamp("date_of_birth"),
  address: text("address"),

  // KYC reference
  kycVerified: boolean("kyc_verified").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Unified KYC document tracking
export const kycDocuments = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id"), // Optional: linked to contact
  beneficialOwnerId: integer("beneficial_owner_id"), // Optional: linked to UBO

  documentType: text("document_type").notNull(),
  // 'passport', 'driving_license', 'utility_bill', 'bank_statement', 
  // 'cert_incorporation', 'articles_assoc', 'shareholder_list', 'trust_deed'

  documentNumber: text("document_number"),
  expiryDate: timestamp("expiry_date"),
  documentUrl: text("document_url"),

  // Verification
  status: text("status").notNull().default("pending"), // 'pending', 'verified', 'rejected', 'expired'
  verifiedBy: integer("verified_by"),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Contact status history for conversion tracking
export const contactStatusHistory = pgTable("contact_status_history", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  previousType: text("previous_type"), // For conversion from 'renter' to 'tenant'
  newType: text("new_type"),
  reason: text("reason"),
  changedBy: integer("changed_by"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Dedicated Managed Properties table
export const managedProperties = pgTable("managed_properties", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().unique(),
  landlordId: integer("landlord_id").notNull(), // Unified contact ID
  managementStartDate: timestamp("management_start_date").notNull(),
  managementEndDate: timestamp("management_end_date"),
  managementType: text("management_type").notNull(), // 'full', 'let_only', 'rent_collection'
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'prospective', 'archived'
  managementFeeType: text("management_fee_type"), // 'percentage' or 'fixed'
  managementFeeValue: decimal("management_fee_value"),

  // Compliance Master Status
  complianceScore: integer("compliance_score").default(0), // 0-100
  nextCriticalComplianceDate: timestamp("next_critical_compliance_date"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Managed Property Compliance Document Mapping
export const managedPropertyCompliance = pgTable("managed_property_compliance", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  requirementCode: text("requirement_code").notNull(), // Reference to compliance_requirements.code
  status: text("status").notNull().default("pending"),
  lastCompletedDate: timestamp("last_completed_date"),
  expiryDate: timestamp("expiry_date"),
  certificateId: integer("certificate_id"), // Reference to existing property_certificates if applicable
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Joint Tenants support
export const jointTenants = pgTable("joint_tenants", {
  id: serial("id").primaryKey(),
  tenancyContractId: integer("tenancy_contract_id").notNull(),
  contactId: integer("contact_id").notNull(), // Unified contact ID
  rentSharePercentage: decimal("rent_share_percentage"),
  isPrimary: boolean("is_primary").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Sales Progression Stages
export const salesProgression = pgTable("sales_progression", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().unique(),
  offerId: integer("offer_id"),

  // progression stages
  memoOfSaleSent: boolean("memo_of_sale_sent").default(false),
  solicitorsInstructed: boolean("solicitors_instructed").default(false),
  searchesOrdered: boolean("searches_ordered").default(false),
  searchesReceived: boolean("searches_received").default(false),
  surveyCompleted: boolean("survey_completed").default(false),
  mortgageOfferReceived: boolean("mortgage_offer_received").default(false),
  exchangeReady: boolean("exchange_ready").default(false),
  contractsExchanged: boolean("contracts_exchanged").default(false),
  completionScheduled: timestamp("completion_scheduled"),
  completed: boolean("completed").default(false),
  currentStage: text("current_stage").notNull().default("offer_accepted"),
  status: text("status").notNull().default("active"),
  buyerName: text("buyer_name"),
  buyerEmail: text("buyer_email"),
  solicitorName: text("solicitor_name"),

  // Solicitors info
  vendorSolicitor: text("vendor_solicitor"),
  buyerSolicitor: text("buyer_solicitor"),

  notes: text("notes"),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Property portal credentials (encrypted storage)
export const portalCredentials = pgTable("portal_credentials", {
  id: serial("id").primaryKey(),
  portalName: text("portal_name").notNull().unique(), // 'zoopla', 'propertyfinder', etc

  // Encrypted credentials
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  username: text("username"),
  password: text("password"), // Encrypted

  // API endpoints
  apiBaseUrl: text("api_base_url"),
  testMode: boolean("test_mode").default(false),

  // Status
  isActive: boolean("is_active").default(true),
  lastTestAt: timestamp("last_test_at"),
  lastTestSuccess: boolean("last_test_success"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// ==========================================
// RELATIONS FOR V3 TABLES
// ==========================================

export const unifiedContactsRelations = relations(unifiedContacts, ({ one, many }) => ({
  companyDetails: one(companyDetails, {
    fields: [unifiedContacts.companyDetailsId],
    references: [companyDetails.id]
  }),
  kycDocuments: many(kycDocuments),
  statusHistory: many(contactStatusHistory),
  assignedAgent: one(users, {
    fields: [unifiedContacts.assignedAgentId],
    references: [users.id]
  }),
  managedProperties: many(managedProperties),
  jointTenancies: many(jointTenants)
}));

export const companyDetailsRelations = relations(companyDetails, ({ one, many }) => ({
  contact: one(unifiedContacts, {
    fields: [companyDetails.contactId],
    references: [unifiedContacts.id]
  }),
  beneficialOwners: many(beneficialOwners)
}));

export const beneficialOwnersRelations = relations(beneficialOwners, ({ one, many }) => ({
  company: one(companyDetails, {
    fields: [beneficialOwners.companyDetailsId],
    references: [companyDetails.id]
  }),
  kycDocuments: many(kycDocuments)
}));

export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({
  contact: one(unifiedContacts, {
    fields: [kycDocuments.contactId],
    references: [unifiedContacts.id]
  }),
  beneficialOwner: one(beneficialOwners, {
    fields: [kycDocuments.beneficialOwnerId],
    references: [beneficialOwners.id]
  })
}));

export const managedPropertiesRelations = relations(managedProperties, ({ one, many }) => ({
  property: one(properties, {
    fields: [managedProperties.propertyId],
    references: [properties.id]
  }),
  landlord: one(unifiedContacts, {
    fields: [managedProperties.landlordId],
    references: [unifiedContacts.id]
  }),
  complianceItems: many(managedPropertyCompliance)
}));

export const jointTenantsRelations = relations(jointTenants, ({ one }) => ({
  contract: one(tenancyContracts, {
    fields: [jointTenants.tenancyContractId],
    references: [tenancyContracts.id]
  }),
  contact: one(unifiedContacts, {
    fields: [jointTenants.contactId],
    references: [unifiedContacts.id]
  })
}));

// Property relations
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  area: one(londonAreas, {
    fields: [properties.areaId],
    references: [londonAreas.id],
    relationName: "area_properties"
  }),
  inquiries: many(propertyInquiries, { relationName: "property_inquiries" }),
  portalListings: many(propertyPortalListings, { relationName: "property_portal_listings" }),
  maintenanceTickets: many(maintenanceTickets, { relationName: "property_tickets" })
}));

// London areas relations
export const londonAreasRelations = relations(londonAreas, ({ many }) => ({
  properties: many(properties, { relationName: "area_properties" })
}));

// Portal listings relations
export const propertyPortalListingsRelations = relations(propertyPortalListings, ({ one }) => ({
  property: one(properties, {
    fields: [propertyPortalListings.propertyId],
    references: [properties.id],
    relationName: "property_portal_listings"
  })
}));

// Social media posts relations
export const socialMediaPostsRelations = relations(socialMediaPosts, ({ one }) => ({
  property: one(properties, {
    fields: [socialMediaPosts.propertyId],
    references: [properties.id],
    relationName: "property_social_posts"
  })
}));

// Maintenance tickets relations
export const maintenanceTicketsRelations = relations(maintenanceTickets, ({ one, many }) => ({
  property: one(properties, {
    fields: [maintenanceTickets.propertyId],
    references: [properties.id],
    relationName: "property_tickets"
  }),
  tenant: one(users, {
    fields: [maintenanceTickets.tenantId],
    references: [users.id],
    relationName: "tenant_tickets"
  }),
  landlord: one(users, {
    fields: [maintenanceTickets.landlordId],
    references: [users.id],
    relationName: "landlord_tickets"
  }),
  assignedTo: one(users, {
    fields: [maintenanceTickets.assignedToId],
    references: [users.id],
    relationName: "assigned_tickets"
  }),
  updates: many(maintenanceTicketUpdates, { relationName: "ticket_updates" })
}));

// Maintenance ticket updates relations
export const maintenanceTicketUpdatesRelations = relations(maintenanceTicketUpdates, ({ one }) => ({
  ticket: one(maintenanceTickets, {
    fields: [maintenanceTicketUpdates.ticketId],
    references: [maintenanceTickets.id],
    relationName: "ticket_updates"
  }),
  user: one(users, {
    fields: [maintenanceTicketUpdates.userId],
    references: [users.id],
    relationName: "user_updates"
  })
}));

// Maintenance categories relations
export const maintenanceCategoriesRelations = relations(maintenanceCategories, ({ one }) => ({
  defaultAssignee: one(users, {
    fields: [maintenanceCategories.defaultAssigneeId],
    references: [users.id],
    relationName: "category_assignee"
  }),
  escalationTo: one(users, {
    fields: [maintenanceCategories.escalationToId],
    references: [users.id],
    relationName: "category_escalation"
  })
}));

// Property inquiries schema (for potential buyers/renters)
export const propertyInquiries = pgTable("property_inquiries", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  inquiryType: text("inquiry_type").notNull(), // 'viewing_request', 'information_request', 'offer'

  // Contact details
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),

  // Inquiry details
  message: text("message"),
  preferredViewingTimes: text("preferred_viewing_times"),
  financialPosition: text("financial_position"), // 'cash_buyer', 'mortgage_required', 'first_time_buyer', etc.

  // Status tracking
  status: text("status").notNull().default("new"), // 'new', 'contacted', 'viewing_arranged', 'closed'

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// General contact inquiries (valuation requests, general questions)
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  inquiryType: text("inquiry_type").notNull(), // 'valuation', 'selling', 'letting', 'general'

  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),

  // Property details for valuation/selling inquiries
  propertyAddress: text("property_address"),
  postcode: text("postcode"),
  propertyType: text("property_type"),
  bedrooms: integer("bedrooms"),

  message: text("message"),
  timeframe: text("timeframe"),

  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Property inquiry relations
export const propertyInquiriesRelations = relations(propertyInquiries, ({ one }) => ({
  property: one(properties, {
    fields: [propertyInquiries.propertyId],
    references: [properties.id],
    relationName: "property_inquiries"
  })
}));

// Property valuations for selling services
export const valuations = pgTable("valuations", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),

  // Property details
  propertyAddress: text("property_address").notNull(),
  postcode: text("postcode").notNull(),
  propertyType: text("property_type").notNull(),
  bedrooms: integer("bedrooms").notNull(),

  // Valuation results
  estimatedValue: integer("estimated_value"),
  valuationRange: text("valuation_range"), // "£850,000 - £950,000"

  // Valuation details
  comparableProperties: json("comparable_properties"), // JSON array of similar properties
  marketConditions: text("market_conditions"),
  recommendations: text("recommendations"),

  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'sent'
  valuationDate: timestamp("valuation_date"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Valuation relations
export const valuationsRelations = relations(valuations, ({ one }) => ({
  contact: one(contacts, {
    fields: [valuations.contactId],
    references: [contacts.id],
    relationName: "contact_valuations"
  })
}));

// Contact relations
export const contactsRelations = relations(contacts, ({ many }) => ({
  valuations: many(valuations, { relationName: "contact_valuations" })
}));

// User relations (expanded for CRM with multiple user roles)
export const usersRelations = relations(users, ({ many }) => ({
  tenantTickets: many(maintenanceTickets, { relationName: "tenant_tickets" }),
  landlordTickets: many(maintenanceTickets, { relationName: "landlord_tickets" }),
  assignedTickets: many(maintenanceTickets, { relationName: "assigned_tickets" }),
  ticketUpdates: many(maintenanceTicketUpdates, { relationName: "user_updates" }),
  defaultCategories: many(maintenanceCategories, { relationName: "category_assignee" }),
  escalationCategories: many(maintenanceCategories, { relationName: "category_escalation" }),
  tenantProfiles: many(tenants)
}));

// Tenant relations
export const tenantsRelations = relations(tenants, ({ one }) => ({
  user: one(users, {
    fields: [tenants.userId],
    references: [users.id]
  }),
  property: one(properties, {
    fields: [tenants.propertyId],
    references: [properties.id]
  }),
  rentalAgreement: one(rentalAgreements, {
    fields: [tenants.rentalAgreementId],
    references: [rentalAgreements.id]
  })
}));

// ============================================
// ESTATE AGENCY STAFF ROLES AND PERMISSIONS
// ============================================

// Estate Agency Roles - UK property industry specific roles
export const estateAgencyRoles = pgTable("estate_agency_roles", {
  id: serial("id").primaryKey(),
  roleCode: text("role_code").notNull().unique(),
  // Role codes: 'branch_manager', 'sales_negotiator', 'senior_sales_negotiator',
  // 'lettings_negotiator', 'property_manager', 'branch_administrator', 'mortgage_advisor'

  roleName: text("role_name").notNull(),
  description: text("description"),

  // Department the role belongs to
  department: text("department").notNull(), // 'sales', 'lettings', 'property_management', 'admin', 'financial_services', 'management'

  // Reporting structure
  reportsTo: text("reports_to"), // Role code this role reports to (e.g., 'area_manager' for branch_manager)

  // Required qualifications (UK property industry specific)
  requiredQualifications: text("required_qualifications").array(), // ['NAEA', 'ARLA', 'CeMAP']

  // Compensation type
  compensationType: text("compensation_type"), // 'salary', 'commission', 'salary_plus_commission'

  // Status
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Role permissions - what each role can access/do in the system
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull(),

  // Permission category
  category: text("category").notNull(),
  // Categories: 'sales', 'lettings', 'property_management', 'maintenance',
  // 'staff', 'finance', 'reports', 'marketing', 'compliance', 'system'

  // Specific permission
  permission: text("permission").notNull(),
  // Examples: 'view_listings', 'create_listings', 'edit_listings', 'delete_listings',
  // 'view_valuations', 'create_valuations', 'approve_valuations',
  // 'view_tenants', 'manage_tenants', 'view_landlords', 'manage_landlords',
  // 'assign_contractors', 'approve_quotes', 'view_financials', 'manage_staff'

  // Access level
  accessLevel: text("access_level").notNull().default("read"),
  // 'read', 'write', 'full' (read + write + delete)

  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => {
  return {
    rolePermissionUnique: uniqueIndex("role_permission_unique").on(table.roleId, table.category, table.permission)
  };
});

// Staff role assignments - links users to their assigned role
export const staffRoleAssignments = pgTable("staff_role_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  roleId: integer("role_id").notNull(),

  // Assignment details
  assignedBy: integer("assigned_by").notNull(), // Admin who assigned the role
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),

  // Date range for the assignment (for temporary promotions/acting roles)
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  effectiveTo: timestamp("effective_to"), // Null means no end date

  // Is this the primary role for this user?
  isPrimaryRole: boolean("is_primary_role").default(true),

  // Notes
  notes: text("notes"),

  // Status
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
}, (table) => {
  return {
    userRoleUnique: uniqueIndex("user_role_unique").on(table.userId, table.roleId)
  };
});

// Estate agency role relations
export const estateAgencyRolesRelations = relations(estateAgencyRoles, ({ many }) => ({
  permissions: many(rolePermissions, { relationName: "role_permissions" }),
  assignments: many(staffRoleAssignments, { relationName: "role_assignments" })
}));

// Role permissions relations
export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(estateAgencyRoles, {
    fields: [rolePermissions.roleId],
    references: [estateAgencyRoles.id],
    relationName: "role_permissions"
  })
}));

// Staff role assignments relations
export const staffRoleAssignmentsRelations = relations(staffRoleAssignments, ({ one }) => ({
  user: one(users, {
    fields: [staffRoleAssignments.userId],
    references: [users.id],
    relationName: "user_role_assignments"
  }),
  role: one(estateAgencyRoles, {
    fields: [staffRoleAssignments.roleId],
    references: [estateAgencyRoles.id],
    relationName: "role_assignments"
  }),
  assignedByUser: one(users, {
    fields: [staffRoleAssignments.assignedBy],
    references: [users.id],
    relationName: "assigned_by_user"
  })
}));

// Default role definitions with their typical permissions
export const ESTATE_AGENCY_ROLE_DEFINITIONS = {
  branch_manager: {
    roleName: 'Branch Manager',
    description: 'Head of the office responsible for profitability, team motivation, and winning new business',
    department: 'management',
    reportsTo: 'area_manager',
    requiredQualifications: ['NAEA', 'ARLA'],
    compensationType: 'salary_plus_commission',
    defaultPermissions: [
      // Full access to everything in the branch
      { category: 'sales', permission: 'full_access', accessLevel: 'full' },
      { category: 'lettings', permission: 'full_access', accessLevel: 'full' },
      { category: 'property_management', permission: 'full_access', accessLevel: 'full' },
      { category: 'staff', permission: 'manage_staff', accessLevel: 'full' },
      { category: 'finance', permission: 'view_financials', accessLevel: 'read' },
      { category: 'reports', permission: 'full_access', accessLevel: 'full' },
      { category: 'compliance', permission: 'full_access', accessLevel: 'full' },
      { category: 'marketing', permission: 'full_access', accessLevel: 'full' }
    ]
  },
  sales_negotiator: {
    roleName: 'Sales Negotiator',
    description: 'Matches buyers with properties, conducts viewings, and negotiates offers',
    department: 'sales',
    reportsTo: 'branch_manager',
    requiredQualifications: [],
    compensationType: 'salary_plus_commission',
    defaultPermissions: [
      { category: 'sales', permission: 'view_listings', accessLevel: 'read' },
      { category: 'sales', permission: 'manage_applicants', accessLevel: 'write' },
      { category: 'sales', permission: 'book_viewings', accessLevel: 'write' },
      { category: 'sales', permission: 'negotiate_offers', accessLevel: 'write' },
      { category: 'sales', permission: 'progress_sales', accessLevel: 'write' }
    ]
  },
  senior_sales_negotiator: {
    roleName: 'Senior Sales Negotiator',
    description: 'Experienced sales negotiator with additional responsibilities',
    department: 'sales',
    reportsTo: 'branch_manager',
    requiredQualifications: ['NAEA'],
    compensationType: 'salary_plus_commission',
    defaultPermissions: [
      { category: 'sales', permission: 'view_listings', accessLevel: 'read' },
      { category: 'sales', permission: 'create_listings', accessLevel: 'write' },
      { category: 'sales', permission: 'manage_applicants', accessLevel: 'write' },
      { category: 'sales', permission: 'book_viewings', accessLevel: 'write' },
      { category: 'sales', permission: 'negotiate_offers', accessLevel: 'write' },
      { category: 'sales', permission: 'progress_sales', accessLevel: 'write' },
      { category: 'sales', permission: 'valuations', accessLevel: 'write' }
    ]
  },
  lettings_negotiator: {
    roleName: 'Lettings Negotiator',
    description: 'Finds tenants for landlords and manages the move-in process',
    department: 'lettings',
    reportsTo: 'branch_manager',
    requiredQualifications: ['ARLA'],
    compensationType: 'salary_plus_commission',
    defaultPermissions: [
      { category: 'lettings', permission: 'view_listings', accessLevel: 'read' },
      { category: 'lettings', permission: 'manage_applicants', accessLevel: 'write' },
      { category: 'lettings', permission: 'book_viewings', accessLevel: 'write' },
      { category: 'lettings', permission: 'process_applications', accessLevel: 'write' },
      { category: 'lettings', permission: 'manage_tenancy_agreements', accessLevel: 'write' }
    ]
  },
  property_manager: {
    roleName: 'Property Manager',
    description: 'Manages properties after tenant move-in, handles repairs and compliance',
    department: 'property_management',
    reportsTo: 'branch_manager',
    requiredQualifications: ['ARLA'],
    compensationType: 'salary',
    defaultPermissions: [
      { category: 'property_management', permission: 'view_properties', accessLevel: 'read' },
      { category: 'property_management', permission: 'manage_maintenance', accessLevel: 'full' },
      { category: 'property_management', permission: 'assign_contractors', accessLevel: 'write' },
      { category: 'property_management', permission: 'approve_quotes', accessLevel: 'write' },
      { category: 'property_management', permission: 'schedule_inspections', accessLevel: 'write' },
      { category: 'property_management', permission: 'manage_deposits', accessLevel: 'write' },
      { category: 'compliance', permission: 'manage_certificates', accessLevel: 'write' },
      { category: 'maintenance', permission: 'full_access', accessLevel: 'full' }
    ]
  },
  branch_administrator: {
    roleName: 'Branch Administrator',
    description: 'Handles front desk, marketing materials, and compliance paperwork',
    department: 'admin',
    reportsTo: 'branch_manager',
    requiredQualifications: [],
    compensationType: 'salary',
    defaultPermissions: [
      { category: 'admin', permission: 'manage_front_desk', accessLevel: 'full' },
      { category: 'marketing', permission: 'manage_brochures', accessLevel: 'write' },
      { category: 'marketing', permission: 'manage_portal_listings', accessLevel: 'write' },
      { category: 'compliance', permission: 'aml_checks', accessLevel: 'write' },
      { category: 'sales', permission: 'view_listings', accessLevel: 'read' },
      { category: 'lettings', permission: 'view_listings', accessLevel: 'read' },
      { category: 'admin', permission: 'manage_keys', accessLevel: 'full' }
    ]
  },
  mortgage_advisor: {
    roleName: 'Mortgage & Protection Advisor',
    description: 'Helps buyers finance purchases - CeMAP qualified regulated role',
    department: 'financial_services',
    reportsTo: 'branch_manager',
    requiredQualifications: ['CeMAP'],
    compensationType: 'salary_plus_commission',
    defaultPermissions: [
      { category: 'finance', permission: 'mortgage_applications', accessLevel: 'full' },
      { category: 'finance', permission: 'protection_sales', accessLevel: 'full' },
      { category: 'sales', permission: 'view_applicants', accessLevel: 'read' },
      { category: 'sales', permission: 'view_sales_pipeline', accessLevel: 'read' }
    ]
  },
  system_admin: {
    roleName: 'System Administrator',
    description: 'Full system access for IT and configuration management',
    department: 'admin',
    reportsTo: null,
    requiredQualifications: [],
    compensationType: 'salary',
    defaultPermissions: [
      { category: 'system', permission: 'full_access', accessLevel: 'full' },
      { category: 'staff', permission: 'full_access', accessLevel: 'full' },
      { category: 'reports', permission: 'full_access', accessLevel: 'full' }
    ]
  }
} as const;

// Permission categories and their available permissions
export const PERMISSION_CATEGORIES = {
  sales: [
    'view_listings', 'create_listings', 'edit_listings', 'delete_listings',
    'manage_applicants', 'book_viewings', 'negotiate_offers', 'progress_sales',
    'valuations', 'view_sales_pipeline', 'full_access'
  ],
  lettings: [
    'view_listings', 'create_listings', 'edit_listings', 'delete_listings',
    'manage_applicants', 'book_viewings', 'process_applications',
    'manage_tenancy_agreements', 'full_access'
  ],
  property_management: [
    'view_properties', 'manage_maintenance', 'assign_contractors', 'approve_quotes',
    'schedule_inspections', 'manage_deposits', 'manage_landlords', 'full_access'
  ],
  maintenance: [
    'view_tickets', 'create_tickets', 'assign_contractors', 'approve_quotes',
    'manage_work_orders', 'full_access'
  ],
  staff: [
    'view_staff', 'manage_staff', 'manage_attendance', 'manage_leave',
    'manage_performance', 'full_access'
  ],
  finance: [
    'view_financials', 'manage_invoices', 'manage_payments',
    'mortgage_applications', 'protection_sales', 'full_access'
  ],
  reports: [
    'view_sales_reports', 'view_lettings_reports', 'view_maintenance_reports',
    'view_staff_reports', 'view_financial_reports', 'full_access'
  ],
  marketing: [
    'manage_brochures', 'manage_portal_listings', 'manage_social_media',
    'manage_campaigns', 'full_access'
  ],
  compliance: [
    'aml_checks', 'manage_certificates', 'manage_tpo', 'full_access'
  ],
  admin: [
    'manage_front_desk', 'manage_keys', 'manage_documents', 'full_access'
  ],
  system: [
    'manage_users', 'manage_roles', 'manage_integrations', 'view_audit_logs', 'full_access'
  ]
} as const;


// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});

export const insertLondonAreaSchema = createInsertSchema(londonAreas).omit({
  id: true,
  createdAt: true
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertPropertyInquirySchema = createInsertSchema(propertyInquiries).omit({
  id: true,
  createdAt: true
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true
});

export const insertValuationSchema = createInsertSchema(valuations).omit({
  id: true,
  createdAt: true
});

export const insertPropertyPortalListingSchema = createInsertSchema(propertyPortalListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertMaintenanceTicketSchema = createInsertSchema(maintenanceTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertMaintenanceTicketUpdateSchema = createInsertSchema(maintenanceTicketUpdates).omit({
  id: true,
  createdAt: true
});

export const insertMaintenanceCategorySchema = createInsertSchema(maintenanceCategories).omit({
  id: true,
  createdAt: true
});

export const insertPortalCredentialsSchema = createInsertSchema(portalCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertContractorQuoteSchema = createInsertSchema(contractorQuotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertTicketWorkflowEventSchema = createInsertSchema(ticketWorkflowEvents).omit({
  id: true,
  createdAt: true
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertTicketCommentSchema = createInsertSchema(ticketComments).omit({
  id: true,
  createdAt: true
});

export const insertEstateAgencyRoleSchema = createInsertSchema(estateAgencyRoles).omit({
  id: true,
  createdAt: true
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true
});

export const insertStaffRoleAssignmentSchema = createInsertSchema(staffRoleAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// V3 Insert Schemas
export const insertUnifiedContactSchema = createInsertSchema(unifiedContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertCompanyDetailsSchema = createInsertSchema(companyDetails).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertBeneficialOwnerSchema = createInsertSchema(beneficialOwners).omit({
  id: true,
  createdAt: true
});

export const insertKycDocumentSchema = createInsertSchema(kycDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertContactStatusHistorySchema = createInsertSchema(contactStatusHistory).omit({
  id: true,
  createdAt: true
});

export const insertManagedPropertySchema = createInsertSchema(managedProperties).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertManagedPropertyComplianceSchema = createInsertSchema(managedPropertyCompliance).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertJointTenantSchema = createInsertSchema(jointTenants).omit({
  id: true,
  createdAt: true
});

export const insertSalesProgressionSchema = createInsertSchema(salesProgression).omit({
  id: true,
  updatedAt: true
});

// Property Ownership Form Schema (for valuation flow)
export const propertyOwnershipFormSchema = z.object({
  legalStatus: z.enum(['sole_owner', 'joint_owner', 'company_owned', 'trust']).optional(),
  ownershipLength: z.enum(['less_than_1_year', '1_to_5_years', '5_to_10_years', 'more_than_10_years']).optional(),
  mortgageDetails: z.enum(['no_mortgage', 'mortgage_outstanding', 'equity_release']).optional(),
  legalIssues: z.string().optional(),
  reasonForSelling: z.enum(['relocating', 'downsizing', 'upsizing', 'investment', 'other']).optional()
});

export type PropertyOwnershipFormData = z.infer<typeof propertyOwnershipFormSchema>;

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Valuation = typeof valuations.$inferSelect;
export type InsertValuation = z.infer<typeof insertValuationSchema>;

export type LondonArea = typeof londonAreas.$inferSelect;
export type InsertLondonArea = z.infer<typeof insertLondonAreaSchema>;

export type PropertyInquiry = typeof propertyInquiries.$inferSelect;
export type InsertPropertyInquiry = z.infer<typeof insertPropertyInquirySchema>;

export type PropertyPortalListing = typeof propertyPortalListings.$inferSelect;
export type InsertPropertyPortalListing = z.infer<typeof insertPropertyPortalListingSchema>;

export type MaintenanceTicket = typeof maintenanceTickets.$inferSelect;
export type InsertMaintenanceTicket = z.infer<typeof insertMaintenanceTicketSchema>;

export type MaintenanceTicketUpdate = typeof maintenanceTicketUpdates.$inferSelect;
export type InsertMaintenanceTicketUpdate = z.infer<typeof insertMaintenanceTicketUpdateSchema>;

export type MaintenanceCategory = typeof maintenanceCategories.$inferSelect;
export type InsertMaintenanceCategory = z.infer<typeof insertMaintenanceCategorySchema>;

export type PortalCredentials = typeof portalCredentials.$inferSelect;
export type InsertPortalCredentials = z.infer<typeof insertPortalCredentialsSchema>;

export type ContractorQuote = typeof contractorQuotes.$inferSelect;
export type InsertContractorQuote = z.infer<typeof insertContractorQuoteSchema>;

export type TicketWorkflowEvent = typeof ticketWorkflowEvents.$inferSelect;
export type InsertTicketWorkflowEvent = z.infer<typeof insertTicketWorkflowEventSchema>;

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

export type TicketComment = typeof ticketComments.$inferSelect;
export type InsertTicketComment = z.infer<typeof insertTicketCommentSchema>;

export type Contractor = typeof contractors.$inferSelect;

export type EstateAgencyRole = typeof estateAgencyRoles.$inferSelect;
export type InsertEstateAgencyRole = z.infer<typeof insertEstateAgencyRoleSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type StaffRoleAssignment = typeof staffRoleAssignments.$inferSelect;
export type InsertStaffRoleAssignment = z.infer<typeof insertStaffRoleAssignmentSchema>;

// Authentication schemas (simplified for admin-only access)
export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Please enter a valid email address"),
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().optional()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;

// Legacy support for existing forms (to be updated later)
export type PropertyValuationFormData = ContactFormData;

// Estate agent form schemas

// Property search/filter schema
export const propertySearchSchema = z.object({
  listingType: z.enum(["sale", "rental", "all"]).optional(),
  areaId: z.number().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  bedrooms: z.number().optional(),
  propertyType: z.enum(["flat", "house", "maisonette", "penthouse", "studio", "all"]).optional(),
  features: z.array(z.string()).optional()
});

export type PropertySearchData = z.infer<typeof propertySearchSchema>;

// Property inquiry form schema
export const propertyInquiryFormSchema = z.object({
  propertyId: z.number(),
  inquiryType: z.enum(["viewing_request", "information_request", "offer"]),
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  message: z.string().optional(),
  preferredViewingTimes: z.string().optional(),
  financialPosition: z.enum(["cash_buyer", "mortgage_required", "first_time_buyer", "chain_free", "other"]).optional()
});

export type PropertyInquiryFormData = z.infer<typeof propertyInquiryFormSchema>;

// Contact form schema (for general inquiries, valuations)
export const contactFormSchema = z.object({
  inquiryType: z.enum(["valuation", "selling", "letting", "general"]),
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  propertyAddress: z.string().optional(),
  postcode: z.string().optional(),
  propertyType: z.enum(["flat", "house", "maisonette", "penthouse", "studio", "other"]).optional(),
  bedrooms: z.number().optional(),
  message: z.string().min(10, "Please provide some details"),
  timeframe: z.enum(["asap", "1-3_months", "3-6_months", "just_curious"]).optional()
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

// Property valuation request schema
export const valuationRequestSchema = z.object({
  propertyAddress: z.string().min(1, "Property address is required"),
  postcode: z.string().min(5, "Please enter a valid postcode"),
  propertyType: z.enum(["flat", "house", "maisonette", "penthouse", "studio", "other"]),
  bedrooms: z.number().min(1).max(10),
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  timeframe: z.enum(["asap", "1-3_months", "3-6_months", "just_curious"])
});

export type ValuationRequestData = z.infer<typeof valuationRequestSchema>;

// CRM form schemas

// Maintenance ticket submission form
export const maintenanceTicketFormSchema = z.object({
  propertyId: z.number(),
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Please provide a detailed description"),
  category: z.enum(["plumbing", "electrical", "heating", "appliance", "structural", "other"]),
  urgency: z.enum(["emergency", "urgent", "routine", "low"]),
  images: z.array(z.string()).optional(),
  preferredContactTime: z.string().optional()
});

export type MaintenanceTicketFormData = z.infer<typeof maintenanceTicketFormSchema>;

// Portal credentials form
export const portalCredentialsFormSchema = z.object({
  portalName: z.enum(["zoopla", "propertyfinder", "rightmove"]),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  apiBaseUrl: z.string().url("Please enter a valid URL").optional(),
  testMode: z.boolean().default(false)
});

export type PortalCredentialsFormData = z.infer<typeof portalCredentialsFormSchema>;

// Property portal listing form  
export const propertyPortalListingFormSchema = z.object({
  propertyId: z.number(),
  portalName: z.enum(["zoopla", "propertyfinder", "rightmove"]),
  publishImmediately: z.boolean().default(true),
  expiresAt: z.string().optional() // Will be converted to date
});

export type PropertyPortalListingFormData = z.infer<typeof propertyPortalListingFormSchema>;

// User role update form
export const userRoleUpdateSchema = z.object({
  userId: z.number(),
  role: z.enum(["admin", "agent", "tenant", "landlord", "user", "maintenance_staff"]),
  companyName: z.string().optional(),
  department: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  assignedProperties: z.array(z.number()).optional()
});

export type UserRoleUpdateData = z.infer<typeof userRoleUpdateSchema>;

// London area enums for validation
export const LONDON_AREAS = [
  { name: "Bayswater", postcode: "W2" },
  { name: "Harlesden", postcode: "NW10" },
  { name: "Kensal Green", postcode: "NW10" },
  { name: "Kensal Rise", postcode: "NW10" },
  { name: "Kilburn", postcode: "NW6" },
  { name: "Ladbroke Grove", postcode: "W10" },
  { name: "Maida Vale", postcode: "W9" },
  { name: "Maida Hill", postcode: "W9" },
  { name: "North Kensington", postcode: "W10" },
  { name: "Queens Park", postcode: "NW6" },
  { name: "St Johns Wood", postcode: "NW8" },
  { name: "Westbourne Park", postcode: "W10" },
  { name: "Westbourne Park", postcode: "W11" },
  { name: "Willesden", postcode: "NW10" },
  { name: "Willesden", postcode: "NW2" }
] as const;

export const PROPERTY_FEATURES = [
  "garden", "parking", "balcony", "terrace", "patio", "recently_renovated",
  "period_features", "high_ceilings", "wooden_floors", "modern_kitchen",
  "ensuite_bathroom", "walk_in_wardrobe", "gym", "concierge", "lift",
  "air_conditioning", "underfloor_heating", "fireplace", "roof_terrace",
  "canal_views", "park_views", "city_views"
] as const;

// ==========================================
// COMMUNICATION HUB TABLES
// ==========================================

// Unified conversations (threads across all channels)
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),

  // Participant info
  contactId: integer("contact_id"), // Link to customer enquiries or users
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),

  // Context
  propertyId: integer("property_id"), // If related to a property
  enquiryId: integer("enquiry_id"), // If from customer enquiry

  // Assignment
  assignedToId: integer("assigned_to_id"), // Agent handling this conversation

  // Status
  status: text("status").notNull().default("open"), // 'open', 'pending', 'resolved', 'closed'
  priority: text("priority").default("normal"), // 'low', 'normal', 'high', 'urgent'

  // Metadata
  lastMessageAt: timestamp("last_message_at"),
  lastMessagePreview: text("last_message_preview"),
  unreadCount: integer("unread_count").default(0),

  // Tags for organization
  tags: text("tags").array(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Individual messages within conversations
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),

  // Message content
  channel: text("channel").notNull(), // 'email', 'sms', 'whatsapp', 'phone', 'portal'
  direction: text("direction").notNull(), // 'inbound', 'outbound'

  // Sender/Receiver
  fromAddress: text("from_address"), // Email/phone of sender
  toAddress: text("to_address"), // Email/phone of recipient

  // Content
  subject: text("subject"), // For emails
  content: text("content").notNull(),
  contentHtml: text("content_html"), // HTML version for emails

  // Attachments
  attachments: json("attachments"), // [{ name, url, type, size }]

  // Status tracking
  status: text("status").notNull().default("sent"), // 'draft', 'queued', 'sent', 'delivered', 'read', 'failed'
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),

  // External references
  externalMessageId: text("external_message_id"), // ID from email/SMS provider

  // Tracking
  openedCount: integer("opened_count").default(0),
  clickedCount: integer("clicked_count").default(0),

  // Metadata
  metadata: json("metadata"), // Additional data like portal name, template used, etc

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Bulk messaging campaigns
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),

  // Campaign details
  name: text("name").notNull(),
  description: text("description"),
  campaignType: text("campaign_type").notNull(), // 'email', 'sms', 'whatsapp', 'multi_channel'

  // Content
  subject: text("subject"), // For emails
  content: text("content").notNull(),
  contentHtml: text("content_html"),
  templateId: integer("template_id"), // Link to communication template

  // Targeting
  targetAudience: text("target_audience"), // 'all_tenants', 'landlords', 'buyers', 'custom'
  recipientFilter: json("recipient_filter"), // Filter criteria for recipients
  recipientCount: integer("recipient_count").default(0),

  // Schedule
  status: text("status").notNull().default("draft"), // 'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'
  scheduledFor: timestamp("scheduled_for"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),

  // Metrics
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  openedCount: integer("opened_count").default(0),
  clickedCount: integer("clicked_count").default(0),
  failedCount: integer("failed_count").default(0),
  unsubscribedCount: integer("unsubscribed_count").default(0),

  // Creator
  createdBy: integer("created_by").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Campaign recipients tracking
export const campaignRecipients = pgTable("campaign_recipients", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),

  // Recipient info
  recipientType: text("recipient_type"), // 'user', 'contact', 'custom'
  recipientId: integer("recipient_id"), // User or contact ID
  email: text("email"),
  phone: text("phone"),
  name: text("name"),

  // Status
  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'unsubscribed'
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),

  // Tracking
  messageId: text("message_id"), // External message ID

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// ==========================================
// PAYMENT & FINANCIAL TABLES
// ==========================================

// Payments tracking (rent, deposits, fees)
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),

  // Payment context
  paymentType: text("payment_type").notNull(), // 'rent', 'deposit', 'fee', 'commission', 'maintenance', 'other'
  propertyId: integer("property_id"),
  tenantId: integer("tenant_id"),
  landlordId: integer("landlord_id"),

  // Amount
  amount: integer("amount").notNull(), // In pence
  currency: text("currency").default("GBP"),

  // Payer/Payee
  payerName: text("payer_name"),
  payerEmail: text("payer_email"),
  payeeName: text("payee_name"),

  // Payment details
  description: text("description"),
  reference: text("reference"), // Payment reference
  invoiceNumber: text("invoice_number"),

  // Due date
  dueDate: timestamp("due_date"),

  // Status
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'

  // Payment processing
  paymentMethod: text("payment_method"), // 'bank_transfer', 'card', 'direct_debit', 'cash', 'cheque'
  stripePaymentId: text("stripe_payment_id"),
  stripeCustomerId: text("stripe_customer_id"),

  // Dates
  paidAt: timestamp("paid_at"),
  failedAt: timestamp("failed_at"),
  refundedAt: timestamp("refunded_at"),

  // Receipts
  receiptUrl: text("receipt_url"),
  invoiceUrl: text("invoice_url"),

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Recurring payment schedules
export const paymentSchedules = pgTable("payment_schedules", {
  id: serial("id").primaryKey(),

  // Context
  propertyId: integer("property_id").notNull(),
  tenantId: integer("tenant_id").notNull(),

  // Schedule details
  paymentType: text("payment_type").notNull(), // 'rent', 'service_charge'
  amount: integer("amount").notNull(), // In pence
  frequency: text("frequency").notNull(), // 'weekly', 'monthly', 'quarterly', 'annually'

  // Schedule
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  nextDueDate: timestamp("next_due_date"),
  dayOfMonth: integer("day_of_month"), // For monthly payments (1-28)

  // Status
  status: text("status").notNull().default("active"), // 'active', 'paused', 'completed', 'cancelled'

  // Payment method
  paymentMethod: text("payment_method"),
  stripeSubscriptionId: text("stripe_subscription_id"),

  // Tracking
  totalPaid: integer("total_paid").default(0),
  totalPayments: integer("total_payments").default(0),
  missedPayments: integer("missed_payments").default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// ==========================================
// ANALYTICS & REPORTING TABLES
// ==========================================

// Cached analytics data for dashboard performance
export const analyticsCache = pgTable("analytics_cache", {
  id: serial("id").primaryKey(),

  // Cache key
  cacheKey: text("cache_key").notNull().unique(), // e.g., 'dashboard_kpis', 'agent_performance_123'
  cacheType: text("cache_type").notNull(), // 'kpi', 'chart', 'report', 'summary'

  // Data
  data: json("data").notNull(),

  // Time range
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),

  // Cache control
  expiresAt: timestamp("expires_at").notNull(),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Saved/scheduled reports
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),

  // Report details
  name: text("name").notNull(),
  description: text("description"),
  reportType: text("report_type").notNull(), // 'property_performance', 'agent_performance', 'financial', 'maintenance', 'custom'

  // Configuration
  config: json("config").notNull(), // Report configuration (metrics, filters, grouping)

  // Schedule (for automated reports)
  isScheduled: boolean("is_scheduled").default(false),
  frequency: text("frequency"), // 'daily', 'weekly', 'monthly'
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),

  // Recipients
  recipients: text("recipients").array(), // Email addresses

  // Generated files
  lastGeneratedUrl: text("last_generated_url"),
  format: text("format").default("pdf"), // 'pdf', 'excel', 'csv'

  // Owner
  createdBy: integer("created_by").notNull(),

  // Status
  status: text("status").notNull().default("active"), // 'active', 'paused', 'deleted'

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Document storage metadata
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),

  // Document info
  name: text("name").notNull(),
  originalName: text("original_name").notNull(),
  documentType: text("document_type").notNull(), // 'contract', 'certificate', 'invoice', 'id', 'photo', 'report', 'other'
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // In bytes

  // Storage
  storageUrl: text("storage_url").notNull(),
  storageProvider: text("storage_provider").default("local"), // 'local', 's3', 'cloudinary'

  // Context
  entityType: text("entity_type"), // 'property', 'user', 'ticket', 'payment', etc
  entityId: integer("entity_id"),

  // Security
  isPublic: boolean("is_public").default(false),
  accessToken: text("access_token"), // For secure access

  // Metadata
  metadata: json("metadata"), // Additional info like dimensions for images

  // Uploaded by
  uploadedBy: integer("uploaded_by"),

  // Version control
  version: integer("version").default(1),
  previousVersionId: integer("previous_version_id"),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// ==========================================
// CALENDAR & SCHEDULING TABLES
// ==========================================

// Calendar events (viewings, valuations, meetings)
export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),

  // Event details
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull(), // 'viewing', 'valuation', 'meeting', 'inspection', 'maintenance', 'other'

  // Timing
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  allDay: boolean("all_day").default(false),
  timezone: text("timezone").default("Europe/London"),

  // Location
  location: text("location"),
  propertyId: integer("property_id"),
  isVirtual: boolean("is_virtual").default(false),
  virtualMeetingUrl: text("virtual_meeting_url"),

  // Participants
  organizerId: integer("organizer_id").notNull(),
  attendees: json("attendees"), // [{ userId, name, email, status: 'accepted'/'pending'/'declined' }]

  // Recurrence
  isRecurring: boolean("is_recurring").default(false),
  recurrenceRule: text("recurrence_rule"), // iCal RRULE format
  recurrenceEndDate: timestamp("recurrence_end_date"),
  parentEventId: integer("parent_event_id"), // For recurring instances

  // Status
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'confirmed', 'cancelled', 'completed'

  // Reminders
  remindersSent: json("reminders_sent"), // [{ type: 'email', sentAt: '...' }]

  // External calendar sync
  googleEventId: text("google_event_id"),
  outlookEventId: text("outlook_event_id"),
  lastSyncedAt: timestamp("last_synced_at"),

  // Notes
  notes: text("notes"),
  outcome: text("outcome"), // Post-event notes

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// User calendar settings and sync
export const calendarSettings = pgTable("calendar_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),

  // Working hours
  workingDays: text("working_days").array(), // ['monday', 'tuesday', ...]
  workingHoursStart: text("working_hours_start").default("09:00"),
  workingHoursEnd: text("working_hours_end").default("17:00"),

  // Google Calendar
  googleCalendarEnabled: boolean("google_calendar_enabled").default(false),
  googleCalendarId: text("google_calendar_id"),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiry: timestamp("google_token_expiry"),

  // Outlook Calendar
  outlookCalendarEnabled: boolean("outlook_calendar_enabled").default(false),
  outlookCalendarId: text("outlook_calendar_id"),
  outlookAccessToken: text("outlook_access_token"),
  outlookRefreshToken: text("outlook_refresh_token"),
  outlookTokenExpiry: timestamp("outlook_token_expiry"),

  // Notification preferences
  emailReminders: boolean("email_reminders").default(true),
  smsReminders: boolean("sms_reminders").default(false),
  reminderMinutes: integer("reminder_minutes").default(30),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// ==========================================
// PROACTIVE LEAD GENERATION TABLES
// ==========================================

// Proactive leads from various monitoring sources
export const proactiveLeads = pgTable("proactive_leads", {
  id: serial("id").primaryKey(),

  // Lead source identification
  leadSource: text("lead_source").notNull(),
  // 'land_registry', 'planning_permission', 'expired_listing', 'price_reduction',
  // 'rental_arbitrage', 'social_media', 'compliance_reminder', 'portfolio_landlord',
  // 'auction', 'empty_property', 'competitor_listing', 'seasonal_campaign', 'propensity_score'

  sourceId: text("source_id"), // External ID from source system
  sourceUrl: text("source_url"), // Link to source

  // Property/Owner information
  propertyAddress: text("property_address").notNull(),
  postcode: text("postcode").notNull(),
  propertyType: text("property_type"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  estimatedValue: integer("estimated_value"),

  // Owner/Contact details
  ownerName: text("owner_name"),
  ownerEmail: text("owner_email"),
  ownerPhone: text("owner_phone"),
  ownerAddress: text("owner_address"),
  companyName: text("company_name"),

  // Lead scoring
  leadScore: integer("lead_score").default(50), // 0-100
  leadTemperature: text("lead_temperature").default("warm"), // 'hot', 'warm', 'cold'
  propensityScore: decimal("propensity_score"), // AI-calculated likelihood to sell/let

  // Source-specific data
  metadata: json("metadata"), // Flexible storage for source-specific info

  // For Land Registry leads
  transactionDate: timestamp("transaction_date"),
  transactionPrice: integer("transaction_price"),
  ownershipDuration: integer("ownership_duration"), // Days since purchase

  // For listing-based leads
  originalListingDate: timestamp("original_listing_date"),
  daysOnMarket: integer("days_on_market"),
  originalPrice: integer("original_price"),
  currentPrice: integer("current_price"),
  priceReductions: integer("price_reductions").default(0),
  originalAgent: text("original_agent"),

  // For compliance leads
  complianceType: text("compliance_type"), // 'epc', 'gas_safety', 'eicr', etc.
  complianceExpiryDate: timestamp("compliance_expiry_date"),

  // For auction leads
  auctionHouse: text("auction_house"),
  auctionDate: timestamp("auction_date"),
  guidePrice: integer("guide_price"),
  auctionResult: text("auction_result"), // 'sold', 'unsold', 'withdrawn'

  // Outreach tracking
  status: text("status").notNull().default("new"),
  // 'new', 'researching', 'ready_to_contact', 'contacted', 'responded',
  // 'meeting_scheduled', 'valuation_booked', 'instructed', 'declined', 'not_interested', 'invalid'

  contactAttempts: integer("contact_attempts").default(0),
  lastContactDate: timestamp("last_contact_date"),
  lastContactMethod: text("last_contact_method"), // 'email', 'phone', 'post', 'sms', 'whatsapp'
  nextFollowUpDate: timestamp("next_follow_up_date"),

  // Response tracking
  responseReceived: boolean("response_received").default(false),
  responseDate: timestamp("response_date"),
  responseSummary: text("response_summary"),

  // Assignment
  assignedToId: integer("assigned_to_id"),
  assignedDate: timestamp("assigned_date"),

  // Campaign tracking
  campaignId: integer("campaign_id"),
  campaignName: text("campaign_name"),

  // Conversion tracking
  convertedToEnquiryId: integer("converted_to_enquiry_id"),
  convertedToPropertyId: integer("converted_to_property_id"),
  conversionDate: timestamp("conversion_date"),

  // Notes
  notes: text("notes"),
  internalNotes: text("internal_notes"),

  // AI analysis
  aiAnalysis: json("ai_analysis"), // AI-generated insights about the lead
  aiRecommendation: text("ai_recommendation"),

  // Timestamps
  discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Lead monitoring configurations
export const leadMonitoringConfigs = pgTable("lead_monitoring_configs", {
  id: serial("id").primaryKey(),

  // Monitor identification
  monitorType: text("monitor_type").notNull(),
  // 'land_registry', 'planning_permission', 'expired_listings', 'price_reductions',
  // 'rental_arbitrage', 'social_media', 'compliance', 'auctions', 'empty_properties',
  // 'competitor_listings', 'seasonal_campaigns', 'propensity_scoring'

  name: text("name").notNull(),
  description: text("description"),

  // Status
  isEnabled: boolean("is_enabled").notNull().default(true),

  // Schedule
  frequency: text("frequency").notNull().default("daily"), // 'hourly', 'daily', 'weekly', 'monthly'
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),

  // Geographic targeting
  postcodeAreas: text("postcode_areas").array().default(['W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10', 'W2']),

  // Filters
  minPrice: integer("min_price"),
  maxPrice: integer("max_price"),
  propertyTypes: text("property_types").array(),

  // Source-specific config
  config: json("config").notNull(), // Monitor-specific settings

  // Automation settings
  autoContact: boolean("auto_contact").default(false),
  autoContactMethod: text("auto_contact_method"), // 'email', 'post', 'sms'
  autoContactDelay: integer("auto_contact_delay").default(24), // Hours before auto-contact
  autoContactTemplateId: integer("auto_contact_template_id"),

  // Lead assignment
  defaultAssigneeId: integer("default_assignee_id"),

  // Metrics
  totalLeadsFound: integer("total_leads_found").default(0),
  totalLeadsContacted: integer("total_leads_contacted").default(0),
  totalLeadsConverted: integer("total_leads_converted").default(0),

  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Lead contact history
export const leadContactHistory = pgTable("lead_contact_history", {
  id: serial("id").primaryKey(),

  leadId: integer("lead_id").notNull(),

  // Contact details
  contactMethod: text("contact_method").notNull(), // 'email', 'phone', 'sms', 'whatsapp', 'post', 'social_media'
  contactDirection: text("contact_direction").notNull(), // 'outbound', 'inbound'

  // Content
  subject: text("subject"),
  content: text("content"),
  templateUsed: text("template_used"),

  // Delivery status
  status: text("status").notNull().default("sent"), // 'draft', 'sent', 'delivered', 'failed', 'bounced'
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failureReason: text("failure_reason"),

  // Response
  responseReceived: boolean("response_received").default(false),
  responseAt: timestamp("response_at"),
  responseSummary: text("response_summary"),
  sentiment: text("sentiment"), // 'positive', 'neutral', 'negative'

  // Who made contact
  contactedById: integer("contacted_by_id"),

  // Outcome
  outcome: text("outcome"), // 'no_answer', 'callback_requested', 'not_interested', 'interested', 'meeting_booked'
  nextAction: text("next_action"),
  nextActionDate: timestamp("next_action_date"),

  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Seasonal campaigns configuration
export const seasonalCampaigns = pgTable("seasonal_campaigns", {
  id: serial("id").primaryKey(),

  // Campaign identification
  name: text("name").notNull(),
  description: text("description"),
  campaignType: text("campaign_type").notNull(), // 'new_year', 'spring', 'summer', 'back_to_school', 'autumn', 'christmas', 'custom'

  // Schedule
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),

  // Targeting
  targetAudience: text("target_audience").notNull(), // 'potential_sellers', 'landlords', 'expired_listings', 'all'
  postcodeAreas: text("postcode_areas").array(),
  propertyTypes: text("property_types").array(),
  minPropertyValue: integer("min_property_value"),
  maxPropertyValue: integer("max_property_value"),

  // Content
  emailTemplateId: integer("email_template_id"),
  smsTemplateId: integer("sms_template_id"),
  postTemplateId: integer("post_template_id"),

  // Messaging
  headline: text("headline"),
  mainMessage: text("main_message"),
  callToAction: text("call_to_action"),
  offerDetails: text("offer_details"), // Special offers, discounts, etc.

  // Multi-channel settings
  channels: text("channels").array().default(['email', 'post']),
  sendSequence: json("send_sequence"), // [{channel: 'email', day: 0}, {channel: 'post', day: 3}]

  // Budget
  budget: integer("budget"),
  costPerLead: integer("cost_per_lead"),

  // Metrics
  totalRecipients: integer("total_recipients").default(0),
  totalSent: integer("total_sent").default(0),
  totalOpened: integer("total_opened").default(0),
  totalResponded: integer("total_responded").default(0),
  totalConverted: integer("total_converted").default(0),

  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Landlord compliance tracking
export const landlordCompliance = pgTable("landlord_compliance", {
  id: serial("id").primaryKey(),

  // Property/Landlord identification
  propertyId: integer("property_id"),
  landlordId: integer("landlord_id"),
  propertyAddress: text("property_address").notNull(),
  postcode: text("postcode").notNull(),

  // Landlord contact
  landlordName: text("landlord_name"),
  landlordEmail: text("landlord_email"),
  landlordPhone: text("landlord_phone"),

  // Compliance certificates
  epcRating: text("epc_rating"),
  epcExpiryDate: timestamp("epc_expiry_date"),
  epcCertificateUrl: text("epc_certificate_url"),

  gasSafetyExpiryDate: timestamp("gas_safety_expiry_date"),
  gasSafetyCertificateUrl: text("gas_safety_certificate_url"),

  eicrExpiryDate: timestamp("eicr_expiry_date"),
  eicrCertificateUrl: text("eicr_certificate_url"),

  fireAlarmTestDate: timestamp("fire_alarm_test_date"),
  legionellaCheckDate: timestamp("legionella_check_date"),

  // License requirements
  hmoLicenseRequired: boolean("hmo_license_required").default(false),
  hmoLicenseExpiryDate: timestamp("hmo_license_expiry_date"),
  selectiveLicenseRequired: boolean("selective_license_required").default(false),
  selectiveLicenseExpiryDate: timestamp("selective_license_expiry_date"),

  // Reminder settings
  reminderDays: integer("reminder_days").default(60), // Days before expiry to remind
  remindersSent: json("reminders_sent"), // [{type: 'epc', sentAt: '...', method: 'email'}]

  // Status
  isCompliant: boolean("is_compliant").default(true),
  complianceIssues: text("compliance_issues").array(),

  // Outreach opportunity
  isProspect: boolean("is_prospect").default(false), // Not our client, but potential lead
  leadId: integer("lead_id"), // Link to proactive_leads if created

  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Propensity scoring model data
export const propensityScores = pgTable("propensity_scores", {
  id: serial("id").primaryKey(),

  // Property identification
  propertyAddress: text("property_address").notNull(),
  postcode: text("postcode").notNull(),
  uprn: text("uprn"), // Unique Property Reference Number

  // Property characteristics
  propertyType: text("property_type"),
  bedrooms: integer("bedrooms"),
  estimatedValue: integer("estimated_value"),
  lastSaleDate: timestamp("last_sale_date"),
  lastSalePrice: integer("last_sale_price"),
  ownershipDuration: integer("ownership_duration"), // Days

  // Owner characteristics (anonymized/aggregated)
  ownerAgeRange: text("owner_age_range"), // '25-35', '35-45', etc.
  ownerType: text("owner_type"), // 'individual', 'company', 'trust'
  isLandlord: boolean("is_landlord").default(false),
  portfolioSize: integer("portfolio_size"), // If landlord, how many properties

  // Market signals
  localMarketTrend: decimal("local_market_trend"), // -1 to 1, negative = declining
  daysOnMarketAvg: integer("days_on_market_avg"), // Average in area
  listingActivity: decimal("listing_activity"), // Activity in area

  // Life event indicators (derived from public data)
  recentPlanningApp: boolean("recent_planning_app").default(false),
  recentExtension: boolean("recent_extension").default(false),
  probateFlag: boolean("probate_flag").default(false),

  // Propensity scores (0-100)
  sellPropensity: decimal("sell_propensity").notNull(), // Likelihood to sell in next 12 months
  letPropensity: decimal("let_propensity"), // Likelihood to let
  moveOutPropensity: decimal("move_out_propensity"), // Likelihood to move

  // Confidence
  scoreConfidence: decimal("score_confidence"), // How confident is the model

  // Model metadata
  modelVersion: text("model_version"),
  scoredAt: timestamp("scored_at").notNull().defaultNow(),

  // Features used
  features: json("features"), // Input features for the model

  // Lead creation
  leadCreated: boolean("lead_created").default(false),
  leadId: integer("lead_id"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Social media mentions for monitoring
export const socialMediaMentions = pgTable("social_media_mentions", {
  id: serial("id").primaryKey(),

  // Platform info
  platform: text("platform").notNull(), // 'facebook', 'twitter', 'nextdoor', 'instagram', 'linkedin'
  postId: text("post_id"), // Platform-specific post ID
  postUrl: text("post_url"),

  // Content
  content: text("content").notNull(),
  authorName: text("author_name"),
  authorHandle: text("author_handle"),
  authorProfileUrl: text("author_profile_url"),

  // Classification
  mentionType: text("mention_type").notNull(),
  // 'selling_interest', 'letting_interest', 'agent_recommendation', 'moving_mention',
  // 'property_complaint', 'market_question', 'valuation_interest', 'other'

  // Location extraction
  extractedPostcode: text("extracted_postcode"),
  extractedArea: text("extracted_area"),

  // Sentiment & relevance
  sentiment: text("sentiment"), // 'positive', 'neutral', 'negative'
  relevanceScore: decimal("relevance_score"), // 0-1

  // Lead qualification
  isQualifiedLead: boolean("is_qualified_lead").default(false),
  leadId: integer("lead_id"),

  // Action taken
  actionTaken: text("action_taken"),
  respondedAt: timestamp("responded_at"),
  respondedById: integer("responded_by_id"),

  // Timestamps
  postedAt: timestamp("posted_at"),
  discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// ==========================================
// RELATIONS FOR NEW TABLES
// ==========================================

// Conversation relations
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  property: one(properties, {
    fields: [conversations.propertyId],
    references: [properties.id],
    relationName: "property_conversations"
  }),
  assignedTo: one(users, {
    fields: [conversations.assignedToId],
    references: [users.id],
    relationName: "assigned_conversations"
  }),
  messages: many(messages, { relationName: "conversation_messages" })
}));

// Messages relations
export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
    relationName: "conversation_messages"
  })
}));

// Campaign relations
export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  creator: one(users, {
    fields: [campaigns.createdBy],
    references: [users.id],
    relationName: "campaign_creator"
  }),
  recipients: many(campaignRecipients, { relationName: "campaign_recipients" }),
  template: one(communicationTemplates, {
    fields: [campaigns.templateId],
    references: [communicationTemplates.id],
    relationName: "campaign_template"
  })
}));

// Campaign recipients relations
export const campaignRecipientsRelations = relations(campaignRecipients, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignRecipients.campaignId],
    references: [campaigns.id],
    relationName: "campaign_recipients"
  })
}));

// Payments relations
export const paymentsRelations = relations(payments, ({ one }) => ({
  property: one(properties, {
    fields: [payments.propertyId],
    references: [properties.id],
    relationName: "property_payments"
  }),
  tenant: one(users, {
    fields: [payments.tenantId],
    references: [users.id],
    relationName: "tenant_payments"
  }),
  landlord: one(users, {
    fields: [payments.landlordId],
    references: [users.id],
    relationName: "landlord_payments"
  })
}));

// Calendar events relations
export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  property: one(properties, {
    fields: [calendarEvents.propertyId],
    references: [properties.id],
    relationName: "property_events"
  }),
  organizer: one(users, {
    fields: [calendarEvents.organizerId],
    references: [users.id],
    relationName: "organized_events"
  })
}));

// ==========================================
// INSERT SCHEMAS FOR NEW TABLES
// ==========================================

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true
});

export const insertLandlordSchema = createInsertSchema(landlords).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertRentalAgreementSchema = createInsertSchema(rentalAgreements).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// ==========================================
// TYPES FOR NEW TABLES
// ==========================================

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export type Landlord = typeof landlords.$inferSelect;
export type InsertLandlord = z.infer<typeof insertLandlordSchema>;

export type RentalAgreement = typeof rentalAgreements.$inferSelect;
export type InsertRentalAgreement = z.infer<typeof insertRentalAgreementSchema>;

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

// Managed Property Documents
export const insertManagedPropertyDocumentSchema = createInsertSchema(managedPropertyDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type ManagedPropertyDocument = typeof managedPropertyDocuments.$inferSelect;
export type InsertManagedPropertyDocument = z.infer<typeof insertManagedPropertyDocumentSchema>;

// Property Inventory
export const insertPropertyInventorySchema = createInsertSchema(propertyInventories).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type PropertyInventory = typeof propertyInventories.$inferSelect;
export type InsertPropertyInventory = z.infer<typeof insertPropertyInventorySchema>;

// Inventory Items
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  createdAt: true
});
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;

// ==========================================
// PROACTIVE LEAD GENERATION SCHEMAS & TYPES
// ==========================================

export const insertProactiveLeadSchema = createInsertSchema(proactiveLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  discoveredAt: true
});

export const insertLeadMonitoringConfigSchema = createInsertSchema(leadMonitoringConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertLeadContactHistorySchema = createInsertSchema(leadContactHistory).omit({
  id: true,
  createdAt: true
});

export const insertSeasonalCampaignSchema = createInsertSchema(seasonalCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertLandlordComplianceSchema = createInsertSchema(landlordCompliance).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertPropensityScoreSchema = createInsertSchema(propensityScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  scoredAt: true
});

export const insertSocialMediaMentionSchema = createInsertSchema(socialMediaMentions).omit({
  id: true,
  createdAt: true,
  discoveredAt: true
});

export type ProactiveLead = typeof proactiveLeads.$inferSelect;
export type InsertProactiveLead = z.infer<typeof insertProactiveLeadSchema>;

export type LeadMonitoringConfig = typeof leadMonitoringConfigs.$inferSelect;
export type InsertLeadMonitoringConfig = z.infer<typeof insertLeadMonitoringConfigSchema>;

export type LeadContactHistory = typeof leadContactHistory.$inferSelect;
export type InsertLeadContactHistory = z.infer<typeof insertLeadContactHistorySchema>;

export type SeasonalCampaign = typeof seasonalCampaigns.$inferSelect;
export type InsertSeasonalCampaign = z.infer<typeof insertSeasonalCampaignSchema>;

export type LandlordComplianceRecord = typeof landlordCompliance.$inferSelect;
export type InsertLandlordCompliance = z.infer<typeof insertLandlordComplianceSchema>;

export type PropensityScore = typeof propensityScores.$inferSelect;
export type InsertPropensityScore = z.infer<typeof insertPropensityScoreSchema>;

export type SocialMediaMention = typeof socialMediaMentions.$inferSelect;
export type InsertSocialMediaMention = z.infer<typeof insertSocialMediaMentionSchema>;

// ==========================================
// PERSONAL & CORPORATE KYC SCHEMAS & TYPES
// ==========================================

export const insertPersonalKycSchema = createInsertSchema(personalKyc).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertCorporateKycSchema = createInsertSchema(corporateKyc).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type PersonalKyc = typeof personalKyc.$inferSelect;
export type InsertPersonalKyc = z.infer<typeof insertPersonalKycSchema>;

export type CorporateKyc = typeof corporateKyc.$inferSelect;
export type InsertCorporateKyc = z.infer<typeof insertCorporateKycSchema>;

// V3 Types
export type UnifiedContact = typeof unifiedContacts.$inferSelect;
export type InsertUnifiedContact = z.infer<typeof insertUnifiedContactSchema>;

export type CompanyDetail = typeof companyDetails.$inferSelect;
export type InsertCompanyDetail = z.infer<typeof insertCompanyDetailsSchema>;

export type BeneficialOwner = typeof beneficialOwners.$inferSelect;
export type InsertBeneficialOwner = z.infer<typeof insertBeneficialOwnerSchema>;

export type KycDocument = typeof kycDocuments.$inferSelect;
export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;

export type ManagedProperty = typeof managedProperties.$inferSelect;
export type InsertManagedProperty = z.infer<typeof insertManagedPropertySchema>;

export type JointTenant = typeof jointTenants.$inferSelect;
export type InsertJointTenant = z.infer<typeof insertJointTenantSchema>;

export type SalesProgression = typeof salesProgression.$inferSelect;
export type InsertSalesProgression = z.infer<typeof insertSalesProgressionSchema>;

// Management fees - fee structures per property
export const managementFees = pgTable("management_fees", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  feePercentage: decimal("fee_percentage").notNull(), // e.g., 10, 13, 14.4
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  effectiveTo: timestamp("effective_to"), // null = current
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Property certificates - compliance and safety certificates for managed properties
export const propertyCertificates = pgTable("property_certificates", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),

  // Certificate type
  certificateType: text("certificate_type").notNull(), // 'gas_safety', 'epc', 'eicr', 'pat', 'fire_safety', 'legionella', 'asbestos', 'other'

  // Certificate details
  certificateNumber: text("certificate_number"),
  issuedBy: text("issued_by"), // Company/person who issued
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"),

  // Rating (for EPC)
  rating: text("rating"), // A, B, C, D, E, F, G

  // Document
  documentUrl: text("document_url"),
  documentFileName: text("document_file_name"),

  // Status
  status: text("status").notNull().default("valid"), // 'valid', 'expired', 'pending', 'failed'

  // Reminder settings
  reminderDays: integer("reminder_days").default(30), // Days before expiry to send reminder
  reminderSent: boolean("reminder_sent").default(false),

  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Tenancy contracts - links landlords, properties, and tenants
export const tenancyContracts = pgTable("tenancy_contracts", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  landlordId: integer("landlord_id").notNull(),
  tenantId: integer("tenant_id"),

  // Tenancy dates
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  periodMonths: integer("period_months"), // 6, 12, 24, 36, or null for periodic
  isPeriodic: boolean("is_periodic").default(false),

  // Rent details
  rentAmount: decimal("rent_amount").notNull(), // Monthly rent amount
  rentFrequency: text("rent_frequency").notNull().default("Calendar Monthly"), // Calendar Monthly, Quarterly, Four Weekly, Annually

  // Deposit details
  depositAmount: decimal("deposit_amount"),
  depositHeldBy: text("deposit_held_by"), // Agency: Custodial, Agency: Insurance, Landlord
  depositProtectionScheme: text("deposit_protection_scheme"), // TDS, DPS

  // Contract status
  status: text("status").notNull().default("active"), // active, expired, terminated

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Property management checklists - compliance tracking per property/contract
export const propertyChecklists = pgTable("property_checklists", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  contractId: integer("contract_id"),

  // Financial items
  depositAndRent: boolean("deposit_and_rent").default(false),
  standingOrder: boolean("standing_order").default(false),

  // Legal documents
  tenancyAgreement: boolean("tenancy_agreement").default(false),
  guarantorsAgreement: boolean("guarantors_agreement").default(false),
  notices: boolean("notices").default(false),
  authorizationToLandlord: boolean("authorization_to_landlord").default(false),
  termsAndConditionsToLandlord: boolean("terms_and_conditions_to_landlord").default(false),
  informationSheetToLandlord: boolean("information_sheet_to_landlord").default(false),

  // Tenant verification
  tenantsId: boolean("tenants_id").default(false),
  previousLandlordRef: boolean("previous_landlord_ref").default(false),
  bankReference: boolean("bank_reference").default(false),
  workReference: boolean("work_reference").default(false),

  // Property items
  inventory: boolean("inventory").default(false),
  gasSafetyCertificate: boolean("gas_safety_certificate").default(false),

  // Deposit protection
  depositProtectionTds: boolean("deposit_protection_tds").default(false),
  depositProtectionDps: boolean("deposit_protection_dps").default(false),
  depositHeldByLandlord: boolean("deposit_held_by_landlord").default(false),

  // Keys
  spareKeysInOffice: boolean("spare_keys_in_office").default(false),
  keysGivenToTenant: boolean("keys_given_to_tenant").default(false),

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// ==========================================
// PROPERTY MANAGEMENT RELATIONS
// ==========================================

export const landlordsRelations = relations(landlords, ({ many }) => ({
  contracts: many(tenancyContracts)
}));

export const tenancyContractsRelations = relations(tenancyContracts, ({ one }) => ({
  landlord: one(landlords, {
    fields: [tenancyContracts.landlordId],
    references: [landlords.id]
  }),
  tenant: one(tenants, {
    fields: [tenancyContracts.tenantId],
    references: [tenants.id]
  }),
  property: one(properties, {
    fields: [tenancyContracts.propertyId],
    references: [properties.id]
  })
}));

export const propertyChecklistsRelations = relations(propertyChecklists, ({ one }) => ({
  property: one(properties, {
    fields: [propertyChecklists.propertyId],
    references: [properties.id]
  }),
  contract: one(tenancyContracts, {
    fields: [propertyChecklists.contractId],
    references: [tenancyContracts.id]
  })
}));

export const propertyInventoriesRelations = relations(propertyInventories, ({ one }) => ({
  property: one(properties, {
    fields: [propertyInventories.propertyId],
    references: [properties.id]
  }),
  rentalAgreement: one(rentalAgreements, {
    fields: [propertyInventories.rentalAgreementId],
    references: [rentalAgreements.id]
  })
}));

// Insert Schemas
export const insertManagementFeeSchema = createInsertSchema(managementFees).omit({
  id: true,
  createdAt: true
});
export type InsertManagementFee = z.infer<typeof insertManagementFeeSchema>;

export const insertPropertyCertificateSchema = createInsertSchema(propertyCertificates).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertPropertyCertificate = z.infer<typeof insertPropertyCertificateSchema>;

export const insertTenancyContractSchema = createInsertSchema(tenancyContracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertTenancyContract = z.infer<typeof insertTenancyContractSchema>;

export const insertPropertyChecklistSchema = createInsertSchema(propertyChecklists).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertPropertyChecklist = z.infer<typeof insertPropertyChecklistSchema>;


// ==========================================
// UK LANDLORD COMPLIANCE TRACKING
// ==========================================

// Master list of all compliance requirements
export const complianceRequirements = pgTable("compliance_requirements", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // 'GAS_SAFETY', 'EICR', 'EPC', etc.
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'critical', 'high', 'recommended'
  appliesToProperty: boolean("applies_to_property").default(true),
  appliesToLandlord: boolean("applies_to_landlord").default(false),
  appliesToTenant: boolean("applies_to_tenant").default(false),
  frequencyMonths: integer("frequency_months"), // null = one-time
  reminderDaysBefore: integer("reminder_days_before").default(30),
  penaltyDescription: text("penalty_description"),
  referenceUrl: text("reference_url"), // Gov.uk link
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Track compliance status per property/landlord/tenant
export const complianceStatus = pgTable("compliance_status", {
  id: serial("id").primaryKey(),
  requirementId: integer("requirement_id").notNull(),
  propertyId: integer("property_id"),
  landlordId: integer("landlord_id"),
  tenantId: integer("tenant_id"),
  contractId: integer("contract_id"), // Link to specific tenancy
  status: text("status").notNull().default("pending"), // 'compliant', 'pending', 'expired', 'not_applicable', 'action_required'
  completedDate: timestamp("completed_date"),
  expiryDate: timestamp("expiry_date"),
  documentUrl: text("document_url"),
  certificateNumber: text("certificate_number"),
  notes: text("notes"),
  verifiedBy: integer("verified_by"), // User who verified
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Compliance requirement relations
export const complianceRequirementsRelations = relations(complianceRequirements, ({ many }) => ({
  statuses: many(complianceStatus)
}));

export const complianceStatusRelations = relations(complianceStatus, ({ one }) => ({
  requirement: one(complianceRequirements, {
    fields: [complianceStatus.requirementId],
    references: [complianceRequirements.id]
  }),
  property: one(properties, {
    fields: [complianceStatus.propertyId],
    references: [properties.id]
  }),
  landlord: one(landlords, {
    fields: [complianceStatus.landlordId],
    references: [landlords.id]
  }),
  tenant: one(tenants, {
    fields: [complianceStatus.tenantId],
    references: [tenants.id]
  })
}));

// Insert schemas for compliance tables
export const insertComplianceRequirementSchema = createInsertSchema(complianceRequirements).omit({
  id: true,
  createdAt: true
});

export const insertComplianceStatusSchema = createInsertSchema(complianceStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type ComplianceRequirement = typeof complianceRequirements.$inferSelect;
export type InsertComplianceRequirement = z.infer<typeof insertComplianceRequirementSchema>;

export type ComplianceStatus = typeof complianceStatus.$inferSelect;
export type InsertComplianceStatus = z.infer<typeof insertComplianceStatusSchema>;

// Tenant Communications Log
export const communications = pgTable("communications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'sms', 'email', 'phone', 'note'
  direction: text("direction").notNull(), // 'inbound', 'outbound'
  content: text("content").notNull(),
  status: text("status").notNull(), // 'sent', 'received', 'failed', 'draft'
  tenantId: integer("tenant_id").references(() => tenants.id),
  landlordId: integer("landlord_id").references(() => landlords.id),
  propertyId: integer("property_id").references(() => properties.id),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: json("metadata"), // for twilio SID etc
});

export const insertCommunicationSchema = createInsertSchema(communications);
export type Communication = typeof communications.$inferSelect;
export type InsertCommunication = typeof communications.$inferInsert;
