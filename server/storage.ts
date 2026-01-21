import {
  User, InsertUser,
  LondonArea, InsertLondonArea,
  Property, InsertProperty,
  PropertyInquiry, InsertPropertyInquiry,
  Contact, InsertContact,
  Valuation, InsertValuation,
  PropertyPortalListing, InsertPropertyPortalListing,
  MaintenanceTicket, InsertMaintenanceTicket,
  MaintenanceTicketUpdate, InsertMaintenanceTicketUpdate,
  MaintenanceCategory, InsertMaintenanceCategory,
  PortalCredentials, InsertPortalCredentials,
  Landlord, InsertLandlord,
  Tenant, InsertTenant,
  RentalAgreement, InsertRentalAgreement,
  EstateAgencyRole, InsertEstateAgencyRole,
  RolePermission, InsertRolePermission,
  StaffRoleAssignment, InsertStaffRoleAssignment,
  CalendarEvent, InsertCalendarEvent,
  Contractor, InsertContractor,
  users, londonAreas, properties, propertyInquiries, contacts, valuations,
  propertyPortalListings, maintenanceTickets, maintenanceTicketUpdates,
  maintenanceCategories, portalCredentials,
  staffProfiles, staffAttendance, staffLeave, staffPerformance, staffTraining,
  landlords, tenants, rentalAgreements,
  estateAgencyRoles, rolePermissions, staffRoleAssignments,
  calendarEvents, contractors, propertyChecklists,
  ESTATE_AGENCY_ROLE_DEFINITIONS,
  Communication, InsertCommunication,
  UnifiedContact, InsertUnifiedContact,
  CompanyDetail, InsertCompanyDetail,
  BeneficialOwner, InsertBeneficialOwner,
  KycDocument, InsertKycDocument,
  ManagedProperty, InsertManagedProperty,
  JointTenant, InsertJointTenant,
  SalesProgression, InsertSalesProgression,
  unifiedContacts, companyDetails, beneficialOwners, kycDocuments,
  contactStatusHistory, managedProperties, managedPropertyCompliance,
  jointTenants, salesProgression, communications
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, and, desc, sql } from "drizzle-orm";
import { PgSelect } from "drizzle-orm/pg-core";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods (expanded for multiple roles)
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<User[]>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  updateUserLastLogin(id: number): Promise<void>;

  // Maintenance
  getMaintenanceTicketsByProperty(propertyId: number): Promise<MaintenanceTicket[]>;

  // Communications
  getCommunications(tenantId?: number, propertyId?: number): Promise<Communication[]>;
  createCommunication(data: InsertCommunication): Promise<Communication>;

  // London Area methods
  getLondonAreas(): Promise<LondonArea[]>;
  getLondonArea(id: number): Promise<LondonArea | undefined>;

  // Property methods (expanded for CRM)
  getTenant(id: number): Promise<Tenant | undefined>;
  getUnifiedInbox(): Promise<InboxItem[]>;


  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: number, property: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: number): Promise<boolean>;
  getProperty(id: number): Promise<Property | undefined>;
  getAllProperties(): Promise<Property[]>;
  getPropertiesByListingType(listingType: string): Promise<Property[]>;
  getPropertiesByPostcode(postcode: string): Promise<Property[]>;
  getPropertiesByArea(areaId: number): Promise<Property[]>;
  getFilteredProperties(filters: any): Promise<Property[]>;

  // Property Portal Listing methods
  createPortalListing(listing: InsertPropertyPortalListing): Promise<PropertyPortalListing>;
  updatePortalListing(id: number, data: Partial<InsertPropertyPortalListing>): Promise<PropertyPortalListing | undefined>;
  getPortalListingsByProperty(propertyId: number): Promise<PropertyPortalListing[]>;
  getPortalListingsByPortal(portalName: string): Promise<PropertyPortalListing[]>;
  getActivePortalListings(): Promise<PropertyPortalListing[]>;

  // Portal Credentials methods
  createPortalCredentials(credentials: InsertPortalCredentials): Promise<PortalCredentials>;
  updatePortalCredentials(id: number, data: Partial<InsertPortalCredentials>): Promise<PortalCredentials | undefined>;
  getPortalCredentialsByName(portalName: string): Promise<PortalCredentials | undefined>;
  getAllPortalCredentials(): Promise<PortalCredentials[]>;

  // Maintenance Ticket methods
  createMaintenanceTicket(ticket: InsertMaintenanceTicket): Promise<MaintenanceTicket>;
  updateMaintenanceTicket(id: number, data: Partial<InsertMaintenanceTicket>): Promise<MaintenanceTicket | undefined>;
  getMaintenanceTicket(id: number): Promise<MaintenanceTicket | undefined>;
  getMaintenanceTicketsByProperty(propertyId: number): Promise<MaintenanceTicket[]>;
  getMaintenanceTicketsByTenant(tenantId: number): Promise<MaintenanceTicket[]>;
  getMaintenanceTicketsByAssignee(assigneeId: number): Promise<MaintenanceTicket[]>;
  getAllMaintenanceTickets(): Promise<MaintenanceTicket[]>;
  getOpenMaintenanceTickets(): Promise<MaintenanceTicket[]>;

  // Maintenance Ticket Update methods
  createTicketUpdate(update: InsertMaintenanceTicketUpdate): Promise<MaintenanceTicketUpdate>;
  getTicketUpdates(ticketId: number): Promise<MaintenanceTicketUpdate[]>;

  // Maintenance Category methods
  createMaintenanceCategory(category: InsertMaintenanceCategory): Promise<MaintenanceCategory>;
  updateMaintenanceCategory(id: number, data: Partial<InsertMaintenanceCategory>): Promise<MaintenanceCategory | undefined>;
  getMaintenanceCategories(): Promise<MaintenanceCategory[]>;
  getMaintenanceCategoryByName(name: string): Promise<MaintenanceCategory | undefined>;

  // Contractor methods
  getContractor(id: number): Promise<Contractor | undefined>;
  getAllContractors(): Promise<Contractor[]>;

  // Property Inquiry methods
  createPropertyInquiry(inquiry: InsertPropertyInquiry): Promise<PropertyInquiry>;
  getPropertyInquiry(id: number): Promise<PropertyInquiry | undefined>;
  getPropertyInquiriesByProperty(propertyId: number): Promise<PropertyInquiry[]>;

  // Contact methods
  createContact(contact: InsertContact): Promise<Contact>;
  getContact(id: number): Promise<Contact | undefined>;
  getAllContacts(): Promise<Contact[]>;
  updateContactStatus(id: number, status: string): Promise<Contact | undefined>;

  // Valuation methods
  createValuation(valuation: InsertValuation): Promise<Valuation>;
  getValuation(id: number): Promise<Valuation | undefined>;
  getValuationsByContact(contactId: number): Promise<Valuation[]>;

  // Session store
  sessionStore: session.Store;

  // Managed Properties
  getManagedProperties(): Promise<any[]>;
  getPropertiesByManagedStatus(isManaged: boolean): Promise<Property[]>;
  getPropertiesByListedStatus(isListed: boolean): Promise<Property[]>;

  // Landlord methods
  getLandlords(): Promise<Landlord[]>;
  getLandlord(id: number): Promise<Landlord | undefined>;

  // V3 Methods
  getUnifiedContacts(filters?: any): Promise<UnifiedContact[]>;
  getUnifiedContact(id: number): Promise<UnifiedContact | undefined>;
  createUnifiedContact(contact: InsertUnifiedContact): Promise<UnifiedContact>;
  updateUnifiedContact(id: number, data: Partial<InsertUnifiedContact>): Promise<UnifiedContact | undefined>;
  getCompanyDetailsByContact(contactId: number): Promise<CompanyDetail | undefined>;
  getKycDocuments(contactId?: number): Promise<KycDocument[]>;
  getManagedPropertiesV3(): Promise<ManagedProperty[]>;
  getSalesProgression(propertyId: number): Promise<SalesProgression | undefined>;
  checkUserPermission(userId: number, category: string, permission: string): Promise<boolean>;
  getUserPrimaryRole(userId: number): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Create the session store with PostgreSQL
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      },
      createTableIfMissing: true
    });
  }

  // User methods
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, id));
  }

  // London Area methods
  async getLondonAreas(): Promise<LondonArea[]> {
    return await db.select().from(londonAreas);
  }

  async getLondonArea(id: number): Promise<LondonArea | undefined> {
    const [area] = await db
      .select()
      .from(londonAreas)
      .where(eq(londonAreas.id, id));
    return area || undefined;
  }

  // Property methods
  async createProperty(insertProperty: InsertProperty): Promise<Property> {
    const [property] = await db.insert(properties).values(insertProperty).returning();
    return property;
  }

  async getProperty(id: number): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
  }

  async updateProperty(id: number, property: Partial<InsertProperty>): Promise<Property | undefined> {
    const [updated] = await db.update(properties)
      .set({ ...property, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();
    return updated;
  }

  async deleteProperty(id: number): Promise<boolean> {
    const result = await db.delete(properties).where(eq(properties.id, id));
    return true;
  }

  async getPropertiesByPostcode(postcode: string): Promise<Property[]> {
    const results = await db.select().from(properties).where(ilike(properties.postcode, `%${postcode}%`));
    return results;
  }

  async getAllProperties(): Promise<Property[]> {
    return await db.select()
      .from(properties)
      .orderBy(desc(properties.createdAt));
  }

  async getPropertiesByListingType(listingType: string): Promise<Property[]> {
    return await db.select()
      .from(properties)
      .where(eq(properties.listingType, listingType))
      .orderBy(desc(properties.createdAt));
  }

  async getPropertiesByArea(areaId: number): Promise<Property[]> {
    return await db.select()
      .from(properties)
      .where(eq(properties.areaId, areaId))
      .orderBy(desc(properties.createdAt));
  }

  async getPropertiesByManagedStatus(isManaged: boolean): Promise<Property[]> {
    return await db.select()
      .from(properties)
      .where(eq(properties.isManaged, isManaged))
      .orderBy(desc(properties.createdAt));
  }

  async getPropertiesByListedStatus(isListed: boolean): Promise<Property[]> {
    return await db.select()
      .from(properties)
      .where(eq(properties.isListed, isListed))
      .orderBy(desc(properties.createdAt));
  }

  // Property Inquiry methods
  async createPropertyInquiry(insertInquiry: InsertPropertyInquiry): Promise<PropertyInquiry> {
    const [inquiry] = await db
      .insert(propertyInquiries)
      .values(insertInquiry)
      .returning();
    return inquiry;
  }

  async getPropertyInquiry(id: number): Promise<PropertyInquiry | undefined> {
    const [inquiry] = await db
      .select()
      .from(propertyInquiries)
      .where(eq(propertyInquiries.id, id));
    return inquiry || undefined;
  }

  async getPropertyInquiriesByProperty(propertyId: number): Promise<PropertyInquiry[]> {
    return await db
      .select()
      .from(propertyInquiries)
      .where(eq(propertyInquiries.propertyId, propertyId))
      .orderBy(desc(propertyInquiries.createdAt));
  }

  // Contact methods
  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async getAllContacts(): Promise<Contact[]> {
    return await db.select()
      .from(contacts)
      .orderBy(desc(contacts.createdAt));
  }

  async updateContactStatus(id: number, status: string): Promise<Contact | undefined> {
    const [contact] = await db.update(contacts)
      .set({ status })
      .where(eq(contacts.id, id))
      .returning();
    return contact;
  }

  // Valuation methods
  async createValuation(insertValuation: InsertValuation): Promise<Valuation> {
    const [valuation] = await db.insert(valuations).values(insertValuation).returning();
    return valuation;
  }

  async getValuation(id: number): Promise<Valuation | undefined> {
    const [valuation] = await db.select().from(valuations).where(eq(valuations.id, id));
    return valuation;
  }

  async getValuationsByContact(contactId: number): Promise<Valuation[]> {
    return await db.select()
      .from(valuations)
      .where(eq(valuations.contactId, contactId))
      .orderBy(desc(valuations.createdAt));
  }

  async getFilteredProperties(filters: any): Promise<Property[]> {
    const conditions = [];

    if (filters.listingType) {
      conditions.push(eq(properties.listingType, filters.listingType));
    }

    if (filters.propertyType && Array.isArray(filters.propertyType)) {
      // For array of property types, use the first one for simplicity
      if (filters.propertyType.length > 0) {
        conditions.push(eq(properties.propertyType, filters.propertyType[0]));
      }
    }

    if (filters.bedrooms) {
      conditions.push(eq(properties.bedrooms, filters.bedrooms));
    }

    if (filters.bathrooms) {
      conditions.push(eq(properties.bathrooms, filters.bathrooms));
    }

    if (filters.postcode) {
      conditions.push(ilike(properties.postcode, `%${filters.postcode}%`));
    }

    if (conditions.length > 0) {
      return await db.select()
        .from(properties)
        .where(and(...conditions))
        .orderBy(desc(properties.id));
    } else {
      return await db.select()
        .from(properties)
        .orderBy(desc(properties.id));
    }
  }

  // Property Portal Listing methods
  async createPortalListing(listing: InsertPropertyPortalListing): Promise<PropertyPortalListing> {
    const [created] = await db.insert(propertyPortalListings).values(listing).returning();
    return created;
  }

  async updatePortalListing(id: number, data: Partial<InsertPropertyPortalListing>): Promise<PropertyPortalListing | undefined> {
    const [updated] = await db.update(propertyPortalListings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(propertyPortalListings.id, id))
      .returning();
    return updated;
  }

  async getPortalListingsByProperty(propertyId: number): Promise<PropertyPortalListing[]> {
    return await db.select()
      .from(propertyPortalListings)
      .where(eq(propertyPortalListings.propertyId, propertyId))
      .orderBy(desc(propertyPortalListings.createdAt));
  }

  async getPortalListingsByPortal(portalName: string): Promise<PropertyPortalListing[]> {
    return await db.select()
      .from(propertyPortalListings)
      .where(eq(propertyPortalListings.portalName, portalName))
      .orderBy(desc(propertyPortalListings.createdAt));
  }

  async getActivePortalListings(): Promise<PropertyPortalListing[]> {
    return await db.select()
      .from(propertyPortalListings)
      .where(eq(propertyPortalListings.status, 'active'))
      .orderBy(desc(propertyPortalListings.createdAt));
  }

  // Portal Credentials methods
  async createPortalCredentials(credentials: InsertPortalCredentials): Promise<PortalCredentials> {
    const [created] = await db.insert(portalCredentials).values(credentials).returning();
    return created;
  }

  async updatePortalCredentials(id: number, data: Partial<InsertPortalCredentials>): Promise<PortalCredentials | undefined> {
    const [updated] = await db.update(portalCredentials)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(portalCredentials.id, id))
      .returning();
    return updated;
  }

  async getPortalCredentialsByName(portalName: string): Promise<PortalCredentials | undefined> {
    const [creds] = await db.select()
      .from(portalCredentials)
      .where(eq(portalCredentials.portalName, portalName));
    return creds;
  }

  async getAllPortalCredentials(): Promise<PortalCredentials[]> {
    return await db.select().from(portalCredentials);
  }

  // Maintenance Ticket methods
  async createMaintenanceTicket(ticket: InsertMaintenanceTicket): Promise<MaintenanceTicket> {
    const [created] = await db.insert(maintenanceTickets).values(ticket).returning();
    return created;
  }

  async updateMaintenanceTicket(id: number, data: Partial<InsertMaintenanceTicket>): Promise<MaintenanceTicket | undefined> {
    const [updated] = await db.update(maintenanceTickets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(maintenanceTickets.id, id))
      .returning();
    return updated;
  }

  async getMaintenanceTicket(id: number): Promise<MaintenanceTicket | undefined> {
    const [ticket] = await db.select()
      .from(maintenanceTickets)
      .where(eq(maintenanceTickets.id, id));
    return ticket;
  }

  async getMaintenanceTicketsByProperty(propertyId: number): Promise<MaintenanceTicket[]> {
    return await db.select()
      .from(maintenanceTickets)
      .where(eq(maintenanceTickets.propertyId, propertyId))
      .orderBy(desc(maintenanceTickets.createdAt));
  }

  async getMaintenanceTicketsByTenant(tenantId: number): Promise<MaintenanceTicket[]> {
    return await db.select()
      .from(maintenanceTickets)
      .where(eq(maintenanceTickets.tenantId, tenantId))
      .orderBy(desc(maintenanceTickets.createdAt));
  }

  async getMaintenanceTicketsByAssignee(assigneeId: number): Promise<MaintenanceTicket[]> {
    return await db.select()
      .from(maintenanceTickets)
      .where(eq(maintenanceTickets.assignedToId, assigneeId))
      .orderBy(desc(maintenanceTickets.createdAt));
  }

  async getAllMaintenanceTickets(): Promise<MaintenanceTicket[]> {
    return await db.select()
      .from(maintenanceTickets)
      .orderBy(desc(maintenanceTickets.createdAt));
  }

  async getOpenMaintenanceTickets(): Promise<MaintenanceTicket[]> {
    return await db.select()
      .from(maintenanceTickets)
      .where(eq(maintenanceTickets.status, 'new'))
      .orderBy(desc(maintenanceTickets.createdAt));
  }

  // Maintenance Ticket Update methods
  async createTicketUpdate(update: InsertMaintenanceTicketUpdate): Promise<MaintenanceTicketUpdate> {
    const [created] = await db.insert(maintenanceTicketUpdates).values(update).returning();
    return created;
  }

  async getTicketUpdates(ticketId: number): Promise<MaintenanceTicketUpdate[]> {
    return await db.select()
      .from(maintenanceTicketUpdates)
      .where(eq(maintenanceTicketUpdates.ticketId, ticketId))
      .orderBy(desc(maintenanceTicketUpdates.createdAt));
  }

  // Maintenance Category methods
  async createMaintenanceCategory(category: InsertMaintenanceCategory): Promise<MaintenanceCategory> {
    const [created] = await db.insert(maintenanceCategories).values(category).returning();
    return created;
  }

  async updateMaintenanceCategory(id: number, data: Partial<InsertMaintenanceCategory>): Promise<MaintenanceCategory | undefined> {
    const [updated] = await db.update(maintenanceCategories)
      .set(data)
      .where(eq(maintenanceCategories.id, id))
      .returning();
    return updated;
  }

  async getMaintenanceCategories(): Promise<MaintenanceCategory[]> {
    return await db.select().from(maintenanceCategories);
  }

  async getMaintenanceCategoryByName(name: string): Promise<MaintenanceCategory | undefined> {
    const [category] = await db.select()
      .from(maintenanceCategories)
      .where(eq(maintenanceCategories.name, name));
    return category;
  }

  // ==========================================
  // CONTRACTOR METHODS
  // ==========================================

  async getContractor(id: number): Promise<Contractor | undefined> {
    const [contractor] = await db.select()
      .from(contractors)
      .where(eq(contractors.id, id));
    return contractor;
  }

  async getAllContractors(): Promise<Contractor[]> {
    return await db.select().from(contractors).orderBy(desc(contractors.createdAt));
  }

  // ==========================================
  // LANDLORD METHODS
  // ==========================================

  async getLandlords(): Promise<Landlord[]> {
    return await db.select().from(landlords).orderBy(desc(landlords.createdAt));
  }

  async getLandlord(id: number): Promise<Landlord | undefined> {
    const [landlord] = await db.select().from(landlords).where(eq(landlords.id, id));
    return landlord;
  }

  // ==========================================
  // STAFF MANAGEMENT METHODS
  // ==========================================

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // Staff Profile methods
  async createStaffProfile(data: any): Promise<any> {
    const [profile] = await db.insert(staffProfiles).values(data).returning();
    return profile;
  }

  async getStaffProfile(userId: number): Promise<any> {
    const [profile] = await db.select()
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, userId));
    return profile;
  }

  async updateStaffProfile(userId: number, data: any): Promise<any> {
    const [profile] = await db.update(staffProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(staffProfiles.userId, userId))
      .returning();
    return profile;
  }

  // Staff Attendance methods
  async recordStaffAttendance(data: any): Promise<any> {
    const [attendance] = await db.insert(staffAttendance).values(data).returning();
    return attendance;
  }

  async getStaffAttendance(staffId: number, days: number = 30): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await db.select()
      .from(staffAttendance)
      .where(eq(staffAttendance.staffId, staffId))
      .orderBy(desc(staffAttendance.date));
  }

  async getStaffAttendanceSummary(staffId: number, month: number, year: number): Promise<any> {
    const attendance = await db.select()
      .from(staffAttendance)
      .where(eq(staffAttendance.staffId, staffId));

    // Filter by month/year and calculate summary
    const filtered = attendance.filter(a => {
      const d = new Date(a.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    return {
      totalDays: filtered.length,
      present: filtered.filter(a => a.status === 'present').length,
      absent: filtered.filter(a => a.status === 'absent').length,
      late: filtered.filter(a => a.status === 'late').length,
      remote: filtered.filter(a => a.status === 'remote').length,
      holiday: filtered.filter(a => a.status === 'holiday').length,
      sick: filtered.filter(a => a.status === 'sick').length
    };
  }

  // Staff Leave methods
  async createStaffLeave(data: any): Promise<any> {
    const [leave] = await db.insert(staffLeave).values(data).returning();
    return leave;
  }

  async getStaffLeave(staffId: number): Promise<any[]> {
    return await db.select()
      .from(staffLeave)
      .where(eq(staffLeave.staffId, staffId))
      .orderBy(desc(staffLeave.startDate));
  }

  async updateStaffLeave(leaveId: number, data: any): Promise<any> {
    const [leave] = await db.update(staffLeave)
      .set(data)
      .where(eq(staffLeave.id, leaveId))
      .returning();
    return leave;
  }

  async getAllLeaveRequests(status: string): Promise<any[]> {
    if (status === 'all') {
      return await db.select().from(staffLeave).orderBy(desc(staffLeave.requestedAt));
    }
    return await db.select()
      .from(staffLeave)
      .where(eq(staffLeave.status, status))
      .orderBy(desc(staffLeave.requestedAt));
  }

  // Staff Performance methods
  async getStaffPerformance(staffId: number): Promise<any[]> {
    return await db.select()
      .from(staffPerformance)
      .where(eq(staffPerformance.staffId, staffId))
      .orderBy(desc(staffPerformance.periodEnd));
  }

  async createStaffPerformance(data: any): Promise<any> {
    const [performance] = await db.insert(staffPerformance).values(data).returning();
    return performance;
  }

  // Staff Training methods
  async getStaffTraining(staffId: number): Promise<any[]> {
    return await db.select()
      .from(staffTraining)
      .where(eq(staffTraining.staffId, staffId))
      .orderBy(desc(staffTraining.startDate));
  }

  async createStaffTraining(data: any): Promise<any> {
    const [training] = await db.insert(staffTraining).values(data).returning();
    return training;
  }

  // ==========================================
  // LANDLORD METHODS
  // ==========================================

  async getAllLandlords(): Promise<Landlord[]> {
    return await db.select().from(landlords).orderBy(landlords.name);
  }

  async getLandlord(id: number): Promise<Landlord | undefined> {
    const [landlord] = await db.select().from(landlords).where(eq(landlords.id, id));
    return landlord;
  }

  async createLandlord(data: InsertLandlord): Promise<Landlord> {
    const [landlord] = await db.insert(landlords).values(data).returning();
    return landlord;
  }

  async updateLandlord(id: number, data: Partial<InsertLandlord>): Promise<Landlord | undefined> {
    const [landlord] = await db.update(landlords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(landlords.id, id))
      .returning();
    return landlord;
  }

  async deleteLandlord(id: number): Promise<void> {
    await db.delete(landlords).where(eq(landlords.id, id));
  }

  // ==========================================
  // TENANT METHODS
  // ==========================================

  async getAllTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantByUserId(userId: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.userId, userId));
    return tenant;
  }

  async getTenantsByProperty(propertyId: number): Promise<Tenant[]> {
    return await db.select().from(tenants).where(eq(tenants.propertyId, propertyId));
  }

  async createTenant(data: InsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(data).returning();
    return tenant;
  }

  async updateTenant(id: number, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [tenant] = await db.update(tenants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return tenant;
  }

  async deleteTenant(id: number): Promise<void> {
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  // ==========================================
  // RENTAL AGREEMENT METHODS
  // ==========================================

  async getAllRentalAgreements(): Promise<any[]> {
    // Get all agreements with joined property and landlord data
    const agreements = await db.select().from(rentalAgreements).orderBy(desc(rentalAgreements.createdAt));

    // Join property and landlord data
    const enrichedAgreements = await Promise.all(
      agreements.map(async (agreement) => {
        const property = await this.getProperty(agreement.propertyId);
        const landlord = await this.getLandlord(agreement.landlordId);

        return {
          ...agreement,
          propertyTitle: property?.title,
          propertyAddress: property?.addressLine1,
          propertyPostcode: property?.postcode,
          landlordName: landlord?.name
        };
      })
    );

    return enrichedAgreements;
  }

  async getRentalAgreement(id: number): Promise<RentalAgreement | undefined> {
    const [agreement] = await db.select().from(rentalAgreements).where(eq(rentalAgreements.id, id));
    return agreement;
  }

  async createRentalAgreement(data: InsertRentalAgreement): Promise<RentalAgreement> {
    const [agreement] = await db.insert(rentalAgreements).values(data).returning();
    return agreement;
  }

  async updateRentalAgreement(id: number, data: Partial<InsertRentalAgreement>): Promise<RentalAgreement | undefined> {
    const [agreement] = await db.update(rentalAgreements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rentalAgreements.id, id))
      .returning();
    return agreement;
  }

  async deleteRentalAgreement(id: number): Promise<void> {
    await db.delete(rentalAgreements).where(eq(rentalAgreements.id, id));
  }

  async getRentalAgreementsByProperty(propertyId: number): Promise<RentalAgreement[]> {
    return await db.select().from(rentalAgreements).where(eq(rentalAgreements.propertyId, propertyId));
  }

  async getRentalAgreementsByLandlord(landlordId: number): Promise<RentalAgreement[]> {
    return await db.select().from(rentalAgreements).where(eq(rentalAgreements.landlordId, landlordId));
  }

  async getManagedProperties(): Promise<any[]> {
    // Get all rental agreements which define a managed property
    const agreements = await db.select().from(rentalAgreements);
    console.log(`[getManagedProperties] Found ${agreements.length} agreements.`);

    // Enrich with property, landlord, tenant, and checklist data
    const managedProperties = await Promise.all(
      agreements.map(async (agreement) => {
        const property = await this.getProperty(agreement.propertyId);
        if (!property) {
          console.log(`[getManagedProperties] Property not found for agreement ${agreement.id}, propertyId: ${agreement.propertyId}`);
        }
        const landlord = await this.getLandlord(agreement.landlordId);

        const tenant = agreement.tenantId ? await this.getTenant(agreement.tenantId) : undefined;

        // Get checklists for this property/agreement
        const checklists = await db.select()
          .from(propertyChecklists)
          .where(eq(propertyChecklists.contractId, agreement.id)); // Assuming schema fix used contractId

        const checklistTotal = checklists.length;
        const checklistComplete = checklists.filter(c => c.status === 'completed').length;

        return {
          id: property?.id,
          propertyAddress: property ? `${property.addressLine1}, ${property.postcode}` : 'Unknown Address',
          postcode: property?.postcode, // Needed for ID display
          propertyType: property?.propertyType,
          bedrooms: property?.bedrooms,

          landlordId: landlord?.id,
          landlordName: landlord?.name,
          landlordEmail: landlord?.email,
          landlordMobile: landlord?.phone,
          landlordCompanyName: landlord?.companyName,

          tenantId: tenant?.id,
          tenantUserId: tenant?.userId,
          tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : 'No Tenant', // Added Name
          tenantEmail: tenant?.email,
          tenantPhone: tenant?.phone,
          tenantMoveInDate: agreement.startDate,
          tenantMoveOutDate: agreement.endDate,
          tenantStatus: agreement.status,

          checklistTotal,
          checklistComplete,

          managementFeePercent: agreement.managementFeePercentage,
          managementFeeFixed: agreement.managementFeeFixed,
          managementPeriod: 'Monthly', // Default or derived
          managementStartDate: agreement.startDate,

          rentAmount: agreement.rentAmount,
          rentFrequency: agreement.rentFrequency,

          depositAmount: agreement.depositAmount,
          depositHeldBy: agreement.depositHeldBy
        };
      })
    );

    // Filter out any where property was deleted (null id)
    return managedProperties.filter(p => p.id);
  }

  // ==========================================
  // ESTATE AGENCY ROLES METHODS
  // ==========================================

  async getEstateAgencyRoles(): Promise<EstateAgencyRole[]> {
    return await db.select().from(estateAgencyRoles).orderBy(estateAgencyRoles.department, estateAgencyRoles.roleName);
  }

  async getEstateAgencyRoleById(id: number): Promise<EstateAgencyRole | undefined> {
    const [role] = await db.select().from(estateAgencyRoles).where(eq(estateAgencyRoles.id, id));
    return role;
  }

  async getEstateAgencyRoleByCode(roleCode: string): Promise<EstateAgencyRole | undefined> {
    const [role] = await db.select().from(estateAgencyRoles).where(eq(estateAgencyRoles.roleCode, roleCode));
    return role;
  }

  async createEstateAgencyRole(data: InsertEstateAgencyRole): Promise<EstateAgencyRole> {
    const [role] = await db.insert(estateAgencyRoles).values(data).returning();
    return role;
  }

  async updateEstateAgencyRole(id: number, data: Partial<InsertEstateAgencyRole>): Promise<EstateAgencyRole | undefined> {
    const [role] = await db.update(estateAgencyRoles)
      .set(data)
      .where(eq(estateAgencyRoles.id, id))
      .returning();
    return role;
  }

  async deleteEstateAgencyRole(id: number): Promise<void> {
    await db.delete(estateAgencyRoles).where(eq(estateAgencyRoles.id, id));
  }

  // Initialize default estate agency roles from definitions
  async initializeEstateAgencyRoles(): Promise<void> {
    for (const [roleCode, definition] of Object.entries(ESTATE_AGENCY_ROLE_DEFINITIONS)) {
      // Check if role already exists
      const existing = await this.getEstateAgencyRoleByCode(roleCode);
      if (existing) continue;

      // Create the role
      const role = await this.createEstateAgencyRole({
        roleCode,
        roleName: definition.roleName,
        description: definition.description,
        department: definition.department,
        reportsTo: definition.reportsTo,
        requiredQualifications: definition.requiredQualifications,
        compensationType: definition.compensationType
      });

      // Add default permissions
      for (const perm of definition.defaultPermissions) {
        await this.addRolePermission(role.id, perm.category, perm.permission, perm.accessLevel);
      }
    }
  }

  // ==========================================
  // ROLE PERMISSIONS METHODS
  // ==========================================

  async getRolePermissions(roleId: number): Promise<RolePermission[]> {
    return await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  }

  async addRolePermission(roleId: number, category: string, permission: string, accessLevel: string = 'read'): Promise<RolePermission> {
    const [perm] = await db.insert(rolePermissions)
      .values({ roleId, category, permission, accessLevel })
      .returning();
    return perm;
  }

  async removeRolePermission(id: number): Promise<void> {
    await db.delete(rolePermissions).where(eq(rolePermissions.id, id));
  }

  async clearRolePermissions(roleId: number): Promise<void> {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  }

  // ==========================================
  // STAFF ROLE ASSIGNMENT METHODS
  // ==========================================

  async getStaffRoleAssignments(userId: number): Promise<any[]> {
    const assignments = await db.select()
      .from(staffRoleAssignments)
      .where(and(
        eq(staffRoleAssignments.userId, userId),
        eq(staffRoleAssignments.isActive, true)
      ));

    // Enrich with role details
    const enrichedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const role = await this.getEstateAgencyRoleById(assignment.roleId);
        return {
          ...assignment,
          roleName: role?.roleName,
          roleCode: role?.roleCode,
          department: role?.department
        };
      })
    );

    return enrichedAssignments;
  }

  async assignRoleToStaff(data: {
    userId: number;
    roleId: number;
    assignedBy: number;
    isPrimaryRole?: boolean;
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
    notes?: string;
  }): Promise<StaffRoleAssignment> {
    // If this is a primary role, unset any existing primary roles
    if (data.isPrimaryRole) {
      await db.update(staffRoleAssignments)
        .set({ isPrimaryRole: false })
        .where(and(
          eq(staffRoleAssignments.userId, data.userId),
          eq(staffRoleAssignments.isActive, true)
        ));
    }

    const [assignment] = await db.insert(staffRoleAssignments)
      .values({
        userId: data.userId,
        roleId: data.roleId,
        assignedBy: data.assignedBy,
        isPrimaryRole: data.isPrimaryRole ?? true,
        effectiveFrom: data.effectiveFrom || new Date(),
        effectiveTo: data.effectiveTo || null,
        notes: data.notes
      })
      .returning();

    return assignment;
  }

  async updateRoleAssignment(assignmentId: number, data: Partial<InsertStaffRoleAssignment>): Promise<StaffRoleAssignment | undefined> {
    const [assignment] = await db.update(staffRoleAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(staffRoleAssignments.id, assignmentId))
      .returning();
    return assignment;
  }

  async deactivateRoleAssignment(assignmentId: number): Promise<void> {
    await db.update(staffRoleAssignments)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(staffRoleAssignments.id, assignmentId));
  }

  // ==========================================
  // USER PERMISSIONS METHODS
  // ==========================================

  async getUserPermissions(userId: number): Promise<RolePermission[]> {
    // Get all active role assignments for the user
    const assignments = await db.select()
      .from(staffRoleAssignments)
      .where(and(
        eq(staffRoleAssignments.userId, userId),
        eq(staffRoleAssignments.isActive, true)
      ));

    // Collect all permissions from all assigned roles
    const allPermissions: RolePermission[] = [];
    for (const assignment of assignments) {
      const rolePerms = await this.getRolePermissions(assignment.roleId);
      allPermissions.push(...rolePerms);
    }

    // Remove duplicates (keep highest access level)
    const permMap = new Map<string, RolePermission>();
    const accessOrder = { 'read': 1, 'write': 2, 'full': 3 };

    for (const perm of allPermissions) {
      const key = `${perm.category}:${perm.permission}`;
      const existing = permMap.get(key);
      if (!existing || (accessOrder[perm.accessLevel as keyof typeof accessOrder] || 0) > (accessOrder[existing.accessLevel as keyof typeof accessOrder] || 0)) {
        permMap.set(key, perm);
      }
    }

    return Array.from(permMap.values());
  }

  async checkUserPermission(userId: number, category: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);

    // Check for exact permission match or full_access in category
    return permissions.some(p =>
      p.category === category && (p.permission === permission || p.permission === 'full_access')
    );
  }

  async getUserPrimaryRole(userId: number): Promise<EstateAgencyRole | null> {
    const [assignment] = await db.select()
      .from(staffRoleAssignments)
      .where(and(
        eq(staffRoleAssignments.userId, userId),
        eq(staffRoleAssignments.isActive, true),
        eq(staffRoleAssignments.isPrimaryRole, true)
      ));

    if (!assignment) return null;

    const role = await this.getEstateAgencyRoleById(assignment.roleId);
    return role || null;
  }

  // ==========================================
  // CALENDAR EVENT METHODS
  // ==========================================

  async getAllCalendarEvents(): Promise<CalendarEvent[]> {
    return await db.select().from(calendarEvents).orderBy(desc(calendarEvents.startTime));
  }

  async getCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
    const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
    return event;
  }

  async getCalendarEventsByProperty(propertyId: number): Promise<CalendarEvent[]> {
    return await db.select()
      .from(calendarEvents)
      .where(eq(calendarEvents.propertyId, propertyId))
      .orderBy(desc(calendarEvents.startTime));
  }

  async getCalendarEventsByOrganizer(organizerId: number): Promise<CalendarEvent[]> {
    return await db.select()
      .from(calendarEvents)
      .where(eq(calendarEvents.organizerId, organizerId))
      .orderBy(desc(calendarEvents.startTime));
  }

  async getCalendarEventsByType(eventType: string): Promise<CalendarEvent[]> {
    return await db.select()
      .from(calendarEvents)
      .where(eq(calendarEvents.eventType, eventType))
      .orderBy(desc(calendarEvents.startTime));
  }

  async getUpcomingViewings(): Promise<CalendarEvent[]> {
    return await db.select()
      .from(calendarEvents)
      .where(and(
        eq(calendarEvents.eventType, 'viewing'),
        eq(calendarEvents.status, 'scheduled')
      ))
      .orderBy(calendarEvents.startTime);
  }

  async createCalendarEvent(data: InsertCalendarEvent): Promise<CalendarEvent> {
    const [event] = await db.insert(calendarEvents).values(data).returning();
    return event;
  }

  async updateCalendarEvent(id: number, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const [event] = await db.update(calendarEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning();
    return event;
  }

  async deleteCalendarEvent(id: number): Promise<void> {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  }

  async cancelCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
    const [event] = await db.update(calendarEvents)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning();
    return event;
  }

  // ==========================================
  // MAINTENANCE METHODS
  // ==========================================

  async getMaintenanceTicketsByProperty(propertyId: number): Promise<MaintenanceTicket[]> {
    return await db.select()
      .from(maintenanceTickets)
      .where(eq(maintenanceTickets.propertyId, propertyId))
      .orderBy(desc(maintenanceTickets.createdAt));
  }

  // ==========================================
  // COMMUNICATION METHODS
  // ==========================================

  async getCommunications(tenantId?: number, propertyId?: number): Promise<Communication[]> {
    const conditions = [];
    if (tenantId) conditions.push(eq(communications.tenantId, tenantId));
    if (propertyId) conditions.push(eq(communications.propertyId, propertyId));

    // If no filters, return empty or all? Safety: return empty if no args
    if (conditions.length === 0) return [];

    return await db.select()
      .from(communications)
      .where(and(...conditions))
      .orderBy(desc(communications.createdAt));
  }

  async createCommunication(data: InsertCommunication): Promise<Communication> {
    const [comm] = await db.insert(communications).values(data).returning();
    return comm;
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getUnifiedInbox(): Promise<InboxItem[]> {
    // 1. Fetch Tenant Communications
    const tenantComms = await db.select({
      id: communications.id,
      content: communications.content,
      createdAt: communications.createdAt,
      type: communications.type,
      direction: communications.direction,
      tenantId: communications.tenantId,
      tenantName: sql<string>`users.full_name`, // Join with users to get name? Or just use ID?
      // We need to join to get details.
    })
      .from(communications)
      .leftJoin(tenants, eq(communications.tenantId, tenants.id))
      .leftJoin(users, eq(tenants.userId, users.id));

    // Actually, simple normalization first.
    // Fetch generic lists then map.

    const commsList = await db.select({
      id: communications.id,
      content: communications.content,
      createdAt: communications.createdAt,
      type: communications.type,
      direction: communications.direction,
      tenantId: communications.tenantId,
      firstName: tenants.firstName,
      lastName: tenants.lastName,
      email: tenants.email,
      phone: tenants.phone
    })
      .from(communications)
      .leftJoin(tenants, eq(communications.tenantId, tenants.id));

    const inquiriesList = await db.select().from(propertyInquiries);
    const contactsList = await db.select().from(contacts);

    const inboxItems: InboxItem[] = [];

    // Map Tenant Comms
    commsList.forEach(c => {
      inboxItems.push({
        id: `comm_${c.id}`,
        source: 'tenant_communication',
        contactName: `${c.firstName} ${c.lastName}`.trim() || 'Unknown Tenant',
        contactEmail: c.email || '',
        contactPhone: c.phone || '',
        message: c.content,
        timestamp: c.createdAt,
        type: c.type || 'message',
        status: 'read', // Default
        originalId: c.id
      });
    });

    // Map Inquiries
    inquiriesList.forEach(i => {
      inboxItems.push({
        id: `inq_${i.id}`,
        source: 'property_inquiry',
        contactName: i.fullName,
        contactEmail: i.email,
        contactPhone: i.phone,
        message: i.message || 'No message content',
        timestamp: i.createdAt,
        type: 'email', // Inquiries usually come via form/email
        status: i.status,
        originalId: i.id
      });
    });

    // Map Contacts
    contactsList.forEach(c => {
      inboxItems.push({
        id: `cont_${c.id}`,
        source: 'general_inquiry',
        contactName: c.fullName,
        contactEmail: c.email,
        contactPhone: c.phone,
        message: c.message || 'No message content',
        timestamp: c.createdAt,
        type: 'email',
        status: c.status,
        originalId: c.id
      });
    });

    // Sort by timestamp desc
    return inboxItems.sort((a, b) => {
      const tA = new Date(a.timestamp || 0).getTime();
      const tB = new Date(b.timestamp || 0).getTime();
      return tB - tA;
    });
  }

  // ==========================================
  // LANDLORD METHODS
  // ==========================================

  async getLandlords(): Promise<Landlord[]> {
    return await db.select().from(landlords).orderBy(desc(landlords.createdAt));
  }

  async getLandlord(id: number): Promise<Landlord | undefined> {
    const [landlord] = await db.select().from(landlords).where(eq(landlords.id, id));
    return landlord;
  }

  // ==========================================
  // V3 UNIFIED CONTACTS METHODS
  // ==========================================

  async getUnifiedContacts(filters?: any): Promise<UnifiedContact[]> {
    const conditions = [];
    if (filters?.contactType) {
      conditions.push(eq(unifiedContacts.contactType, filters.contactType));
    }
    if (filters?.status) {
      conditions.push(eq(unifiedContacts.status, filters.status));
    }

    if (conditions.length > 0) {
      return await db.select().from(unifiedContacts).where(and(...conditions)).orderBy(desc(unifiedContacts.createdAt));
    }
    return await db.select().from(unifiedContacts).orderBy(desc(unifiedContacts.createdAt));
  }

  async getUnifiedContact(id: number): Promise<UnifiedContact | undefined> {
    const [contact] = await db.select().from(unifiedContacts).where(eq(unifiedContacts.id, id));
    return contact;
  }

  async createUnifiedContact(contact: InsertUnifiedContact): Promise<UnifiedContact> {
    const [created] = await db.insert(unifiedContacts).values(contact).returning();
    return created;
  }

  async updateUnifiedContact(id: number, data: Partial<InsertUnifiedContact>): Promise<UnifiedContact | undefined> {
    const [updated] = await db.update(unifiedContacts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(unifiedContacts.id, id))
      .returning();
    return updated;
  }

  async getCompanyDetailsByContact(contactId: number): Promise<CompanyDetail | undefined> {
    const [details] = await db.select().from(companyDetails).where(eq(companyDetails.contactId, contactId));
    return details;
  }

  async getKycDocuments(contactId?: number): Promise<KycDocument[]> {
    if (contactId) {
      return await db.select().from(kycDocuments).where(eq(kycDocuments.contactId, contactId));
    }
    return await db.select().from(kycDocuments);
  }

  async getManagedPropertiesV3(): Promise<ManagedProperty[]> {
    return await db.select().from(managedProperties).orderBy(desc(managedProperties.createdAt));
  }

  async getSalesProgression(propertyId: number): Promise<SalesProgression | undefined> {
    const [progression] = await db.select().from(salesProgression).where(eq(salesProgression.propertyId, propertyId));
    return progression;
  }

  async createSalesProgression(data: InsertSalesProgression): Promise<SalesProgression> {
    const [progression] = await db.insert(salesProgression).values(data).returning();
    return progression;
  }
}

// Helper Interface
export interface InboxItem {
  id: string;
  source: 'tenant_communication' | 'property_inquiry' | 'general_inquiry';
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  message: string;
  timestamp: Date | null;
  type: string;
  status: string;
  originalId: number;
}


export const storage = new DatabaseStorage();