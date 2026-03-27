import { db } from './db';
import { 
  maintenanceRequests,
  workOrders,
  contractors,
  propertyCertifications,
  certificationReminders,
  inspectionReports,
  properties,
  users,
  communicationTemplates
} from '@shared/schema';
import { eq, and, gte, lte, desc, lt, or } from 'drizzle-orm';
import { sendPropertyOfferSMS } from './smsService';
import { sendPropertyOfferWhatsApp } from './whatsappService';
import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';

const openai = openaiClient;

export class PropertyManagementService {
  
  // Process new maintenance request with AI triage
  async processMaintenanceRequest(requestData: any) {
    try {
      // AI categorization and priority assessment
      const aiAssessment = await this.assessMaintenanceWithAI(requestData);
      
      // Create maintenance request
      const [request] = await db.insert(maintenanceRequests).values({
        ...requestData,
        aiCategory: aiAssessment.category,
        aiPriority: aiAssessment.priority,
        aiSuggestedContractor: aiAssessment.suggestedContractorType,
        priority: aiAssessment.priority,
        status: 'reported'
      }).returning();
      
      // For emergency issues, trigger immediate response
      if (aiAssessment.priority === 'emergency') {
        await this.handleEmergencyMaintenance(request);
      } else {
        // Auto-assign contractor based on AI recommendation
        await this.autoAssignContractor(request, aiAssessment);
      }
      
      // Send notifications
      await this.notifyMaintenanceParties(request, 'new_request');
      
      // Create work order
      const workOrder = await this.createWorkOrder(request);
      
      return { request, workOrder, aiAssessment };
    } catch (error) {
      console.error('Error processing maintenance request:', error);
      throw error;
    }
  }
  
  // AI-powered maintenance assessment
  private async assessMaintenanceWithAI(requestData: any) {
    try {
      const prompt = `
        Analyze this maintenance request and provide categorization:
        
        Title: ${requestData.title}
        Description: ${requestData.description}
        Location: ${requestData.location || 'Not specified'}
        Tenant urgency: ${requestData.tenantUrgency || 'Normal'}
        
        Provide JSON response with:
        {
          "category": "plumbing|electrical|heating|appliance|structural|pest|cleaning|other",
          "priority": "emergency|high|medium|low",
          "suggestedContractorType": "plumber|electrician|hvac|general|specialist",
          "estimatedDuration": "hours (number)",
          "estimatedCost": "pounds (number)",
          "requiresSpecialist": boolean,
          "safetyRisk": boolean,
          "legalCompliance": boolean,
          "reasoning": "explanation of assessment"
        }
        
        Emergency = safety risk, no water/heat/power, security breach
        High = significant discomfort, spreading damage risk
        Medium = standard repairs, some inconvenience
        Low = cosmetic, minor issues
      `;
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error in AI assessment:', error);
      // Fallback categorization
      return {
        category: 'other',
        priority: 'medium',
        suggestedContractorType: 'general',
        estimatedDuration: 4,
        estimatedCost: 150,
        requiresSpecialist: false,
        safetyRisk: false,
        legalCompliance: false,
        reasoning: 'Manual assessment required'
      };
    }
  }
  
  // Handle emergency maintenance
  private async handleEmergencyMaintenance(request: any) {
    // Find emergency contractors
    const emergencyContractors = await db.select()
      .from(contractors)
      .where(and(
        eq(contractors.availableEmergency, true),
        eq(contractors.isActive, true)
      ));
    
    // Send emergency alerts to all available contractors
    for (const contractor of emergencyContractors) {
      await this.sendEmergencyAlert(contractor, request);
    }
    
    // Notify property manager immediately
    await this.notifyEmergencyToManagement(request);
  }
  
  // Auto-assign contractor based on AI recommendation
  private async autoAssignContractor(request: any, aiAssessment: any) {
    try {
      // Find suitable contractors
      const suitableContractors = await db.select()
        .from(contractors)
        .where(and(
          eq(contractors.isActive, true),
          // Match specialization
          sql`${contractors.specializations} @> ARRAY[${aiAssessment.suggestedContractorType}]`
        ))
        .orderBy(desc(contractors.rating), desc(contractors.preferredContractor));
      
      if (suitableContractors.length > 0) {
        const selectedContractor = suitableContractors[0];
        
        // Update maintenance request
        await db.update(maintenanceRequests)
          .set({
            assignedContractorId: selectedContractor.id,
            assignedAt: new Date(),
            status: 'assigned'
          })
          .where(eq(maintenanceRequests.id, request.id));
        
        // Notify contractor
        await this.notifyContractorAssignment(selectedContractor, request);
      }
    } catch (error) {
      console.error('Error auto-assigning contractor:', error);
    }
  }
  
  // Create work order
  private async createWorkOrder(request: any) {
    const workOrderNumber = `WO-${Date.now()}-${request.id}`;
    
    const [workOrder] = await db.insert(workOrders).values({
      maintenanceRequestId: request.id,
      contractorId: request.assignedContractorId || 0,
      workOrderNumber,
      scope: request.description,
      scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000), // Default next day
      status: 'scheduled'
    }).returning();
    
