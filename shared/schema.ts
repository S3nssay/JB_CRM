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
export const users = pgTable("user", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("user"), // 'admin', 'agent', 'tenant', 'landlord', 'user', 'maintenance_staff'
  securityClearance: integer("security_clearance").notNull().default(3), // 1-10 scale, default is basic user
  accessLevelCode: text("access_level_code"), // References DEFAULT_ACCESS_LEVELS, e.g. 'owner', 'general_manager', 'sales_lettings_negotiator'

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
export const londonAreas = pgTable("london_area", {
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
export const properties = pgTable("property", {
  id: serial("id").primaryKey(),

  // Property status
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

  // Management and Listing fields
  isManaged: boolean("is_managed").default(false), // Is this property under John Barclay management?
  isListed: boolean("is_listed").default(false), // Is this property actively listed for sale/rent on portals?
  isRental: boolean("is_rental").default(false), // Is this a rental property?
  isResidential: boolean("is_residential").default(true), // Is this residential (vs commercial)?
  landlordId: integer("landlord_id"), // FK to landlords table (when property is managed)

  // Additional address fields
  address: text("address"), // Full address string
  city: text("city"),

  // Management details
  managementFeeType: text("management_fee_type"), // 'percentage' or 'fixed'
  managementFeeValue: decimal("management_fee_value"), // The fee value
  managementPeriodMonths: integer("management_period_months"), // 12, 24, 36 months
  managementStartDate: timestamp("management_start_date"),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Property portal listings - tracking property syndication to external portals
export const propertyPortalListings = pgTable("property_portal_listing", {
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
export const maintenanceTickets = pgTable("maintenance_ticket", {
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
export const maintenanceTicketUpdates = pgTable("maintenance_ticket_update", {
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
export const maintenanceCategories = pgTable("maintenance_category", {
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
export const staffProfiles = pgTable("staff_profile", {
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
export const propertyWorkflows = pgTable("property_workflow", {
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
export const viewingAppointments = pgTable("viewing_appointment", {
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
export const propertyOffers = pgTable("property_offer", {
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
export const contractDocuments = pgTable("contract_document", {
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
export const customerEnquiries = pgTable("customer_enquiry", {
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
export const communicationTemplates = pgTable("communication_template", {
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
export const maintenanceRequests = pgTable("maintenance_request", {
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
export const workOrders = pgTable("work_order", {
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
export const landlords = pgTable("landlord", {
  id: serial("id").primaryKey(),

  // Type: company or individual
  landlordType: text("landlord_type").notNull().default("individual"), // 'company' or 'individual'
  isCorporate: boolean("is_corporate").default(false), // true = corporate landlord, false = individual

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

  // Ownership references - link to new ownership tables
  corporateOwnerId: integer("corporate_owner_id"), // FK to corporate_owners (if landlordType = 'company')
  beneficialOwnerId: integer("beneficial_owner_id"), // FK to beneficial_owners (if landlordType = 'individual' - self as beneficial owner)

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

// Corporate Owner - for corporate landlord entities
// A landlord can reference a corporate_owner when landlordType = 'company'
// Corporate landlords: Property → Landlord → Corporate Owner → Beneficial Owners
export const corporateOwner = pgTable("corporate_owner", {
  id: serial("id").primaryKey(),

  // Link to landlord (required - each corporate owner belongs to one corporate landlord)
  landlordId: integer("landlord_id"), // FK to landlords

  // Company details
  companyName: text("company_name").notNull(),
  companyRegistrationNo: text("company_registration_no"),
  companyVatNo: text("company_vat_no"),

  // Registered address
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  postcode: text("postcode"),
  country: text("country").default("UK"),

  // Contact details
  email: text("email"),
  phone: text("phone"),

  // Company documents
  certificateOfIncorporationUrl: text("certificate_of_incorporation_url"),
  memorandumOfAssociationUrl: text("memorandum_of_association_url"),
  articlesOfAssociationUrl: text("articles_of_association_url"),

  // Status
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Beneficial Owners - individuals who ultimately own/control a corporate or are the landlord themselves
// For individual landlords: one beneficial owner record (the landlord themselves) - links via landlordId
// For corporate landlords: one or more beneficial owner records (the people behind the company) - links via corporateOwnerId
// All KYC is held at this level
// Flow: Individual: Property → Landlord → Beneficial Owner (direct via landlordId)
//       Corporate: Property → Landlord → Corporate Owner → Beneficial Owner (via corporateOwnerId)
export const beneficialOwner = pgTable("beneficial_owner", {
  id: serial("id").primaryKey(),

  // Link to landlord (for individual landlords - direct link)
  landlordId: integer("landlord_id"), // FK to landlords (used when landlord.isCorporate = false)

  // Link to corporate owner (for corporate landlords)
  corporateOwnerId: integer("corporate_owner_id"), // FK to corporate_owner (used when landlord.isCorporate = true)

  // Legacy field for unified contacts system (deprecated, keep for backwards compatibility)
  companyDetailsId: integer("company_details_id"), // FK to company_details (legacy)

  // Personal details
  fullName: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),

  // Address (legacy field)
  address: text("address"),

  // Address (structured)
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  postcode: text("postcode"),
  country: text("country").default("UK"),

  // Personal information
  dateOfBirth: timestamp("date_of_birth"),
  nationality: text("nationality"),
  nationalInsuranceNo: text("national_insurance_no"),

  // Ownership details (for corporate beneficial owners)
  ownershipPercentage: decimal("ownership_percentage"), // Percentage of company owned
  isDirector: boolean("is_director").default(false),
  isPsc: boolean("is_psc").default(false), // Person with Significant Control
  isTrustee: boolean("is_trustee").default(false),

  // KYC - Identity Documents
  idDocumentType: text("id_document_type"), // 'passport', 'driving_license', 'national_id'
  idDocumentUrl: text("id_document_url"),
  idDocumentNumber: text("id_document_number"),
  idDocumentExpiry: timestamp("id_document_expiry"),

  // Legacy passport fields
  passportNumber: text("passport_number"),
  passportExpiry: timestamp("passport_expiry"),

  // KYC - Secondary ID
  secondaryIdType: text("secondary_id_type"),
  secondaryIdUrl: text("secondary_id_url"),
  secondaryIdNumber: text("secondary_id_number"),
  secondaryIdExpiry: timestamp("secondary_id_expiry"),

  // KYC - Proof of Address
  proofOfAddressType: text("proof_of_address_type"), // 'utility_bill', 'bank_statement', 'council_tax'
  proofOfAddressUrl: text("proof_of_address_url"),
  proofOfAddressDate: timestamp("proof_of_address_date"),

  // KYC - Verification Status
  kycVerified: boolean("kyc_verified").default(false),
  kycVerifiedAt: timestamp("kyc_verified_at"),
  kycVerifiedBy: integer("kyc_verified_by"), // User ID who verified
  kycVerificationNotes: text("kyc_verification_notes"),
  notes: text("notes"),

  // AML Check
  amlCheckCompleted: boolean("aml_check_completed").default(false),
  amlCheckDate: timestamp("aml_check_date"),
  amlCheckResult: text("aml_check_result"), // 'passed', 'failed', 'review_required'
  amlCheckNotes: text("aml_check_notes"),

  // PEP (Politically Exposed Person) Check
  pepCheckCompleted: boolean("pep_check_completed").default(false),
  pepCheckDate: timestamp("pep_check_date"),
  pepCheckResult: text("pep_check_result"), // 'clear', 'flagged'
  pepCheckNotes: text("pep_check_notes"),

  // Sanctions Check
  sanctionsCheckCompleted: boolean("sanctions_check_completed").default(false),
  sanctionsCheckDate: timestamp("sanctions_check_date"),
  sanctionsCheckResult: text("sanctions_check_result"), // 'clear', 'flagged'
  sanctionsCheckNotes: text("sanctions_check_notes"),

  // Status
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Rental agreements/tenancies linking properties to landlords
export const rentalAgreements = pgTable("rental_agreement", {
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

// Tenant - contains all basic details about a tenant with FK relationships
export const tenant = pgTable("tenant", {
  id: serial("id").primaryKey(),

  // Foreign key relationships
  userId: integer("user_id"), // Reference to users table (optional)
  propertyId: integer("property_id"), // Reference to properties table
  landlordId: integer("landlord_id"), // Reference to landlords table
  tenancyContractId: integer("tenancy_contract_id"), // Reference to tenancy_contracts table
  contractId: integer("contract_id"), // Reference to contracts table
  rentalAgreementId: integer("rental_agreement_id"), // Reference to rental_agreements

  // Personal details
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),

  // Address
  address: text("address"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  postcode: text("postcode"),
  country: text("country"),

  // Employment details
  employer: text("employer"),
  employerAddress: text("employer_address"),
  employerPhone: text("employer_phone"),
  jobTitle: text("job_title"),
  annualIncome: text("annual_income"),

  // Tenant details
  moveInDate: timestamp("move_in_date"),
  moveOutDate: timestamp("move_out_date"),

  // Contact preferences
  preferredContactMethod: text("preferred_contact_method").default("email"), // 'email', 'phone', 'whatsapp', 'sms'
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelationship: text("emergency_contact_relationship"),

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
  idVerificationStatus: text("id_verification_status"),
  idVerificationToken: text("id_verification_token"),
  idVerificationTokenExpiry: timestamp("id_verification_token_expiry"),

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
export const managedPropertyDocuments = pgTable("managed_property_document", {
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
export const propertyInventories = pgTable("property_inventory", {
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
export const inventoryItems = pgTable("inventory_item", {
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
export const contractors = pgTable("contractor", {
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
export const propertyCertifications = pgTable("property_certification", {
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
export const certificationReminders = pgTable("certification_reminder", {
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
export const inspectionReports = pgTable("inspection_report", {
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
export const favoritesLists = pgTable("favorites_list", {
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
export const savedProperties = pgTable("saved_property", {
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
export const supportTickets = pgTable("support_ticket", {
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
export const ticketComments = pgTable("ticket_comment", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  userId: integer("user_id").notNull(),

  comment: text("comment").notNull(),
  isInternal: boolean("is_internal").default(false), // Internal notes not visible to tenant

  attachments: text("attachments").array(),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Contractor Quotes for Support Tickets
export const contractorQuotes = pgTable("contractor_quote", {
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
export const ticketWorkflowEvents = pgTable("ticket_workflow_event", {
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
export const propertyAlerts = pgTable("property_alert", {
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
export const mailingListSubscriptions = pgTable("mailing_list_subscription", {
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
export const userPropertyPreferences = pgTable("user_property_preference", {
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
export const userActivities = pgTable("user_activity", {
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
export const adminUserAuditLogs = pgTable("admin_user_audit_log", {
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
export const socialMediaPosts = pgTable("social_media_post", {
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
export const socialMediaAccounts = pgTable("social_media_account", {
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
export const unifiedContacts = pgTable("unified_contact", {
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
  address: text("address"), // Full address as single field
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  postcode: text("postcode"),
  country: text("country").default("United Kingdom"),

  // Bank details (for landlords)
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankSortCode: text("bank_sort_code"),
  bankAccountName: text("bank_account_name"),

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
export const companyDetails = pgTable("company_detail", {
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

// Unified KYC document tracking
export const kycDocuments = pgTable("kyc_document", {
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
export const managedProperties = pgTable("managed_property", {
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
export const jointTenants = pgTable("joint_tenant", {
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
export const portalCredentials = pgTable("portal_credential", {
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
  beneficialOwners: many(beneficialOwner)
}));

export const beneficialOwnerRelations = relations(beneficialOwner, ({ one, many }) => ({
  // For individual landlords: direct link to landlord
  landlord: one(landlords, {
    fields: [beneficialOwner.landlordId],
    references: [landlords.id]
  }),
  // For corporate landlords: link through corporate owner
  corporateOwner: one(corporateOwner, {
    fields: [beneficialOwner.corporateOwnerId],
    references: [corporateOwner.id]
  }),
  // Legacy: link to unified contact company details (deprecated)
  company: one(companyDetails, {
    fields: [beneficialOwner.companyDetailsId],
    references: [companyDetails.id]
  }),
  kycDocuments: many(kycDocuments)
}));

export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({
  contact: one(unifiedContacts, {
    fields: [kycDocuments.contactId],
    references: [unifiedContacts.id]
  }),
  beneficialOwnerRecord: one(beneficialOwner, {
    fields: [kycDocuments.beneficialOwnerId],
    references: [beneficialOwner.id]
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
export const propertyInquiries = pgTable("property_inquiry", {
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
export const contacts = pgTable("contact", {
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
export const valuations = pgTable("valuation", {
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
  tenantProfiles: many(tenant)
}));

// Tenant relations
export const tenantRelations = relations(tenant, ({ one }) => ({
  user: one(users, {
    fields: [tenant.userId],
    references: [users.id]
  }),
  property: one(properties, {
    fields: [tenant.propertyId],
    references: [properties.id]
  }),
  landlord: one(landlords, {
    fields: [tenant.landlordId],
    references: [landlords.id]
  }),
  tenancyContract: one(tenancyContracts, {
    fields: [tenant.tenancyContractId],
    references: [tenancyContracts.id]
  }),
  contract: one(contracts, {
    fields: [tenant.contractId],
    references: [contracts.id]
  }),
  rentalAgreement: one(rentalAgreements, {
    fields: [tenant.rentalAgreementId],
    references: [rentalAgreements.id]
  })
}));

// ============================================
// ESTATE AGENCY STAFF ROLES AND PERMISSIONS
// ============================================

// Estate Agency Roles - UK property industry specific roles
export const estateAgencyRoles = pgTable("estate_agency_role", {
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

  // Security clearance level required for this role (1-10)
  requiredClearance: integer("required_clearance").notNull().default(5),

  // Status
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Role permissions - what each role can access/do in the system
export const rolePermissions = pgTable("role_permission", {
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
export const staffRoleAssignments = pgTable("staff_role_assignment", {
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

// Security Clearance Levels - 1-10 scale for hierarchical access control
export const SECURITY_CLEARANCE_LEVELS = {
  // Level 1-2: Public/Guest
  public: 1,
  guest: 2,

  // Level 3-4: Basic Users
  user: 3,
  tenant: 4,
  landlord: 4,

  // Level 5-6: Staff
  maintenance_staff: 5,
  branch_administrator: 5,
  lettings_negotiator: 6,
  sales_negotiator: 6,

  // Level 7-8: Senior Staff
  senior_sales_negotiator: 7,
  property_manager: 7,
  mortgage_advisor: 7,

  // Level 9: Management
  branch_manager: 9,

  // Level 10: System Admin
  admin: 10,
  system_admin: 10
} as const;

export const SECURITY_CLEARANCE_LABELS: Record<number, string> = {
  1: 'Public',
  2: 'Guest',
  3: 'Basic User',
  4: 'Registered User',
  5: 'Staff Level 1',
  6: 'Staff Level 2',
  7: 'Senior Staff',
  8: 'Supervisor',
  9: 'Management',
  10: 'System Administrator'
} as const;

// Security Settings - feature-level access control
export const securitySettings = pgTable("security_setting", {
  id: serial("id").primaryKey(),
  featureKey: text("feature_key").notNull().unique(), // 'integrations', 'user_management', 'security_matrix', etc.
  featureName: text("feature_name").notNull(),
  description: text("description"),
  requiredClearance: integer("required_clearance").notNull().default(10), // Default to admin-only
  category: text("category").notNull(), // 'system', 'crm', 'property_management', 'reports'
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Security Audit Log - track all security-related changes
export const securityAuditLog = pgTable("security_audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // User who made the change
  action: text("action").notNull(), // 'clearance_change', 'feature_access_change', 'role_assignment', etc.
  targetType: text("target_type").notNull(), // 'user', 'feature', 'role'
  targetId: integer("target_id"), // ID of affected entity
  targetName: text("target_name"), // Name for display purposes
  oldValue: text("old_value"), // JSON stringified old value
  newValue: text("new_value"), // JSON stringified new value
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Access Levels - defines the organizational hierarchy
export const accessLevels = pgTable("access_level", {
  id: serial("id").primaryKey(),
  levelCode: text("level_code").notNull().unique(), // 'owner', 'general_manager', 'sales_negotiator', etc.
  levelName: text("level_name").notNull(),
  description: text("description"),
  clearanceLevel: integer("clearance_level").notNull(), // 1-10 scale
  parentLevelCode: text("parent_level_code"), // For hierarchy (e.g., sales_negotiator reports to general_manager)
  color: text("color"), // For UI display (e.g., '#791E75')
  icon: text("icon"), // Icon name for UI
  isSystemLevel: boolean("is_system_level").default(false), // Cannot be deleted if true
  canBeAssigned: boolean("can_be_assigned").default(true), // Whether users can be assigned this level
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// User Custom Permissions - allows owner to override/add specific permissions per user
export const userCustomPermissions = pgTable("user_custom_permission", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  featureKey: text("feature_key").notNull(), // Reference to security_settings.feature_key
  accessGranted: boolean("access_granted").notNull().default(true), // true = grant, false = revoke
  grantedBy: integer("granted_by").notNull(), // User who granted/revoked this permission
  reason: text("reason"), // Why this override was applied
  expiresAt: timestamp("expires_at"), // Optional expiration for temporary permissions
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Feature Module Groups - groups features into logical modules
export const featureModules = pgTable("feature_module", {
  id: serial("id").primaryKey(),
  moduleCode: text("module_code").notNull().unique(),
  moduleName: text("module_name").notNull(),
  description: text("description"),
  icon: text("icon"),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Access Level Permissions - defines which features each access level has
export const accessLevelPermissions = pgTable("access_level_permission", {
  id: serial("id").primaryKey(),
  accessLevelId: integer("access_level_id").notNull(),
  featureKey: text("feature_key").notNull(),
  canRead: boolean("can_read").default(true),
  canWrite: boolean("can_write").default(false),
  canDelete: boolean("can_delete").default(false),
  canAdmin: boolean("can_admin").default(false), // Full control including settings
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Default Access Levels for John Barclay
export const DEFAULT_ACCESS_LEVELS = [
  {
    levelCode: 'system_admin',
    levelName: 'System Administrator',
    description: 'Full system access - technical administration',
    clearanceLevel: 10,
    parentLevelCode: null,
    color: '#DC2626',
    icon: 'Shield',
    isSystemLevel: true,
    canBeAssigned: false
  },
  {
    levelCode: 'owner',
    levelName: 'Director / Owner',
    description: 'Business owner with full access to all operations except technical system admin',
    clearanceLevel: 9,
    parentLevelCode: 'system_admin',
    color: '#791E75',
    icon: 'Crown',
    isSystemLevel: true,
    canBeAssigned: true
  },
  {
    levelCode: 'general_manager',
    levelName: 'General Manager',
    description: 'Full operational access - manages all departments and staff',
    clearanceLevel: 8,
    parentLevelCode: 'owner',
    color: '#2563EB',
    icon: 'Briefcase',
    isSystemLevel: true,
    canBeAssigned: true
  },
  {
    levelCode: 'branch_manager',
    levelName: 'Branch Manager',
    description: 'Manages branch operations, staff performance, and can view reports',
    clearanceLevel: 7,
    parentLevelCode: 'general_manager',
    color: '#059669',
    icon: 'Building2',
    isSystemLevel: true,
    canBeAssigned: true
  },
  {
    levelCode: 'senior_negotiator',
    levelName: 'Senior Sales/Lettings Negotiator',
    description: 'Experienced negotiator with valuations and team mentoring responsibilities',
    clearanceLevel: 6,
    parentLevelCode: 'branch_manager',
    color: '#D97706',
    icon: 'Star',
    isSystemLevel: true,
    canBeAssigned: true
  },
  {
    levelCode: 'sales_lettings_negotiator',
    levelName: 'Sales & Lettings Negotiator',
    description: 'Core sales and lettings operations - viewings, negotiations, client management',
    clearanceLevel: 5,
    parentLevelCode: 'senior_negotiator',
    color: '#7C3AED',
    icon: 'UserCheck',
    isSystemLevel: true,
    canBeAssigned: true
  },
  {
    levelCode: 'property_manager',
    levelName: 'Property Manager',
    description: 'Manages tenancies, maintenance, landlord communications, and compliance',
    clearanceLevel: 5,
    parentLevelCode: 'branch_manager',
    color: '#0891B2',
    icon: 'Home',
    isSystemLevel: true,
    canBeAssigned: true
  },
  {
    levelCode: 'administrator',
    levelName: 'Branch Administrator',
    description: 'Admin support - document management, scheduling, front desk',
    clearanceLevel: 4,
    parentLevelCode: 'branch_manager',
    color: '#6B7280',
    icon: 'ClipboardList',
    isSystemLevel: true,
    canBeAssigned: true
  },
  {
    levelCode: 'viewer',
    levelName: 'Read-Only Access',
    description: 'Can view data but cannot make changes',
    clearanceLevel: 3,
    parentLevelCode: null,
    color: '#9CA3AF',
    icon: 'Eye',
    isSystemLevel: true,
    canBeAssigned: true
  }
] as const;

// Default Feature Modules
export const DEFAULT_FEATURE_MODULES = [
  { moduleCode: 'sales', moduleName: 'Sales Operations', description: 'Property sales, offers, and progression', icon: 'TrendingUp', displayOrder: 1 },
  { moduleCode: 'lettings', moduleName: 'Lettings Operations', description: 'Rental listings, applications, and tenancies', icon: 'Key', displayOrder: 2 },
  { moduleCode: 'property_mgmt', moduleName: 'Property Management', description: 'Managed properties, maintenance, and compliance', icon: 'Building', displayOrder: 3 },
  { moduleCode: 'leads', moduleName: 'Leads & CRM', description: 'Lead management, contacts, and communications', icon: 'Users', displayOrder: 4 },
  { moduleCode: 'viewings', moduleName: 'Viewings & Calendar', description: 'Viewing appointments and scheduling', icon: 'Calendar', displayOrder: 5 },
  { moduleCode: 'finance', moduleName: 'Finance & Reports', description: 'Financial data, commissions, and reporting', icon: 'PoundSterling', displayOrder: 6 },
  { moduleCode: 'staff', moduleName: 'Staff & HR', description: 'Staff management and performance', icon: 'UserCog', displayOrder: 7 },
  { moduleCode: 'system', moduleName: 'System Settings', description: 'Integrations, security, and configuration', icon: 'Settings', displayOrder: 8 }
] as const;

// Comprehensive feature security settings
export const DEFAULT_FEATURE_SECURITY = [
  // Sales Operations
  { featureKey: 'sales_listings_view', featureName: 'View Sales Listings', description: 'View properties for sale', requiredClearance: 5, category: 'sales', module: 'sales' },
  { featureKey: 'sales_listings_create', featureName: 'Create Sales Listings', description: 'Add new properties for sale', requiredClearance: 5, category: 'sales', module: 'sales' },
  { featureKey: 'sales_listings_edit', featureName: 'Edit Sales Listings', description: 'Modify sales property details', requiredClearance: 5, category: 'sales', module: 'sales' },
  { featureKey: 'sales_listings_delete', featureName: 'Delete Sales Listings', description: 'Remove sales listings', requiredClearance: 7, category: 'sales', module: 'sales' },
  { featureKey: 'sales_offers_manage', featureName: 'Manage Offers', description: 'Handle purchase offers and negotiations', requiredClearance: 5, category: 'sales', module: 'sales' },
  { featureKey: 'sales_progression', featureName: 'Sales Progression', description: 'Progress sales through to completion', requiredClearance: 5, category: 'sales', module: 'sales' },
  { featureKey: 'sales_valuations', featureName: 'Property Valuations', description: 'Conduct and manage valuations', requiredClearance: 6, category: 'sales', module: 'sales' },

  // Lettings Operations
  { featureKey: 'lettings_listings_view', featureName: 'View Rental Listings', description: 'View properties for rent', requiredClearance: 5, category: 'lettings', module: 'lettings' },
  { featureKey: 'lettings_listings_create', featureName: 'Create Rental Listings', description: 'Add new rental properties', requiredClearance: 5, category: 'lettings', module: 'lettings' },
  { featureKey: 'lettings_listings_edit', featureName: 'Edit Rental Listings', description: 'Modify rental property details', requiredClearance: 5, category: 'lettings', module: 'lettings' },
  { featureKey: 'lettings_listings_delete', featureName: 'Delete Rental Listings', description: 'Remove rental listings', requiredClearance: 7, category: 'lettings', module: 'lettings' },
  { featureKey: 'lettings_applications', featureName: 'Rental Applications', description: 'Process tenant applications', requiredClearance: 5, category: 'lettings', module: 'lettings' },
  { featureKey: 'lettings_agreements', featureName: 'Tenancy Agreements', description: 'Create and manage tenancy agreements', requiredClearance: 5, category: 'lettings', module: 'lettings' },
  { featureKey: 'lettings_renewals', featureName: 'Tenancy Renewals', description: 'Handle tenancy renewals', requiredClearance: 5, category: 'lettings', module: 'lettings' },

  // Property Management
  { featureKey: 'pm_properties_view', featureName: 'View Managed Properties', description: 'View properties under management', requiredClearance: 5, category: 'property_management', module: 'property_mgmt' },
  { featureKey: 'pm_properties_manage', featureName: 'Manage Properties', description: 'Full property management operations', requiredClearance: 5, category: 'property_management', module: 'property_mgmt' },
  { featureKey: 'pm_maintenance_view', featureName: 'View Maintenance', description: 'View maintenance tickets', requiredClearance: 5, category: 'property_management', module: 'property_mgmt' },
  { featureKey: 'pm_maintenance_create', featureName: 'Create Maintenance Tickets', description: 'Log maintenance issues', requiredClearance: 5, category: 'property_management', module: 'property_mgmt' },
  { featureKey: 'pm_maintenance_assign', featureName: 'Assign Contractors', description: 'Assign contractors to jobs', requiredClearance: 5, category: 'property_management', module: 'property_mgmt' },
  { featureKey: 'pm_maintenance_approve', featureName: 'Approve Maintenance Costs', description: 'Approve quotes and invoices', requiredClearance: 7, category: 'property_management', module: 'property_mgmt' },
  { featureKey: 'pm_compliance', featureName: 'Compliance & Certificates', description: 'Manage gas safety, EPC, EICR certificates', requiredClearance: 5, category: 'property_management', module: 'property_mgmt' },
  { featureKey: 'pm_landlords_manage', featureName: 'Manage Landlords', description: 'Landlord communications and onboarding', requiredClearance: 5, category: 'property_management', module: 'property_mgmt' },
  { featureKey: 'pm_tenants_manage', featureName: 'Manage Tenants', description: 'Tenant communications and support', requiredClearance: 5, category: 'property_management', module: 'property_mgmt' },

  // Leads & CRM
  { featureKey: 'leads_view', featureName: 'View Leads', description: 'View lead and contact records', requiredClearance: 5, category: 'crm', module: 'leads' },
  { featureKey: 'leads_create', featureName: 'Create Leads', description: 'Add new leads and contacts', requiredClearance: 5, category: 'crm', module: 'leads' },
  { featureKey: 'leads_edit', featureName: 'Edit Leads', description: 'Update lead information', requiredClearance: 5, category: 'crm', module: 'leads' },
  { featureKey: 'leads_delete', featureName: 'Delete Leads', description: 'Remove lead records', requiredClearance: 7, category: 'crm', module: 'leads' },
  { featureKey: 'leads_assign', featureName: 'Assign Leads', description: 'Assign leads to agents', requiredClearance: 6, category: 'crm', module: 'leads' },
  { featureKey: 'leads_kyc', featureName: 'KYC & Verification', description: 'Verify ID, proof of funds', requiredClearance: 5, category: 'crm', module: 'leads' },
  { featureKey: 'contacts_manage', featureName: 'Manage Contacts', description: 'Contact database management', requiredClearance: 5, category: 'crm', module: 'leads' },
  { featureKey: 'communications_log', featureName: 'Log Communications', description: 'Record calls, emails, meetings', requiredClearance: 5, category: 'crm', module: 'leads' },

  // Viewings & Calendar
  { featureKey: 'viewings_view', featureName: 'View Viewings', description: 'See scheduled viewings', requiredClearance: 5, category: 'viewings', module: 'viewings' },
  { featureKey: 'viewings_book', featureName: 'Book Viewings', description: 'Schedule property viewings', requiredClearance: 5, category: 'viewings', module: 'viewings' },
  { featureKey: 'viewings_feedback', featureName: 'Viewing Feedback', description: 'Record viewing feedback', requiredClearance: 5, category: 'viewings', module: 'viewings' },
  { featureKey: 'calendar_personal', featureName: 'Personal Calendar', description: 'View own appointments', requiredClearance: 5, category: 'viewings', module: 'viewings' },
  { featureKey: 'calendar_team', featureName: 'Team Calendar', description: 'View team schedules', requiredClearance: 6, category: 'viewings', module: 'viewings' },

  // Finance & Reports
  { featureKey: 'finance_view_basic', featureName: 'View Basic Financials', description: 'See own commissions and fees', requiredClearance: 5, category: 'finance', module: 'finance' },
  { featureKey: 'finance_view_all', featureName: 'View All Financials', description: 'See company financial data', requiredClearance: 8, category: 'finance', module: 'finance' },
  { featureKey: 'finance_invoices', featureName: 'Manage Invoices', description: 'Create and manage invoices', requiredClearance: 7, category: 'finance', module: 'finance' },
  { featureKey: 'finance_payments', featureName: 'Process Payments', description: 'Handle rent collection and payments', requiredClearance: 7, category: 'finance', module: 'finance' },
  { featureKey: 'reports_personal', featureName: 'Personal Reports', description: 'View own performance reports', requiredClearance: 5, category: 'reports', module: 'finance' },
  { featureKey: 'reports_team', featureName: 'Team Reports', description: 'View team performance reports', requiredClearance: 7, category: 'reports', module: 'finance' },
  { featureKey: 'reports_company', featureName: 'Company Reports', description: 'View company-wide reports', requiredClearance: 8, category: 'reports', module: 'finance' },
  { featureKey: 'analytics_dashboard', featureName: 'Analytics Dashboard', description: 'Access analytics and KPIs', requiredClearance: 6, category: 'reports', module: 'finance' },

  // Staff & HR
  { featureKey: 'staff_view', featureName: 'View Staff', description: 'See staff directory', requiredClearance: 5, category: 'staff', module: 'staff' },
  { featureKey: 'staff_manage', featureName: 'Manage Staff', description: 'Edit staff details and roles', requiredClearance: 8, category: 'staff', module: 'staff' },
  { featureKey: 'staff_performance', featureName: 'Staff Performance', description: 'View and manage performance reviews', requiredClearance: 7, category: 'staff', module: 'staff' },
  { featureKey: 'staff_attendance', featureName: 'Attendance & Leave', description: 'Manage attendance and leave', requiredClearance: 7, category: 'staff', module: 'staff' },

  // System Settings
  { featureKey: 'integrations', featureName: 'Integrations', description: 'API keys and third-party service credentials', requiredClearance: 9, category: 'system', module: 'system' },
  { featureKey: 'security_matrix', featureName: 'Security Matrix', description: 'Security clearance and access management', requiredClearance: 9, category: 'system', module: 'system' },
  { featureKey: 'user_management', featureName: 'User Management', description: 'Create, edit, and delete user accounts', requiredClearance: 9, category: 'system', module: 'system' },
  { featureKey: 'role_management', featureName: 'Role Management', description: 'Assign and manage user roles', requiredClearance: 9, category: 'system', module: 'system' },
  { featureKey: 'audit_logs', featureName: 'Audit Logs', description: 'View system audit trail', requiredClearance: 9, category: 'system', module: 'system' },
  { featureKey: 'workflows', featureName: 'Workflow Settings', description: 'Configure automated workflows', requiredClearance: 8, category: 'system', module: 'system' },
  { featureKey: 'portal_config', featureName: 'Portal Configuration', description: 'Configure property portal syndication', requiredClearance: 7, category: 'system', module: 'system' },
  { featureKey: 'email_templates', featureName: 'Email Templates', description: 'Manage email templates', requiredClearance: 7, category: 'system', module: 'system' }
] as const;

// Default permissions for each access level
export const DEFAULT_ACCESS_LEVEL_PERMISSIONS = {
  // Owner - Access to everything below admin
  owner: [
    'sales_listings_view', 'sales_listings_create', 'sales_listings_edit', 'sales_listings_delete',
    'sales_offers_manage', 'sales_progression', 'sales_valuations',
    'lettings_listings_view', 'lettings_listings_create', 'lettings_listings_edit', 'lettings_listings_delete',
    'lettings_applications', 'lettings_agreements', 'lettings_renewals',
    'pm_properties_view', 'pm_properties_manage', 'pm_maintenance_view', 'pm_maintenance_create',
    'pm_maintenance_assign', 'pm_maintenance_approve', 'pm_compliance', 'pm_landlords_manage', 'pm_tenants_manage',
    'leads_view', 'leads_create', 'leads_edit', 'leads_delete', 'leads_assign', 'leads_kyc',
    'contacts_manage', 'communications_log',
    'viewings_view', 'viewings_book', 'viewings_feedback', 'calendar_personal', 'calendar_team',
    'finance_view_basic', 'finance_view_all', 'finance_invoices', 'finance_payments',
    'reports_personal', 'reports_team', 'reports_company', 'analytics_dashboard',
    'staff_view', 'staff_manage', 'staff_performance', 'staff_attendance',
    'integrations', 'security_matrix', 'user_management', 'role_management', 'audit_logs',
    'workflows', 'portal_config', 'email_templates'
  ],

  // General Manager - All operational access
  general_manager: [
    'sales_listings_view', 'sales_listings_create', 'sales_listings_edit', 'sales_listings_delete',
    'sales_offers_manage', 'sales_progression', 'sales_valuations',
    'lettings_listings_view', 'lettings_listings_create', 'lettings_listings_edit', 'lettings_listings_delete',
    'lettings_applications', 'lettings_agreements', 'lettings_renewals',
    'pm_properties_view', 'pm_properties_manage', 'pm_maintenance_view', 'pm_maintenance_create',
    'pm_maintenance_assign', 'pm_maintenance_approve', 'pm_compliance', 'pm_landlords_manage', 'pm_tenants_manage',
    'leads_view', 'leads_create', 'leads_edit', 'leads_delete', 'leads_assign', 'leads_kyc',
    'contacts_manage', 'communications_log',
    'viewings_view', 'viewings_book', 'viewings_feedback', 'calendar_personal', 'calendar_team',
    'finance_view_basic', 'finance_view_all', 'finance_invoices', 'finance_payments',
    'reports_personal', 'reports_team', 'reports_company', 'analytics_dashboard',
    'staff_view', 'staff_manage', 'staff_performance', 'staff_attendance',
    'workflows', 'portal_config', 'email_templates'
  ],

  // Branch Manager
  branch_manager: [
    'sales_listings_view', 'sales_listings_create', 'sales_listings_edit', 'sales_listings_delete',
    'sales_offers_manage', 'sales_progression', 'sales_valuations',
    'lettings_listings_view', 'lettings_listings_create', 'lettings_listings_edit', 'lettings_listings_delete',
    'lettings_applications', 'lettings_agreements', 'lettings_renewals',
    'pm_properties_view', 'pm_properties_manage', 'pm_maintenance_view', 'pm_maintenance_create',
    'pm_maintenance_assign', 'pm_maintenance_approve', 'pm_compliance', 'pm_landlords_manage', 'pm_tenants_manage',
    'leads_view', 'leads_create', 'leads_edit', 'leads_assign', 'leads_kyc',
    'contacts_manage', 'communications_log',
    'viewings_view', 'viewings_book', 'viewings_feedback', 'calendar_personal', 'calendar_team',
    'finance_view_basic', 'reports_personal', 'reports_team', 'analytics_dashboard',
    'staff_view', 'staff_performance', 'staff_attendance',
    'portal_config', 'email_templates'
  ],

  // Senior Negotiator
  senior_negotiator: [
    'sales_listings_view', 'sales_listings_create', 'sales_listings_edit',
    'sales_offers_manage', 'sales_progression', 'sales_valuations',
    'lettings_listings_view', 'lettings_listings_create', 'lettings_listings_edit',
    'lettings_applications', 'lettings_agreements', 'lettings_renewals',
    'leads_view', 'leads_create', 'leads_edit', 'leads_assign', 'leads_kyc',
    'contacts_manage', 'communications_log',
    'viewings_view', 'viewings_book', 'viewings_feedback', 'calendar_personal', 'calendar_team',
    'finance_view_basic', 'reports_personal', 'analytics_dashboard',
    'staff_view'
  ],

  // Sales & Lettings Negotiator - Core sales/lettings CRUD and operations
  sales_lettings_negotiator: [
    'sales_listings_view', 'sales_listings_create', 'sales_listings_edit',
    'sales_offers_manage', 'sales_progression',
    'lettings_listings_view', 'lettings_listings_create', 'lettings_listings_edit',
    'lettings_applications', 'lettings_agreements', 'lettings_renewals',
    'leads_view', 'leads_create', 'leads_edit', 'leads_kyc',
    'contacts_manage', 'communications_log',
    'viewings_view', 'viewings_book', 'viewings_feedback', 'calendar_personal',
    'finance_view_basic', 'reports_personal',
    'staff_view'
  ],

  // Property Manager
  property_manager: [
    'lettings_listings_view', 'lettings_agreements', 'lettings_renewals',
    'pm_properties_view', 'pm_properties_manage', 'pm_maintenance_view', 'pm_maintenance_create',
    'pm_maintenance_assign', 'pm_compliance', 'pm_landlords_manage', 'pm_tenants_manage',
    'leads_view', 'contacts_manage', 'communications_log',
    'viewings_view', 'calendar_personal',
    'finance_view_basic', 'reports_personal',
    'staff_view'
  ],

  // Administrator
  administrator: [
    'sales_listings_view', 'lettings_listings_view',
    'pm_properties_view', 'pm_maintenance_view',
    'leads_view', 'contacts_manage', 'communications_log',
    'viewings_view', 'calendar_personal', 'calendar_team',
    'staff_view'
  ],

  // Viewer - Read only
  viewer: [
    'sales_listings_view', 'lettings_listings_view',
    'pm_properties_view', 'pm_maintenance_view',
    'leads_view', 'viewings_view', 'calendar_personal',
    'staff_view'
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

export const insertContractorSchema = createInsertSchema(contractors).omit({
  id: true,
  createdAt: true
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

export const insertSecuritySettingSchema = createInsertSchema(securitySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertSecurityAuditLogSchema = createInsertSchema(securityAuditLog).omit({
  id: true,
  createdAt: true
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

export const insertBeneficialOwnerSchema = createInsertSchema(beneficialOwner).omit({
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

export type Contractor = typeof contractors.$inferSelect;
export type InsertContractor = z.infer<typeof insertContractorSchema>;

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

export type SecuritySetting = typeof securitySettings.$inferSelect;
export type InsertSecuritySetting = z.infer<typeof insertSecuritySettingSchema>;

export type SecurityAuditLog = typeof securityAuditLog.$inferSelect;
export type InsertSecurityAuditLog = z.infer<typeof insertSecurityAuditLogSchema>;

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
export const conversations = pgTable("conversation", {
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
export const messages = pgTable("message", {
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
export const campaigns = pgTable("campaign", {
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
export const campaignRecipients = pgTable("campaign_recipient", {
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
export const payments = pgTable("payment", {
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
export const paymentSchedules = pgTable("payment_schedule", {
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
export const reports = pgTable("report", {
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

// Document storage - unified table for all documents across entities
// Stores documents for: properties, landlords, tenants, tenancies, beneficial owners, corporate owners
export const document = pgTable("document", {
  id: serial("id").primaryKey(),

  // Document info
  name: text("name").notNull(),
  originalName: text("original_name").notNull(),
  documentType: text("document_type").notNull(), // 'tenancy_agreement', 'epc', 'gas_safety', 'eicr', 'id_document', 'passport', 'proof_of_address', 'bank_statement', 'reference', 'inventory', 'check_in', 'check_out', 'certificate', 'invoice', 'photo', 'report', 'other'
  description: text("description"),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // In bytes

  // Storage
  storageUrl: text("storage_url").notNull(),
  storageProvider: text("storage_provider").default("local"), // 'local', 's3', 'cloudinary'

  // Entity references - polymorphic association (for backwards compatibility)
  entityType: text("entity_type"), // 'property', 'landlord', 'tenant', 'tenancy', 'beneficial_owner', 'corporate_owner', 'user', 'ticket', 'payment'
  entityId: integer("entity_id"),

  // Direct FK references for type safety and performance
  propertyId: integer("property_id"),
  landlordId: integer("landlord_id"),
  tenantId: integer("tenant_id"),
  tenancyId: integer("tenancy_id"),
  beneficialOwnerId: integer("beneficial_owner_id"),
  corporateOwnerId: integer("corporate_owner_id"),

  // Document dates
  documentDate: timestamp("document_date"),
  expiryDate: timestamp("expiry_date"),
  referenceNumber: text("reference_number"),

  // Status & verification
  status: text("status").default("active"), // 'active', 'expired', 'superseded', 'draft'
  isRequired: boolean("is_required").default(false),
  isVerified: boolean("is_verified").default(false),
  verifiedBy: integer("verified_by"),
  verifiedAt: timestamp("verified_at"),

  // Security
  isPublic: boolean("is_public").default(false),
  accessToken: text("access_token"), // For secure access

  // Additional info
  metadata: json("metadata"), // Additional info like dimensions for images
  notes: text("notes"),

  // Uploaded by
  uploadedBy: integer("uploaded_by"),

  // Version control
  version: integer("version").default(1),
  previousVersionId: integer("previous_version_id"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Relations for document table
export const documentRelations = relations(document, ({ one }) => ({
  property: one(properties, {
    fields: [document.propertyId],
    references: [properties.id]
  }),
  landlord: one(landlords, {
    fields: [document.landlordId],
    references: [landlords.id]
  }),
  tenant: one(tenant, {
    fields: [document.tenantId],
    references: [tenant.id]
  }),
  tenancy: one(tenancies, {
    fields: [document.tenancyId],
    references: [tenancies.id]
  }),
  beneficialOwnerRecord: one(beneficialOwner, {
    fields: [document.beneficialOwnerId],
    references: [beneficialOwner.id]
  }),
  corporateOwnerRecord: one(corporateOwner, {
    fields: [document.corporateOwnerId],
    references: [corporateOwner.id]
  }),
  verifiedByUser: one(users, {
    fields: [document.verifiedBy],
    references: [users.id]
  }),
  uploadedByUser: one(users, {
    fields: [document.uploadedBy],
    references: [users.id]
  })
}));

// Insert schema for document
export const insertDocumentSchema = createInsertSchema(document).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type Document = typeof document.$inferSelect;
export type InsertDocument = typeof document.$inferInsert;

// ==========================================
// CALENDAR & SCHEDULING TABLES
// ==========================================

// Calendar events (viewings, valuations, meetings)
export const calendarEvents = pgTable("calendar_event", {
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
export const calendarSettings = pgTable("calendar_setting", {
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
export const proactiveLeads = pgTable("proactive_lead", {
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
export const leadMonitoringConfigs = pgTable("lead_monitoring_config", {
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
export const seasonalCampaigns = pgTable("seasonal_campaign", {
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
export const propensityScores = pgTable("propensity_score", {
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
export const socialMediaMentions = pgTable("social_media_mention", {
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

export const insertTenantSchema = createInsertSchema(tenant).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertCorporateOwnerSchema = createInsertSchema(corporateOwner).omit({
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

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export type Landlord = typeof landlords.$inferSelect;
export type InsertLandlord = z.infer<typeof insertLandlordSchema>;

export type RentalAgreement = typeof rentalAgreements.$inferSelect;
export type InsertRentalAgreement = z.infer<typeof insertRentalAgreementSchema>;

export type Tenant = typeof tenant.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

export type CorporateOwner = typeof corporateOwner.$inferSelect;
export type InsertCorporateOwner = z.infer<typeof insertCorporateOwnerSchema>;

export type BeneficialOwner = typeof beneficialOwner.$inferSelect;
export type InsertBeneficialOwner = z.infer<typeof insertBeneficialOwnerSchema>;

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

export type KycDocument = typeof kycDocuments.$inferSelect;
export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;

export type ManagedProperty = typeof managedProperties.$inferSelect;
export type InsertManagedProperty = z.infer<typeof insertManagedPropertySchema>;

export type JointTenant = typeof jointTenants.$inferSelect;
export type InsertJointTenant = z.infer<typeof insertJointTenantSchema>;

export type SalesProgression = typeof salesProgression.$inferSelect;
export type InsertSalesProgression = z.infer<typeof insertSalesProgressionSchema>;

// Management fees - fee structures per property
export const managementFees = pgTable("management_fee", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  feePercentage: decimal("fee_percentage").notNull(), // e.g., 10, 13, 14.4
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  effectiveTo: timestamp("effective_to"), // null = current
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Property certificates - compliance and safety certificates for managed properties
export const propertyCertificates = pgTable("property_certificate", {
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

// @deprecated - Use 'tenancies' table instead. This table is kept for backwards compatibility.
// All tenancy agreement documents should now be stored in the 'documents' table.
export const tenancyContracts = pgTable("tenancy_contract", {
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

// Tenancies table - active tenancy records with full deposit and guarantor info
export const tenancies = pgTable("tenancy", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  landlordId: integer("landlord_id").notNull(),
  tenantId: integer("tenant_id"),

  // Tenancy dates
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  periodMonths: integer("period_months"),
  isPeriodic: boolean("is_periodic").default(false),

  // Rent details
  rentAmount: decimal("rent_amount").notNull(),
  rentFrequency: text("rent_frequency").notNull().default("monthly"),
  rentDueDay: integer("rent_due_day").default(1),

  // Deposit details
  depositAmount: decimal("deposit_amount"),
  depositScheme: text("deposit_scheme"), // TDS, DPS
  depositHolderType: text("deposit_holder_type"), // agency_custodial, agency_insurance, landlord
  depositCertificateNumber: text("deposit_certificate_number"),
  depositProtectedDate: timestamp("deposit_protected_date"),

  // Guarantor details
  guarantorName: text("guarantor_name"),
  guarantorEmail: text("guarantor_email"),
  guarantorPhone: text("guarantor_phone"),
  guarantorAddress: text("guarantor_address"),

  // Status
  status: text("status").notNull().default("active"), // active, expired, terminated
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export type Tenancy = typeof tenancies.$inferSelect;
export type InsertTenancy = typeof tenancies.$inferInsert;

// ==========================================
// TENANCY CONTRACTS/DOCUMENTS TABLE
// Stores all paperwork associated with a tenancy
// ==========================================

// Document types for tenancy contracts
export const contractDocumentTypes = [
  'tenancy_agreement',
  'ast_agreement',           // Assured Shorthold Tenancy
  'reference_letter',
  'bank_reference',
  'employer_reference',
  'previous_landlord_reference',
  'guarantor_agreement',
  'inventory_report',
  'check_in_report',
  'check_out_report',
  'epc_certificate',
  'gas_safety_certificate',
  'eicr_certificate',
  'deposit_certificate',
  'standing_order_mandate',
  'rent_demand',
  'section_21_notice',
  'section_8_notice',
  'renewal_agreement',
  'addendum',
  'correspondence',
  'other'
] as const;

export type ContractDocumentType = typeof contractDocumentTypes[number];

// Human-readable labels for document types
export const contractDocumentLabels: Record<ContractDocumentType, string> = {
  'tenancy_agreement': 'Tenancy Agreement',
  'ast_agreement': 'AST Agreement',
  'reference_letter': 'Reference Letter',
  'bank_reference': 'Bank Reference',
  'employer_reference': 'Employer Reference',
  'previous_landlord_reference': 'Previous Landlord Reference',
  'guarantor_agreement': 'Guarantor Agreement',
  'inventory_report': 'Inventory Report',
  'check_in_report': 'Check-In Report',
  'check_out_report': 'Check-Out Report',
  'epc_certificate': 'EPC Certificate',
  'gas_safety_certificate': 'Gas Safety Certificate',
  'eicr_certificate': 'EICR Certificate',
  'deposit_certificate': 'Deposit Protection Certificate',
  'standing_order_mandate': 'Standing Order Mandate',
  'rent_demand': 'Rent Demand',
  'section_21_notice': 'Section 21 Notice',
  'section_8_notice': 'Section 8 Notice',
  'renewal_agreement': 'Renewal Agreement',
  'addendum': 'Addendum',
  'correspondence': 'Correspondence',
  'other': 'Other Document'
};

// @deprecated - Use 'documents' table instead for all document storage.
// This table is kept for backwards compatibility but should not be used for new code.
export const contracts = pgTable("contract", {
  id: serial("id").primaryKey(),

  // Relationships
  propertyId: integer("property_id").notNull(),
  landlordId: integer("landlord_id").notNull(),
  tenantId: integer("tenant_id"),
  tenancyId: integer("tenancy_id"), // Links to tenancies table

  // Document info
  documentType: text("document_type").notNull(), // One of contractDocumentTypes
  documentName: text("document_name").notNull(), // Display name
  description: text("description"),

  // File storage
  fileUrl: text("file_url"), // URL/path to stored file
  fileName: text("file_name"), // Original filename
  fileSize: integer("file_size"), // Size in bytes
  mimeType: text("mime_type"), // e.g., 'application/pdf'

  // Document dates
  documentDate: timestamp("document_date"), // Date on the document
  expiryDate: timestamp("expiry_date"), // For certificates that expire

  // Reference numbers
  referenceNumber: text("reference_number"), // External reference (e.g., deposit certificate number)

  // Status
  status: text("status").notNull().default("active"), // active, superseded, expired, void
  isRequired: boolean("is_required").default(false), // Is this a required document?
  isVerified: boolean("is_verified").default(false), // Has this been verified?
  verifiedBy: integer("verified_by"), // User ID who verified
  verifiedAt: timestamp("verified_at"),

  // Notes
  notes: text("notes"),

  // Audit
  uploadedBy: integer("uploaded_by"), // User ID who uploaded
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Relations for contracts
export const contractsRelations = relations(contracts, ({ one }) => ({
  property: one(properties, {
    fields: [contracts.propertyId],
    references: [properties.id]
  }),
  landlord: one(landlords, {
    fields: [contracts.landlordId],
    references: [landlords.id]
  }),
  tenant: one(tenant, {
    fields: [contracts.tenantId],
    references: [tenant.id]
  }),
  tenancy: one(tenancies, {
    fields: [contracts.tenancyId],
    references: [tenancies.id]
  }),
  verifiedByUser: one(users, {
    fields: [contracts.verifiedBy],
    references: [users.id]
  }),
  uploadedByUser: one(users, {
    fields: [contracts.uploadedBy],
    references: [users.id]
  })
}));

// Insert schema for contracts
export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

// Property management checklists - compliance tracking per property/contract
export const propertyChecklists = pgTable("property_checklist", {
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

export const landlordsRelations = relations(landlords, ({ one, many }) => ({
  contracts: many(tenancyContracts),
  // For corporate landlords: link to the corporate owner entity
  corporateOwner: one(corporateOwner, {
    fields: [landlords.corporateOwnerId],
    references: [corporateOwner.id]
  }),
  // For individual landlords: direct link to beneficial owners
  // For corporate landlords: beneficial owners are accessed via corporateOwner
  beneficialOwners: many(beneficialOwner)
}));

// Corporate Owner Relations
// Links: Landlord (parent) ← Corporate Owner → Beneficial Owners (children)
export const corporateOwnerRelations = relations(corporateOwner, ({ one, many }) => ({
  // Each corporate owner belongs to one corporate landlord
  landlord: one(landlords, {
    fields: [corporateOwner.landlordId],
    references: [landlords.id]
  }),
  // Corporate owners have multiple beneficial owners (UBOs)
  beneficialOwners: many(beneficialOwner)
}));

export const tenancyContractsRelations = relations(tenancyContracts, ({ one }) => ({
  landlord: one(landlords, {
    fields: [tenancyContracts.landlordId],
    references: [landlords.id]
  }),
  tenant: one(tenant, {
    fields: [tenancyContracts.tenantId],
    references: [tenant.id]
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
// TENANCY CHECKLIST DOCUMENTS
// ==========================================

// Define all checklist item types
export const tenancyChecklistItemTypes = [
  'tenancy_agreement',
  'notices',
  'guarantors_agreement',
  'deposits_and_rent',
  'standing_order',
  'inventory',
  'deposit_protection_dps',
  'deposit_protection_tds',
  'deposit_held_by_landlord',
  'work_reference',
  'bank_reference',
  'previous_landlord_reference',
  'tenants_id',
  'authorization_to_landlord',
  'terms_and_conditions_to_landlord',
  'information_sheet_to_landlord',
  'gas_safety_certificate',
  'keys_given_to_tenant',
  'spare_keys_in_office'
] as const;

export type TenancyChecklistItemType = typeof tenancyChecklistItemTypes[number];

// Human-readable labels for checklist items
export const tenancyChecklistItemLabels: Record<TenancyChecklistItemType, string> = {
  'tenancy_agreement': 'Tenancy Agreement',
  'notices': 'Notices',
  'guarantors_agreement': 'Guarantors Agreement',
  'deposits_and_rent': 'Deposits and Rent',
  'standing_order': 'Standing Order',
  'inventory': 'Inventory',
  'deposit_protection_dps': 'Deposit Protection by DPS',
  'deposit_protection_tds': 'Deposit Protection by TDS',
  'deposit_held_by_landlord': 'Deposit Held by Landlord',
  'work_reference': 'Work Reference',
  'bank_reference': 'Bank Reference',
  'previous_landlord_reference': 'Previous Landlord Reference',
  'tenants_id': 'Tenant\'s ID',
  'authorization_to_landlord': 'Authorization to Landlord',
  'terms_and_conditions_to_landlord': 'Terms & Conditions to Landlord',
  'information_sheet_to_landlord': 'Information Sheet to Landlord',
  'gas_safety_certificate': 'Gas Safety Certificate',
  'keys_given_to_tenant': 'Keys Given to Tenant',
  'spare_keys_in_office': 'Spare Keys in Office'
};

// Metadata for checklist items (category, workflow, document requirements)
export const tenancyChecklistItemMeta: Record<TenancyChecklistItemType, {
  category: string;
  workflow: string;
  requiresDocument: boolean;
  autoCompleteOn?: string | null;
}> = {
  'tenancy_agreement': { category: 'documents', workflow: 'onboarding', requiresDocument: true },
  'notices': { category: 'documents', workflow: 'onboarding', requiresDocument: true },
  'guarantors_agreement': { category: 'documents', workflow: 'onboarding', requiresDocument: true },
  'deposits_and_rent': { category: 'financial', workflow: 'onboarding', requiresDocument: false },
  'standing_order': { category: 'financial', workflow: 'onboarding', requiresDocument: true },
  'inventory': { category: 'documents', workflow: 'onboarding', requiresDocument: true },
  'deposit_protection_dps': { category: 'compliance', workflow: 'compliance', requiresDocument: true },
  'deposit_protection_tds': { category: 'compliance', workflow: 'compliance', requiresDocument: true },
  'deposit_held_by_landlord': { category: 'compliance', workflow: 'compliance', requiresDocument: true },
  'work_reference': { category: 'references', workflow: 'onboarding', requiresDocument: true },
  'bank_reference': { category: 'references', workflow: 'onboarding', requiresDocument: true },
  'previous_landlord_reference': { category: 'references', workflow: 'onboarding', requiresDocument: true },
  'tenants_id': { category: 'identity', workflow: 'onboarding', requiresDocument: true },
  'authorization_to_landlord': { category: 'documents', workflow: 'onboarding', requiresDocument: true },
  'terms_and_conditions_to_landlord': { category: 'documents', workflow: 'onboarding', requiresDocument: true },
  'information_sheet_to_landlord': { category: 'documents', workflow: 'onboarding', requiresDocument: true },
  'gas_safety_certificate': { category: 'compliance', workflow: 'compliance', requiresDocument: true },
  'keys_given_to_tenant': { category: 'handover', workflow: 'general', requiresDocument: false },
  'spare_keys_in_office': { category: 'handover', workflow: 'general', requiresDocument: false }
};

// Individual checklist items with document support
export const tenancyChecklistItems = pgTable("tenancy_checklist_item", {
  id: serial("id").primaryKey(),
  tenancyId: integer("tenancy_id").notNull(), // References tenancyContracts.id
  itemType: text("item_type").notNull(), // One of tenancyChecklistItemTypes

  // Status
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  completedBy: integer("completed_by"), // User ID who marked it complete

  // Document upload
  documentUrl: text("document_url"),
  documentName: text("document_name"),
  documentUploadedAt: timestamp("document_uploaded_at"),
  documentUploadedBy: integer("document_uploaded_by"),

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const tenancyChecklistItemsRelations = relations(tenancyChecklistItems, ({ one }) => ({
  tenancy: one(tenancyContracts, {
    fields: [tenancyChecklistItems.tenancyId],
    references: [tenancyContracts.id]
  }),
  completedByUser: one(users, {
    fields: [tenancyChecklistItems.completedBy],
    references: [users.id]
  }),
  uploadedByUser: one(users, {
    fields: [tenancyChecklistItems.documentUploadedBy],
    references: [users.id]
  })
}));

export const insertTenancyChecklistItemSchema = createInsertSchema(tenancyChecklistItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertTenancyChecklistItem = z.infer<typeof insertTenancyChecklistItemSchema>;
export type TenancyChecklistItem = typeof tenancyChecklistItems.$inferSelect;

// ==========================================
// UK LANDLORD COMPLIANCE TRACKING
// ==========================================

// Master list of all compliance requirements
export const complianceRequirements = pgTable("compliance_requirement", {
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
  tenant: one(tenant, {
    fields: [complianceStatus.tenantId],
    references: [tenant.id]
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
export const communications = pgTable("communication", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'sms', 'email', 'phone', 'note'
  direction: text("direction").notNull(), // 'inbound', 'outbound'
  content: text("content").notNull(),
  status: text("status").notNull(), // 'sent', 'received', 'failed', 'draft'
  tenantId: integer("tenant_id").references(() => tenant.id),
  landlordId: integer("landlord_id").references(() => landlords.id),
  propertyId: integer("property_id").references(() => properties.id),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: json("metadata"), // for twilio SID etc
});

export const insertCommunicationSchema = createInsertSchema(communications);
export type Communication = typeof communications.$inferSelect;
export type InsertCommunication = typeof communications.$inferInsert;

// ==========================================
// PROPERTY MANAGEMENT DATA MODEL (V2)
// ==========================================
// This is the clean data model for property management:
// Property types for properties
// ==========================================

// Property types for all property tables
export const propertyTypes = [
  'flat',
  'house',
  'maisonette',
  'penthouse',
  'studio',
  'bungalow',
  'cottage',
  'mansion',
  'villa',
  'townhouse',
  'detached',
  'semi_detached',
  'terraced',
  'end_terrace',
  'office',
  'retail',
  'warehouse',
  'industrial',
  'mixed_use',
  'land',
  'other'
] as const;

export type PropertyType = typeof propertyTypes[number];

// ==========================================
// LEADS - Property Enquiry Tracking
// ==========================================
// Captures all enquiries from any channel: website registration, calls, emails, WhatsApp
// Tracks their interest (buy/rent), property browsing, and all communications
// ==========================================
export const leads = pgTable("lead", {
  id: serial("id").primaryKey(),

  // Basic contact details
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),

  // Social media handles (for DM communication)
  instagramHandle: text("instagram_handle"),
  facebookId: text("facebook_id"),
  tiktokHandle: text("tiktok_handle"),
  twitterHandle: text("twitter_handle"),
  linkedinUrl: text("linkedin_url"),

  // Source tracking - where did this lead come from?
  source: text("source").notNull().default("website"), // 'website', 'phone_call', 'email', 'whatsapp', 'walk_in', 'referral', 'portal', 'instagram', 'facebook', 'tiktok', 'twitter', 'linkedin'
  sourceDetail: text("source_detail"), // e.g., 'Zoopla', 'Rightmove', 'Google Ads', specific property URL, etc.
  referredBy: text("referred_by"), // Name of referrer if applicable

  // Lead type - what are they looking for?
  leadType: text("lead_type").notNull().default("rental"), // 'rental', 'purchase', 'both', 'landlord', 'seller'

  // Property preferences
  preferredPropertyType: text("preferred_property_type"), // 'flat', 'house', 'studio', etc.
  preferredBedrooms: integer("preferred_bedrooms"),
  preferredAreas: text("preferred_areas").array(), // Array of postcodes or area names
  minBudget: integer("min_budget"), // In pence
  maxBudget: integer("max_budget"), // In pence
  moveInDate: timestamp("move_in_date"), // When do they want to move?

  // Additional requirements
  requirements: text("requirements"), // Free text for specific requirements
  petsAllowed: boolean("pets_allowed"),
  parkingRequired: boolean("parking_required"),
  gardenRequired: boolean("garden_required"),

  // KYC (Know Your Customer) Verification
  kycStatus: text("kyc_status").default("not_started"), // 'not_started', 'pending', 'verified', 'failed', 'expired'
  kycVerifiedAt: timestamp("kyc_verified_at"),
  kycVerifiedBy: integer("kyc_verified_by"), // FK to users.id - staff who verified
  kycNotes: text("kyc_notes"),

  // ID Verification
  idDocumentType: text("id_document_type"), // 'passport', 'driving_licence', 'national_id'
  idDocumentUrl: text("id_document_url"), // URL to uploaded ID document
  idVerified: boolean("id_verified").default(false),
  idVerifiedAt: timestamp("id_verified_at"),

  // Proof of Address
  proofOfAddressType: text("proof_of_address_type"), // 'utility_bill', 'bank_statement', 'council_tax'
  proofOfAddressUrl: text("proof_of_address_url"),
  proofOfAddressVerified: boolean("proof_of_address_verified").default(false),
  proofOfAddressVerifiedAt: timestamp("proof_of_address_verified_at"),

  // Proof of Funds (for serious buyers/renters)
  proofOfFundsStatus: text("proof_of_funds_status").default("not_provided"), // 'not_provided', 'pending_review', 'verified', 'rejected', 'expired'
  proofOfFundsType: text("proof_of_funds_type"), // 'bank_letter', 'mortgage_offer', 'bank_statement', 'solicitor_letter', 'cash_buyer_proof'
  proofOfFundsUrl: text("proof_of_funds_url"), // URL to uploaded document
  proofOfFundsAmount: integer("proof_of_funds_amount"), // Amount in pence they can prove
  proofOfFundsVerified: boolean("proof_of_funds_verified").default(false),
  proofOfFundsVerifiedAt: timestamp("proof_of_funds_verified_at"),
  proofOfFundsVerifiedBy: integer("proof_of_funds_verified_by"), // FK to users.id
  proofOfFundsExpiryDate: timestamp("proof_of_funds_expiry_date"), // When does the proof expire?
  proofOfFundsNotes: text("proof_of_funds_notes"),

  // Mortgage Details (if applicable)
  hasMortgageAip: boolean("has_mortgage_aip").default(false), // Agreement in Principle
  mortgageBroker: text("mortgage_broker"),
  mortgageLender: text("mortgage_lender"),
  mortgageAipAmount: integer("mortgage_aip_amount"), // Amount approved in pence
  mortgageAipExpiryDate: timestamp("mortgage_aip_expiry_date"),
  mortgageAipUrl: text("mortgage_aip_url"), // URL to uploaded AIP document

  // Lead status and scoring
  status: text("status").notNull().default("new"), // 'new', 'contacted', 'qualified', 'viewing_booked', 'offer_made', 'converted', 'lost', 'archived'
  priority: text("priority").default("medium"), // 'hot', 'warm', 'medium', 'cold'
  score: integer("score").default(0), // Lead score 0-100 based on engagement
  lostReason: text("lost_reason"), // If status is 'lost', why?

  // Assignment
  assignedTo: integer("assigned_to"), // FK to users.id - which agent is handling this lead

  // Conversion tracking
  convertedAt: timestamp("converted_at"), // When did they become a tenant/buyer?
  convertedToTenantId: integer("converted_to_tenant_id"), // FK to tenant if they became a tenant
  convertedToPropertyId: integer("converted_to_property_id"), // Which property did they rent/buy?

  // Last activity tracking
  lastContactedAt: timestamp("last_contacted_at"),
  lastActivityAt: timestamp("last_activity_at"),
  nextFollowUpDate: timestamp("next_follow_up_date"),

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// ==========================================
// LEAD_PROPERTY_VIEWS - Track Property Browsing
// ==========================================
// Records every property a lead has viewed on the website
// ==========================================
export const leadPropertyViews = pgTable("lead_property_view", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(), // FK to leads
  propertyId: integer("property_id").notNull(), // FK to properties

  // View details
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
  viewDuration: integer("view_duration"), // Seconds spent on property page
  viewSource: text("view_source"), // 'website', 'email_link', 'whatsapp_link', 'portal'

  // Engagement tracking
  savedToFavorites: boolean("saved_to_favorites").default(false),
  requestedViewing: boolean("requested_viewing").default(false),
  requestedMoreInfo: boolean("requested_more_info").default(false),
  sharedProperty: boolean("shared_property").default(false),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// ==========================================
// LEAD_COMMUNICATIONS - All Interactions
// ==========================================
// Tracks ALL communications with a lead across ALL channels
// ==========================================
export const leadCommunications = pgTable("lead_communication", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(), // FK to leads

  // Communication type and channel
  channel: text("channel").notNull(), // 'phone', 'email', 'whatsapp', 'sms', 'in_person', 'portal_message', 'instagram_dm', 'facebook_messenger', 'tiktok_dm', 'twitter_dm', 'linkedin'
  direction: text("direction").notNull(), // 'inbound', 'outbound'
  type: text("type").notNull(), // 'enquiry', 'follow_up', 'viewing_request', 'viewing_confirmation', 'offer', 'negotiation', 'general'

  // Content
  subject: text("subject"), // For emails
  content: text("content").notNull(), // The message content
  summary: text("summary"), // Brief summary of call/conversation

  // Related property (if communication is about a specific property)
  propertyId: integer("property_id"), // FK to properties

  // Staff member who handled this
  handledBy: integer("handled_by"), // FK to users.id

  // External references
  externalMessageId: text("external_message_id"), // Twilio SID, email message ID, etc.

  // Attachments
  attachments: text("attachments").array(), // URLs to attached files

  // Outcome tracking
  outcome: text("outcome"), // 'successful', 'no_answer', 'voicemail', 'callback_requested', 'not_interested'
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date"),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// ==========================================
// LEAD_VIEWINGS - Scheduled Property Viewings
// ==========================================
export const leadViewings = pgTable("lead_viewing", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(), // FK to leads
  propertyId: integer("property_id").notNull(), // FK to properties

  // Viewing details
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").default(30), // Duration in minutes
  viewingType: text("viewing_type").default("in_person"), // 'in_person', 'video', 'virtual_tour'

  // Assignment
  conductedBy: integer("conducted_by"), // FK to users.id - agent conducting viewing

  // Status
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled'
  cancelledReason: text("cancelled_reason"),

  // Feedback
  feedback: text("feedback"), // Lead's feedback after viewing
  agentNotes: text("agent_notes"), // Agent's notes about the viewing
  interested: boolean("interested"), // Did they show interest?

  // Follow-up
  followUpRequired: boolean("follow_up_required").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// ==========================================
// LEAD_ACTIVITIES - Activity Timeline
// ==========================================
// Captures all activities for a lead's timeline (auto-generated)
// ==========================================
export const leadActivities = pgTable("lead_activity", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(), // FK to leads

  // Activity details
  activityType: text("activity_type").notNull(), // 'created', 'status_change', 'property_viewed', 'communication', 'viewing_booked', 'note_added', 'assigned', 'converted'
  description: text("description").notNull(),

  // Related records
  relatedPropertyId: integer("related_property_id"),
  relatedCommunicationId: integer("related_communication_id"),
  relatedViewingId: integer("related_viewing_id"),

  // Who performed the activity
  performedBy: integer("performed_by"), // FK to users.id (null if system-generated)

  // Metadata
  metadata: json("metadata"), // Additional context as JSON

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// ==========================================
// LEADS RELATIONS
// ==========================================
export const leadsRelations = relations(leads, ({ many, one }) => ({
  propertyViews: many(leadPropertyViews),
  communications: many(leadCommunications),
  viewings: many(leadViewings),
  activities: many(leadActivities),
  assignedAgent: one(users, {
    fields: [leads.assignedTo],
    references: [users.id]
  }),
  convertedTenant: one(tenant, {
    fields: [leads.convertedToTenantId],
    references: [tenant.id]
  })
}));

export const leadPropertyViewsRelations = relations(leadPropertyViews, ({ one }) => ({
  lead: one(leads, {
    fields: [leadPropertyViews.leadId],
    references: [leads.id]
  })
}));

export const leadCommunicationsRelations = relations(leadCommunications, ({ one }) => ({
  lead: one(leads, {
    fields: [leadCommunications.leadId],
    references: [leads.id]
  }),
  handler: one(users, {
    fields: [leadCommunications.handledBy],
    references: [users.id]
  })
}));

export const leadViewingsRelations = relations(leadViewings, ({ one }) => ({
  lead: one(leads, {
    fields: [leadViewings.leadId],
    references: [leads.id]
  }),
  conductor: one(users, {
    fields: [leadViewings.conductedBy],
    references: [users.id]
  })
}));

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  lead: one(leads, {
    fields: [leadActivities.leadId],
    references: [leads.id]
  }),
  performer: one(users, {
    fields: [leadActivities.performedBy],
    references: [users.id]
  })
}));

// ==========================================
// OFFERS TABLE - Links Leads to Properties/Landlords
// ==========================================
// When a lead makes an offer on a property, this creates
// a link between the lead and the property owner (landlord)
// ==========================================
export const offers = pgTable("offer", {
  id: serial("id").primaryKey(),

  // Lead making the offer
  leadId: integer("lead_id").notNull(), // FK to leads

  // Property being offered on
  propertyId: integer("property_id").notNull(), // FK to properties

  // Landlord/Owner (auto-populated from property)
  landlordId: integer("landlord_id"), // FK to landlords - the property owner

  // Offer type
  offerType: text("offer_type").notNull(), // 'rental', 'purchase'

  // Offer details
  offerAmount: integer("offer_amount").notNull(), // Amount in pence
  originalAskingPrice: integer("original_asking_price"), // Original property price
  depositOffered: integer("deposit_offered"), // Deposit amount offered (for rentals)
  moveInDate: timestamp("move_in_date"), // Proposed move-in date
  tenancyLength: integer("tenancy_length"), // Months (for rentals)

  // Conditions
  conditions: text("conditions"), // Any conditions attached to offer
  chainFree: boolean("chain_free").default(false), // Is the buyer chain-free?
  cashBuyer: boolean("cash_buyer").default(false), // Is this a cash purchase?
  mortgageApproved: boolean("mortgage_approved").default(false), // Has mortgage AIP?

  // Status tracking
  status: text("status").notNull().default("pending"), // 'pending', 'under_review', 'counter_offered', 'accepted', 'rejected', 'withdrawn', 'expired'

  // Counter offer (if landlord counters)
  counterOfferAmount: integer("counter_offer_amount"),
  counterOfferDate: timestamp("counter_offer_date"),
  counterOfferConditions: text("counter_offer_conditions"),

  // Negotiation tracking
  negotiationRound: integer("negotiation_round").default(1),
  previousOfferIds: integer("previous_offer_ids").array(), // Chain of previous offers

  // Response tracking
  respondedAt: timestamp("responded_at"),
  respondedBy: integer("responded_by"), // FK to users - who responded to offer
  responseNotes: text("response_notes"),

  // Acceptance/Rejection details
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  withdrawnAt: timestamp("withdrawn_at"),
  withdrawalReason: text("withdrawal_reason"),

  // Expiry
  expiresAt: timestamp("expires_at"), // When does offer expire?

  // Agent handling the offer
  handledBy: integer("handled_by"), // FK to users.id

  // Verification status (for serious offers)
  proofOfFundsVerified: boolean("proof_of_funds_verified").default(false),
  kycVerified: boolean("kyc_verified").default(false),

  // Notes
  internalNotes: text("internal_notes"), // Staff notes
  landlordNotes: text("landlord_notes"), // Notes from landlord

  // Conversion tracking
  convertedToAgreementId: integer("converted_to_agreement_id"), // FK to tenancies if accepted rental
  convertedToSaleId: integer("converted_to_sale_id"), // FK to sales_progressions if accepted purchase

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// ==========================================
// OFFER HISTORY - Track all offer changes
// ==========================================
export const offerHistory = pgTable("offer_history", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").notNull(), // FK to offers

  action: text("action").notNull(), // 'created', 'updated', 'counter_offered', 'accepted', 'rejected', 'withdrawn', 'expired'
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),

  // What changed
  previousAmount: integer("previous_amount"),
  newAmount: integer("new_amount"),

  // Who made the change
  performedBy: integer("performed_by"), // FK to users
  performedByType: text("performed_by_type"), // 'agent', 'landlord', 'lead', 'system'

  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow()
});

// ==========================================
// OFFERS RELATIONS
// ==========================================
export const offersRelations = relations(offers, ({ one, many }) => ({
  lead: one(leads, {
    fields: [offers.leadId],
    references: [leads.id]
  }),
  landlord: one(landlords, {
    fields: [offers.landlordId],
    references: [landlords.id]
  }),
  handler: one(users, {
    fields: [offers.handledBy],
    references: [users.id]
  }),
  history: many(offerHistory)
}));

export const offerHistoryRelations = relations(offerHistory, ({ one }) => ({
  offer: one(offers, {
    fields: [offerHistory.offerId],
    references: [offers.id]
  }),
  performer: one(users, {
    fields: [offerHistory.performedBy],
    references: [users.id]
  })
}));

// ==========================================
// LEADS INSERT SCHEMAS AND TYPES
// ==========================================

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const insertLeadPropertyViewSchema = createInsertSchema(leadPropertyViews).omit({
  id: true,
  createdAt: true
});
export type InsertLeadPropertyView = z.infer<typeof insertLeadPropertyViewSchema>;
export type LeadPropertyView = typeof leadPropertyViews.$inferSelect;

export const insertLeadCommunicationSchema = createInsertSchema(leadCommunications).omit({
  id: true,
  createdAt: true
});
export type InsertLeadCommunication = z.infer<typeof insertLeadCommunicationSchema>;
export type LeadCommunication = typeof leadCommunications.$inferSelect;

export const insertLeadViewingSchema = createInsertSchema(leadViewings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertLeadViewing = z.infer<typeof insertLeadViewingSchema>;
export type LeadViewing = typeof leadViewings.$inferSelect;

export const insertLeadActivitySchema = createInsertSchema(leadActivities).omit({
  id: true,
  createdAt: true
});
export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;
export type LeadActivity = typeof leadActivities.$inferSelect;

// ==========================================
// VOICE CALL RECORDS - Detailed Call Transcripts
// ==========================================
// Stores full transcripts and AI analysis for voice calls
// Links to existing leads table for caller identification
// ==========================================
export const voiceCallRecords = pgTable("voice_call_record", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id"), // FK to leads - null if new caller not yet saved

  // Call identification
  callSid: text("call_sid").notNull().unique(), // Twilio Call SID
  direction: text("direction").notNull(), // 'inbound', 'outbound'
  callerPhone: text("caller_phone").notNull(), // Phone number of caller
  agentPhone: text("agent_phone"), // Our phone number used

  // Call timing
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"), // Duration in seconds

  // Call status
  status: text("status").notNull().default("in_progress"), // 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'voicemail'

  // Full transcript
  transcript: text("transcript"), // Full conversation transcript
  transcriptJson: json("transcript_json"), // Structured transcript with speaker labels and timestamps

  // AI Analysis (generated after call)
  aiSummary: text("ai_summary"), // Brief summary of the call
  aiIntent: text("ai_intent"), // Detected intent: 'property_enquiry_rent', 'property_enquiry_buy', 'book_viewing', etc.
  aiSentiment: text("ai_sentiment"), // 'positive', 'neutral', 'negative'
  aiUrgency: text("ai_urgency"), // 'immediate', 'within_week', 'within_month', 'browsing'
  aiLeadScore: integer("ai_lead_score"), // AI-calculated lead score 0-100

  // Extracted information (AI-parsed from conversation)
  extractedName: text("extracted_name"),
  extractedEmail: text("extracted_email"),
  extractedBudgetMin: integer("extracted_budget_min"),
  extractedBudgetMax: integer("extracted_budget_max"),
  extractedBedrooms: integer("extracted_bedrooms"),
  extractedAreas: text("extracted_areas").array(), // ['W9', 'W10', 'NW6']
  extractedPropertyType: text("extracted_property_type"), // 'flat', 'house', etc.
  extractedMoveInDate: timestamp("extracted_move_in_date"),
  extractedRequirements: text("extracted_requirements").array(), // ['garden', 'parking', 'pet friendly']

  // Properties discussed during call
  propertiesDiscussed: integer("properties_discussed").array(), // Array of property IDs mentioned
  propertiesInterestedIn: integer("properties_interested_in").array(), // Properties they showed interest in
  propertiesRejected: integer("properties_rejected").array(), // Properties they weren't interested in

  // Actions taken during/after call
  viewingBooked: boolean("viewing_booked").default(false),
  viewingPropertyId: integer("viewing_property_id"),
  viewingScheduledAt: timestamp("viewing_scheduled_at"),

  valuationBooked: boolean("valuation_booked").default(false),
  valuationScheduledAt: timestamp("valuation_scheduled_at"),
  valuationAddress: text("valuation_address"),

  infoSentVia: text("info_sent_via"), // 'email', 'whatsapp', 'both', null
  infoSentAt: timestamp("info_sent_at"),
  propertiesSent: integer("properties_sent").array(), // Property IDs sent to caller

  maintenanceTicketCreated: boolean("maintenance_ticket_created").default(false),
  maintenanceTicketId: integer("maintenance_ticket_id"),

  // Follow-up
  followUpRequired: boolean("follow_up_required").default(false),
  followUpNotes: text("follow_up_notes"),
  followUpDate: timestamp("follow_up_date"),
  followUpAssignedTo: integer("follow_up_assigned_to"), // FK to users

  // Recording (if consent given)
  recordingUrl: text("recording_url"),
  recordingConsent: boolean("recording_consent").default(false),

  // Agent handling
  handledBy: text("handled_by").default("ai"), // 'ai' or user ID if transferred to human
  transferredToHuman: boolean("transferred_to_human").default(false),
  transferredAt: timestamp("transferred_at"),
  transferReason: text("transfer_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// ==========================================
// VOICE LEAD PROPERTY INTERESTS - Track Interest per Property
// ==========================================
// Detailed tracking of lead interest in specific properties from voice calls
// ==========================================
export const voiceLeadPropertyInterests = pgTable("voice_lead_property_interest", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(), // FK to leads
  propertyId: integer("property_id").notNull(), // FK to properties

  // How they learned about it
  firstMentionedCallId: integer("first_mentioned_call_id"), // FK to voice_call_records
  firstMentionedAt: timestamp("first_mentioned_at").notNull().defaultNow(),

  // Interest tracking
  timesMentioned: integer("times_mentioned").notNull().default(1),
  interestLevel: text("interest_level").default("medium"), // 'high', 'medium', 'low', 'rejected'
  rejectionReason: text("rejection_reason"), // Why they weren't interested

  // Information sent
  infoSentAt: timestamp("info_sent_at"),
  infoSentVia: text("info_sent_via"), // 'email', 'whatsapp', 'both'

  // Viewing
  viewingRequested: boolean("viewing_requested").default(false),
  viewingBookedAt: timestamp("viewing_booked_at"),
  viewingCompletedAt: timestamp("viewing_completed_at"),
  viewingFeedback: text("viewing_feedback"),
  viewingInterested: boolean("viewing_interested"),

  // Offer
  offerMade: boolean("offer_made").default(false),
  offerAmount: integer("offer_amount"),
  offerStatus: text("offer_status"), // 'pending', 'accepted', 'rejected', 'countered'

  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// ==========================================
// VOICE CALL RECORDS INSERT SCHEMAS AND TYPES
// ==========================================
export const insertVoiceCallRecordSchema = createInsertSchema(voiceCallRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertVoiceCallRecord = z.infer<typeof insertVoiceCallRecordSchema>;
export type VoiceCallRecord = typeof voiceCallRecords.$inferSelect;

export const insertVoiceLeadPropertyInterestSchema = createInsertSchema(voiceLeadPropertyInterests).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertVoiceLeadPropertyInterest = z.infer<typeof insertVoiceLeadPropertyInterestSchema>;
export type VoiceLeadPropertyInterest = typeof voiceLeadPropertyInterests.$inferSelect;

// ==========================================
// CMS TABLES
// ==========================================

// CMS Pages - for website content management
export const cmsPages = pgTable("cms_page", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  template: text("template").default("default"),
  status: text("status").notNull().default("draft"), // draft, published, archived
  publishedAt: timestamp("published_at"),
  authorId: integer("author_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// CMS Content Blocks - modular content sections
export const cmsContentBlocks = pgTable("cms_content_block", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull(),
  blockType: text("block_type").notNull(), // hero, text, image, gallery, cta, etc
  title: text("title"),
  content: json("content"), // JSON content based on block type
  displayOrder: integer("display_order").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  settings: json("settings"), // Block-specific settings
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// CMS Media - media library for uploads
export const cmsMedia = pgTable("cms_media", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  altText: text("alt_text"),
  caption: text("caption"),
  uploadedBy: integer("uploaded_by"),
  folder: text("folder"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const insertCmsPageSchema = createInsertSchema(cmsPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertCmsPage = z.infer<typeof insertCmsPageSchema>;
export type CmsPage = typeof cmsPages.$inferSelect;

export const insertCmsContentBlockSchema = createInsertSchema(cmsContentBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertCmsContentBlock = z.infer<typeof insertCmsContentBlockSchema>;
export type CmsContentBlock = typeof cmsContentBlocks.$inferSelect;

export const insertCmsMediaSchema = createInsertSchema(cmsMedia).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertCmsMedia = z.infer<typeof insertCmsMediaSchema>;
export type CmsMedia = typeof cmsMedia.$inferSelect;

// ==========================================
// MICROSOFT 365 EMAIL INTEGRATION TABLES
// ==========================================
// These tables support OAuth-based email integration with Microsoft Graph API
// for sending, receiving, and processing emails programmatically.
// ==========================================

// User email connections - stores OAuth tokens and mailbox configuration
export const emailConnections = pgTable("email_connection", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // FK to users

  // Microsoft identity
  provider: text("provider").notNull().default("microsoft"), // 'microsoft' (extensible for future providers)
  tenantId: text("tenant_id").notNull(), // Microsoft tenant ID
  mailboxUpn: text("mailbox_upn").notNull(), // User principal name (email address)
  microsoftUserId: text("microsoft_user_id"), // Microsoft Graph user ID

  // OAuth tokens (encrypted at rest)
  accessToken: text("access_token").notNull(), // Encrypted access token
  refreshToken: text("refresh_token").notNull(), // Encrypted refresh token
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  scopes: text("scopes").array(), // Granted scopes ['Mail.Read', 'Mail.Send', etc.]

  // Connection status
  status: text("status").notNull().default("active"), // 'active', 'expired', 'revoked', 'error'
  lastSyncAt: timestamp("last_sync_at"),
  lastError: text("last_error"),
  errorCount: integer("error_count").notNull().default(0),

  // Settings
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  syncFolders: text("sync_folders").array().default(["inbox"]), // Which folders to monitor

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Webhook subscriptions for Microsoft Graph change notifications
export const emailWebhookSubscriptions = pgTable("email_webhook_subscription", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(), // FK to email_connections
  userId: integer("user_id").notNull(), // FK to users (denormalized for quick lookup)

  // Microsoft subscription details
  subscriptionId: text("subscription_id").notNull().unique(), // Microsoft Graph subscription ID
  resource: text("resource").notNull(), // e.g., "users/{id}/messages" or "me/mailFolders('inbox')/messages"
  changeType: text("change_type").notNull(), // 'created', 'updated', 'deleted' or comma-separated list
  notificationUrl: text("notification_url").notNull(), // Webhook URL

  // Subscription lifecycle
  expiresAt: timestamp("expires_at").notNull(),
  clientState: text("client_state").notNull(), // Secret for validating notifications

  // Status tracking
  status: text("status").notNull().default("active"), // 'active', 'expired', 'deleted', 'error'
  lastNotificationAt: timestamp("last_notification_at"),
  renewalAttempts: integer("renewal_attempts").notNull().default(0),
  lastError: text("last_error"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Email processing job queue (database-backed for portability)
export const emailJobQueue = pgTable("email_job_queue", {
  id: serial("id").primaryKey(),

  // Job identification
  jobType: text("job_type").notNull(), // 'process_email', 'send_email', 'sync_folder', 'renew_subscription'
  connectionId: integer("connection_id"), // FK to email_connections (if applicable)
  userId: integer("user_id"), // FK to users (if applicable)

  // Job payload
  payload: json("payload").notNull(), // Job-specific data (messageId, recipients, etc.)

  // Job status
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed', 'dead'
  priority: integer("priority").notNull().default(0), // Higher = more urgent
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),

  // Timing
  scheduledFor: timestamp("scheduled_for").notNull().defaultNow(), // When to process
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),

  // Results
  result: json("result"), // Job output on success
  error: text("error"), // Error message on failure
  errorStack: text("error_stack"), // Full stack trace

  // Idempotency
  idempotencyKey: text("idempotency_key").unique(), // Prevent duplicate processing

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Processed emails - stores structured data extracted from emails
export const processedEmails = pgTable("processed_email", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(), // FK to email_connections
  userId: integer("user_id").notNull(), // FK to users

  // Microsoft Graph identifiers
  graphMessageId: text("graph_message_id").notNull(), // Microsoft Graph message ID
  graphConversationId: text("graph_conversation_id"), // Thread/conversation ID
  internetMessageId: text("internet_message_id"), // RFC 822 message ID

  // Email metadata
  fromAddress: text("from_address").notNull(),
  fromName: text("from_name"),
  toAddresses: text("to_addresses").array().notNull(),
  ccAddresses: text("cc_addresses").array(),
  bccAddresses: text("bcc_addresses").array(),
  subject: text("subject"),

  // Content
  bodyPreview: text("body_preview"), // Truncated preview
  bodyText: text("body_text"), // Plain text version
  bodyHtml: text("body_html"), // HTML version
  hasAttachments: boolean("has_attachments").notNull().default(false),
  attachments: json("attachments"), // [{id, name, contentType, size, contentId}]

  // Timestamps from email
  receivedAt: timestamp("received_at").notNull(),
  sentAt: timestamp("sent_at"),

  // Categorization
  importance: text("importance"), // 'low', 'normal', 'high'
  categories: text("categories").array(), // Microsoft categories
  isRead: boolean("is_read").notNull().default(false),
  isDraft: boolean("is_draft").notNull().default(false),

  // Folder info
  folderId: text("folder_id"),
  folderName: text("folder_name"),

  // AI Processing results
  aiProcessed: boolean("ai_processed").notNull().default(false),
  aiProcessedAt: timestamp("ai_processed_at"),
  aiCategory: text("ai_category"), // AI-determined category
  aiSentiment: text("ai_sentiment"), // 'positive', 'neutral', 'negative'
  aiPriority: text("ai_priority"), // 'urgent', 'high', 'normal', 'low'
  aiSummary: text("ai_summary"), // AI-generated summary
  aiExtractedEntities: json("ai_extracted_entities"), // {names, addresses, dates, amounts, etc.}
  aiSuggestedActions: json("ai_suggested_actions"), // [{action, confidence, details}]
  aiClassification: text("ai_classification"), // Business classification

  // CRM linking
  linkedConversationId: integer("linked_conversation_id"), // FK to conversations
  linkedContactId: integer("linked_contact_id"), // FK to contacts/leads
  linkedPropertyId: integer("linked_property_id"), // FK to properties
  linkedEnquiryId: integer("linked_enquiry_id"), // FK to customerEnquiries

  // Processing status
  processingStatus: text("processing_status").notNull().default("pending"), // 'pending', 'processed', 'failed', 'skipped'
  processingError: text("processing_error"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Sent emails tracking - for emails sent via Graph API
export const sentEmails = pgTable("sent_email", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(), // FK to email_connections
  userId: integer("user_id").notNull(), // FK to users

  // Microsoft Graph identifiers
  graphMessageId: text("graph_message_id"), // Populated after send
  internetMessageId: text("internet_message_id"),

  // Recipients
  toAddresses: text("to_addresses").array().notNull(),
  ccAddresses: text("cc_addresses").array(),
  bccAddresses: text("bcc_addresses").array(),
  replyTo: text("reply_to"),

  // Content
  subject: text("subject").notNull(),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  importance: text("importance").default("normal"),

  // Attachments
  hasAttachments: boolean("has_attachments").notNull().default(false),
  attachments: json("attachments"), // [{name, contentType, size, contentBytes}]

  // Send status
  status: text("status").notNull().default("draft"), // 'draft', 'queued', 'sending', 'sent', 'failed'
  sentAt: timestamp("sent_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),

  // Reply/Forward tracking
  inReplyTo: text("in_reply_to"), // Internet message ID being replied to
  referencesMessageId: integer("references_message_id"), // FK to processed_emails if replying

  // CRM linking
  linkedConversationId: integer("linked_conversation_id"),
  linkedContactId: integer("linked_contact_id"),
  linkedPropertyId: integer("linked_property_id"),
  templateUsed: text("template_used"), // Template name if used

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// ==========================================
// EMAIL INTEGRATION INSERT SCHEMAS AND TYPES
// ==========================================

export const insertEmailConnectionSchema = createInsertSchema(emailConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertEmailConnection = z.infer<typeof insertEmailConnectionSchema>;
export type EmailConnection = typeof emailConnections.$inferSelect;

export const insertEmailWebhookSubscriptionSchema = createInsertSchema(emailWebhookSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertEmailWebhookSubscription = z.infer<typeof insertEmailWebhookSubscriptionSchema>;
export type EmailWebhookSubscription = typeof emailWebhookSubscriptions.$inferSelect;

export const insertEmailJobSchema = createInsertSchema(emailJobQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertEmailJob = z.infer<typeof insertEmailJobSchema>;
export type EmailJob = typeof emailJobQueue.$inferSelect;

export const insertProcessedEmailSchema = createInsertSchema(processedEmails).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertProcessedEmail = z.infer<typeof insertProcessedEmailSchema>;
export type ProcessedEmail = typeof processedEmails.$inferSelect;

export const insertSentEmailSchema = createInsertSchema(sentEmails).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertSentEmail = z.infer<typeof insertSentEmailSchema>;
export type SentEmail = typeof sentEmails.$inferSelect;