    return workOrder;
  }
  
  // Check and manage property certifications
  async checkCertificationExpiry() {
    try {
      const today = new Date();
      const sixtyDaysFromNow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      // Find certifications needing reminders
      const expiringCertifications = await db.select()
        .from(propertyCertifications)
        .where(and(
          eq(propertyCertifications.status, 'valid'),
          lte(propertyCertifications.expiryDate, sixtyDaysFromNow)
        ));
      
      for (const cert of expiringCertifications) {
        const daysUntilExpiry = Math.floor((cert.expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        
        // First reminder (60 days)
        if (daysUntilExpiry <= 60 && daysUntilExpiry > 30 && !cert.firstReminderSent) {
          await this.sendCertificationReminder(cert, 'first', 60);
          await db.update(propertyCertifications)
            .set({ firstReminderSent: true })
            .where(eq(propertyCertifications.id, cert.id));
        }
        
        // Second reminder (30 days)
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 7 && !cert.secondReminderSent) {
          await this.sendCertificationReminder(cert, 'second', 30);
          await db.update(propertyCertifications)
            .set({ 
              secondReminderSent: true,
              status: 'expiring_soon'
            })
            .where(eq(propertyCertifications.id, cert.id));
        }
        
        // Final reminder (7 days)
        if (daysUntilExpiry <= 7 && daysUntilExpiry > 0 && !cert.finalReminderSent) {
          await this.sendCertificationReminder(cert, 'final', 7);
          await db.update(propertyCertifications)
            .set({ finalReminderSent: true })
            .where(eq(propertyCertifications.id, cert.id));
        }
        
        // Expired notice
        if (daysUntilExpiry <= 0 && !cert.expiryNoticeSent) {
          await this.sendCertificationReminder(cert, 'expired', 0);
          await db.update(propertyCertifications)
            .set({ 
              expiryNoticeSent: true,
              status: 'expired'
            })
            .where(eq(propertyCertifications.id, cert.id));
        }
      }
    } catch (error) {
      console.error('Error checking certification expiry:', error);
    }
  }
  
  // Send certification reminder
  private async sendCertificationReminder(cert: any, reminderType: string, daysBeforeExpiry: number) {
    try {
      // Get property details
      const [property] = await db.select()
        .from(properties)
        .where(eq(properties.id, cert.propertyId));
      
      if (!property) return;
      
      // Create reminder record
      const [reminder] = await db.insert(certificationReminders).values({
        certificationId: cert.id,
        propertyId: cert.propertyId,
        reminderType,
        daysBeforeExpiry,
        scheduledDate: new Date(),
        status: 'pending'
      }).returning();
      
      // Get landlord and agent details (would need to be fetched from property relationships)
      // For now, using placeholder
      const recipients = {
        landlord: { email: 'landlord@example.com', phone: '07700900000', name: 'Landlord' },
        agent: { email: 'agent@johnbarclay.co.uk', phone: '07700900001', name: 'Agent' },
        tenant: { email: 'tenant@example.com', phone: '07700900002', name: 'Tenant' }
      };
      
      const certTypeName = this.getCertificationTypeName(cert.certificationType);
      const propertyAddress = `${property.addressLine1}, ${property.postcode}`;
      
      let subject, message;
      
      switch (reminderType) {
        case 'first':
          subject = `${certTypeName} Certificate Expiring in 60 Days`;
          message = `The ${certTypeName} certificate for ${propertyAddress} expires on ${cert.expiryDate.toLocaleDateString()}. Please arrange renewal.`;
          break;
        case 'second':
          subject = `URGENT: ${certTypeName} Certificate Expiring in 30 Days`;
          message = `URGENT: The ${certTypeName} certificate for ${propertyAddress} expires in 30 days. Immediate action required to maintain compliance.`;
          break;
        case 'final':
          subject = `CRITICAL: ${certTypeName} Certificate Expiring in 7 Days`;
          message = `CRITICAL: Only 7 days until ${certTypeName} certificate expires for ${propertyAddress}. Book inspection immediately to avoid legal non-compliance.`;
          break;
        case 'expired':
          subject = `EXPIRED: ${certTypeName} Certificate Has Expired`;
          message = `The ${certTypeName} certificate for ${propertyAddress} has EXPIRED. The property is now non-compliant. Urgent action required.`;
          break;
      }
      
      // Send to all parties
      await this.sendMultiChannelNotification({
        email: recipients.landlord.email,
        phone: recipients.landlord.phone,
        subject,
        message,
        priority: reminderType === 'expired' ? 'critical' : 'high'
      });
      
      await this.sendMultiChannelNotification({
        email: recipients.agent.email,
        phone: recipients.agent.phone,
        subject,
        message,
        priority: reminderType === 'expired' ? 'critical' : 'high'
      });
      
      // Mark reminder as sent
      await db.update(certificationReminders)
        .set({ status: 'sent', sentAt: new Date() })
        .where(eq(certificationReminders.id, reminder.id));
      
    } catch (error) {
      console.error('Error sending certification reminder:', error);
    }
  }
  
  // Add new certification
  async addCertification(certData: any) {
    try {
      const [cert] = await db.insert(propertyCertifications).values({
        ...certData,
        status: 'valid',
        firstReminderSent: false,
        secondReminderSent: false,
        finalReminderSent: false,
        expiryNoticeSent: false
      }).returning();
      
      // Schedule reminders
      await this.scheduleCertificationReminders(cert);
      
      // Send confirmation to all parties
      await this.notifyCertificationUploaded(cert);
      
      return cert;
    } catch (error) {
      console.error('Error adding certification:', error);
      throw error;
    }
  }
  
  // Schedule future certification reminders
  private async scheduleCertificationReminders(cert: any) {
    const expiryDate = new Date(cert.expiryDate);
    const reminders = [
      { type: 'first', days: 60 },
      { type: 'second', days: 30 },
      { type: 'final', days: 7 },
      { type: 'expired', days: 0 }
    ];
    
    for (const reminder of reminders) {
      const scheduledDate = new Date(expiryDate);
      scheduledDate.setDate(scheduledDate.getDate() - reminder.days);
      
      await db.insert(certificationReminders).values({
        certificationId: cert.id,
        propertyId: cert.propertyId,
        reminderType: reminder.type,
        daysBeforeExpiry: reminder.days,
        scheduledDate,
        status: 'pending'
      });
    }
  }
  
  // Create inspection report
  async createInspectionReport(reportData: any) {
    try {
      // Create the inspection report
      const [report] = await db.insert(inspectionReports).values(reportData).returning();
      
      // If issues found, create maintenance requests
      if (reportData.issuesFound && reportData.issuesFound.length > 0) {
        for (const issue of reportData.issuesFound) {
          if (issue.severity === 'high' || issue.type === 'safety') {
            // Auto-create maintenance request for high priority issues
            await this.processMaintenanceRequest({
              propertyId: reportData.propertyId,
              tenantId: 0, // System-generated
              issueType: issue.type,
              priority: issue.severity === 'high' ? 'high' : 'medium',
              title: `Inspection Issue: ${issue.description}`,
              description: `Issue found during inspection: ${issue.description}\nRecommended action: ${issue.action}`,
              location: issue.location || 'Multiple'
            });
          }
        }
      }
      
      // Send inspection report to relevant parties
      await this.distributeInspectionReport(report);
      
      return report;
    } catch (error) {
      console.error('Error creating inspection report:', error);
      throw error;
    }
  }
  
  // Helper methods
  private getCertificationTypeName(type: string): string {
    const types: { [key: string]: string } = {
      'gas_safety': 'Gas Safety',
      'electrical_safety': 'Electrical Safety',
      'epc': 'Energy Performance',
      'eicr': 'Electrical Installation Condition',
      'fire_safety': 'Fire Safety',
      'legionella': 'Legionella Risk',
      'asbestos': 'Asbestos Survey',
      'hmo_license': 'HMO License',
      'selective_license': 'Selective License'
    };
    return types[type] || type;
  }
  
  private async sendMultiChannelNotification(data: any) {
    // Send email
    console.log('Sending email:', data);
    
    // Send SMS for high priority
    if (data.priority === 'critical' || data.priority === 'high') {
      await sendPropertyOfferSMS(data.phone, data.message);
    }
    
    // Send WhatsApp
    if (data.priority === 'critical') {
      await sendPropertyOfferWhatsApp({
        recipientPhone: data.phone,
        message: data.message
      });
    }
  }
  
  private async notifyMaintenanceParties(request: any, type: string) {
    // Implementation for maintenance notifications
    console.log(`Notifying parties about maintenance: ${type}`, request);
  }
  
  private async sendEmergencyAlert(contractor: any, request: any) {
    const message = `EMERGENCY MAINTENANCE: ${request.title} at property ${request.propertyId}. ${request.description}`;
    
    // Send SMS
    if (contractor.emergencyPhone) {
      await sendPropertyOfferSMS(contractor.emergencyPhone, message);
    }
    
    // Send WhatsApp
    await sendPropertyOfferWhatsApp({
      recipientPhone: contractor.phone,
      message
    });
    
    console.log(`Emergency alert sent to ${contractor.companyName}`);
  }
  
  private async notifyEmergencyToManagement(request: any) {
    console.log('Notifying management of emergency:', request);
  }
  
  private async notifyContractorAssignment(contractor: any, request: any) {
    const message = `New maintenance job assigned: ${request.title}. Please confirm availability.`;
    
    // Send email
    console.log(`Emailing contractor ${contractor.email}:`, message);
    
    // Send SMS
    await sendPropertyOfferSMS(contractor.phone, message);
  }
  
  private async notifyCertificationUploaded(cert: any) {
    console.log('Notifying certification upload:', cert);
  }
  
  private async distributeInspectionReport(report: any) {
    console.log('Distributing inspection report:', report);
  }
}

// SQL helper for array contains
const sql = {
  raw: (query: string) => query
};

export const propertyManagement = new PropertyManagementService();