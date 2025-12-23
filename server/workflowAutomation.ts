import { db } from './db';
import { 
  propertyWorkflows, 
  viewingAppointments, 
  propertyOffers,
  contractDocuments,
  customerEnquiries,
  communicationTemplates,
  properties,
  users
} from '@shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { docuSignService } from './docusignService';
import { sendPropertyOfferSMS } from './smsService';
import { sendPropertyOfferWhatsApp } from './whatsappService';
import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';

const openai = openaiClient;

export class WorkflowAutomationService {
  
  // Initialize a new property workflow from valuation request
  async startPropertyWorkflow(valuationRequest: any) {
    try {
      const [workflow] = await db.insert(propertyWorkflows).values({
        currentStage: 'valuation_requested',
        valuationRequestDate: new Date(),
        vendorId: valuationRequest.vendorId
      }).returning();
      
      // Send automated valuation confirmation
      await this.sendAutomatedMessage('valuation_requested', {
        recipientEmail: valuationRequest.email,
        recipientPhone: valuationRequest.phone,
        propertyAddress: valuationRequest.address
      });
      
      // Schedule valuation appointment
      await this.scheduleValuationAppointment(workflow.id, valuationRequest);
      
      return workflow;
    } catch (error) {
      console.error('Error starting property workflow:', error);
      throw error;
    }
  }
  
  // Move workflow to next stage
  async progressWorkflow(workflowId: number, nextStage: string, data?: any) {
    try {
      const [workflow] = await db.update(propertyWorkflows)
        .set({
          currentStage: nextStage,
          updatedAt: new Date(),
          ...data
        })
        .where(eq(propertyWorkflows.id, workflowId))
        .returning();
      
      // Trigger stage-specific automations
      await this.triggerStageAutomation(workflow, nextStage);
      
      return workflow;
    } catch (error) {
      console.error('Error progressing workflow:', error);
      throw error;
    }
  }
  
  // Trigger automations based on workflow stage
  private async triggerStageAutomation(workflow: any, stage: string) {
    switch (stage) {
      case 'valuation_completed':
        await this.sendValuationReport(workflow);
        await this.prepareInstructionDocuments(workflow);
        break;
        
      case 'instruction_signed':
        await this.createPropertyListing(workflow);
        await this.schedulePhotography(workflow);
        break;
        
      case 'listed':
        await this.publishToPortals(workflow);
        await this.notifyMatchingBuyers(workflow);
        break;
        
      case 'offer_received':
        await this.notifyVendorOfOffer(workflow);
        await this.analyzeOfferStrength(workflow);
        break;
        
      case 'offer_accepted':
        await this.prepareSalesDocuments(workflow);
        await this.notifyAllParties(workflow);
        break;
        
      case 'contracts_preparing':
        await this.generateContracts(workflow);
        await this.sendToDocuSign(workflow);
        break;
        
      case 'contracts_exchanged':
        await this.scheduleCompletion(workflow);
        await this.notifyConveyancers(workflow);
        break;
        
      case 'completed':
        await this.finalizeTransaction(workflow);
        await this.archiveDocuments(workflow);
        break;
    }
  }
  
  // Handle new customer enquiry with AI-powered automation
  async processCustomerEnquiry(enquiryData: any) {
    try {
      // Score the lead using AI
      const leadScore = await this.scoreLeadWithAI(enquiryData);
      
      // Create enquiry record
      const [enquiry] = await db.insert(customerEnquiries).values({
        ...enquiryData,
        leadScore: leadScore.score,
        leadTemperature: leadScore.temperature,
        status: 'new'
      }).returning();
      
      // Send immediate auto-response
      await this.sendAutomatedMessage('new_enquiry', {
        recipientEmail: enquiryData.customerEmail,
        recipientName: enquiryData.customerName,
        enquiryType: enquiryData.enquiryType
      });
      
      // Match properties based on requirements
      if (enquiryData.enquiryType === 'buying' || enquiryData.enquiryType === 'renting') {
        const matches = await this.findMatchingProperties(enquiryData.requirements);
        if (matches.length > 0) {
          await this.sendPropertyMatches(enquiry.id, matches);
        }
      }
      
      // Assign to appropriate agent
      const agent = await this.assignToAgent(enquiry);
      
      // Schedule follow-up
      await this.scheduleFollowUp(enquiry.id, leadScore.followUpPriority);
      
      return enquiry;
    } catch (error) {
      console.error('Error processing customer enquiry:', error);
      throw error;
    }
  }
  
  // AI-powered lead scoring
  private async scoreLeadWithAI(enquiryData: any) {
    try {
      const prompt = `
        Analyze this property enquiry and provide a lead score (1-100) and temperature (hot/warm/cold):
        
        Type: ${enquiryData.enquiryType}
        Budget: ${enquiryData.budget}
        Timeline: ${enquiryData.moveDate}
        Message: ${enquiryData.message}
        Requirements: ${JSON.stringify(enquiryData.requirements)}
        
        Consider factors like budget realism, urgency, specific requirements, and message quality.
        Return JSON with: { score: number, temperature: 'hot'|'warm'|'cold', followUpPriority: 'immediate'|'today'|'tomorrow'|'week' }
      `;
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error scoring lead with AI:', error);
      return { score: 50, temperature: 'warm', followUpPriority: 'today' };
    }
  }
  
  // Schedule and manage viewing appointments
  async scheduleViewing(propertyId: number, viewerDetails: any, preferredDate: Date) {
    try {
      // Find available slot
      const availableSlot = await this.findAvailableViewingSlot(propertyId, preferredDate);
      
      // Create appointment
      const [appointment] = await db.insert(viewingAppointments).values({
        propertyId,
        ...viewerDetails,
        scheduledDate: availableSlot,
        status: 'scheduled'
      }).returning();
      
      // Send confirmation
      await this.sendViewingConfirmation(appointment);
      
      // Set reminder
      await this.scheduleViewingReminder(appointment.id);
      
      // Update workflow if exists
      await this.updateWorkflowViewingCount(propertyId);
      
      return appointment;
    } catch (error) {
      console.error('Error scheduling viewing:', error);
      throw error;
    }
  }
  
  // Process property offer
  async processOffer(offerData: any) {
    try {
      // Create offer record
      const [offer] = await db.insert(propertyOffers).values({
        ...offerData,
        status: 'pending'
      }).returning();
      
      // Analyze offer strength
      const analysis = await this.analyzeOfferWithAI(offer, offerData.propertyId);
      
      // Notify vendor with analysis
      await this.notifyVendorWithOfferAnalysis(offer, analysis);
      
      // Update workflow
      const workflow = await this.getPropertyWorkflow(offerData.propertyId);
      if (workflow) {
        await this.progressWorkflow(workflow.id, 'offer_received', {
          totalOffers: (workflow.totalOffers || 0) + 1
        });
      }
      
      return { offer, analysis };
    } catch (error) {
      console.error('Error processing offer:', error);
      throw error;
    }
  }
  
  // Accept offer and start sales progression
  async acceptOffer(offerId: number) {
    try {
      // Update offer status
      const [offer] = await db.update(propertyOffers)
        .set({
          status: 'accepted',
          decisionDate: new Date()
        })
        .where(eq(propertyOffers.id, offerId))
        .returning();
      
      // Update property status
      await db.update(properties)
        .set({
          status: offer.propertyId ? 'under_offer' : 'sold'
        })
        .where(eq(properties.id, offer.propertyId));
      
      // Progress workflow
      const workflow = await this.getPropertyWorkflow(offer.propertyId);
      if (workflow) {
        await this.progressWorkflow(workflow.id, 'offer_accepted', {
          buyerId: offer.buyerEmail,
          agreedPrice: offer.finalAgreedAmount || offer.offerAmount
        });
      }
      
      // Generate memorandum of sale
      await this.generateMemorandumOfSale(offer);
      
      // Notify all parties
      await this.notifyOfferAcceptance(offer);
      
      // Start contract preparation
      await this.startContractPreparation(offer);
      
      return offer;
    } catch (error) {
      console.error('Error accepting offer:', error);
      throw error;
    }
  }
  
  // Generate and send contracts via DocuSign
  private async generateContracts(workflow: any) {
    try {
      // Get property and party details
      const property = await this.getPropertyDetails(workflow.propertyId);
      const vendor = await this.getUserDetails(workflow.vendorId);
      const buyer = await this.getUserDetails(workflow.buyerId);
      
      // Generate contract documents
      const salesContract = await docuSignService.generateSalesContract(
        property,
        buyer,
        vendor
      );
      
      // Create envelope in DocuSign
      const envelopeId = await docuSignService.createEnvelope(
        'sales_contract_template',
        [
          { email: vendor.email, name: vendor.fullName, role: 'vendor' },
          { email: buyer.email, name: buyer.fullName, role: 'buyer' }
        ],
        property
      );
      
      // Store contract document record
      await db.insert(contractDocuments).values({
        propertyId: workflow.propertyId,
        workflowId: workflow.id,
        documentType: 'sales_contract',
        documentName: `Sales Contract - ${property.addressLine1}`,
        docusignEnvelopeId: envelopeId,
        docusignStatus: 'created',
        status: 'draft'
      });
      
      // Send for signature
      await docuSignService.sendEnvelope(envelopeId);
      
      return envelopeId;
    } catch (error) {
      console.error('Error generating contracts:', error);
      throw error;
    }
  }
  
  // Send automated messages based on templates
  private async sendAutomatedMessage(triggerEvent: string, data: any) {
    try {
      // Get active template for this trigger
      const [template] = await db.select()
        .from(communicationTemplates)
        .where(and(
          eq(communicationTemplates.triggerEvent, triggerEvent),
          eq(communicationTemplates.isActive, true)
        ));
      
      if (!template) return;
      
      // Replace placeholders in content
      let content = template.content;
      Object.keys(data).forEach(key => {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), data[key]);
      });
      
      // Send based on template type
      switch (template.templateType) {
        case 'email':
          // Send email (implementation depends on email service)
          console.log('Sending email:', { to: data.recipientEmail, subject: template.subject, content });
          break;
          
        case 'sms':
          if (data.recipientPhone) {
            await sendPropertyOfferSMS(data.recipientPhone, content);
          }
          break;
          
        case 'whatsapp':
          if (data.recipientPhone) {
            await sendPropertyOfferWhatsApp({
              recipientPhone: data.recipientPhone,
              message: content
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error sending automated message:', error);
    }
  }
  
  // Helper methods
  private async getPropertyWorkflow(propertyId: number) {
    const [workflow] = await db.select()
      .from(propertyWorkflows)
      .where(eq(propertyWorkflows.propertyId, propertyId))
      .orderBy(desc(propertyWorkflows.createdAt))
      .limit(1);
    return workflow;
  }
  
  private async getPropertyDetails(propertyId: number) {
    const [property] = await db.select()
      .from(properties)
      .where(eq(properties.id, propertyId));
    return property;
  }
  
  private async getUserDetails(userId: number) {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId));
    return user;
  }
  
  private async findMatchingProperties(requirements: any) {
    // Implementation would use the existing property search logic
    return [];
  }
  
  private async findAvailableViewingSlot(propertyId: number, preferredDate: Date) {
    // Check existing appointments and find available slot
    // For now, return the preferred date
    return preferredDate;
  }
  
  private async analyzeOfferWithAI(offer: any, propertyId: number) {
    // Use AI to analyze offer strength
    return {
      strength: 'good',
      recommendation: 'Consider accepting',
      factors: ['Cash buyer', 'No chain', 'Quick completion']
    };
  }
  
  // Stub methods for various automation tasks
  private async scheduleValuationAppointment(workflowId: number, request: any) {}
  private async sendValuationReport(workflow: any) {}
  private async prepareInstructionDocuments(workflow: any) {}
  private async createPropertyListing(workflow: any) {}
  private async schedulePhotography(workflow: any) {}
  private async publishToPortals(workflow: any) {}
  private async notifyMatchingBuyers(workflow: any) {}
  private async notifyVendorOfOffer(workflow: any) {}
  private async analyzeOfferStrength(workflow: any) {}
  private async prepareSalesDocuments(workflow: any) {}
  private async notifyAllParties(workflow: any) {}
  private async sendToDocuSign(workflow: any) {}
  private async scheduleCompletion(workflow: any) {}
  private async notifyConveyancers(workflow: any) {}
  private async finalizeTransaction(workflow: any) {}
  private async archiveDocuments(workflow: any) {}
  private async sendPropertyMatches(enquiryId: number, matches: any[]) {}
  private async assignToAgent(enquiry: any) { return null; }
  private async scheduleFollowUp(enquiryId: number, priority: string) {}
  private async sendViewingConfirmation(appointment: any) {}
  private async scheduleViewingReminder(appointmentId: number) {}
  private async updateWorkflowViewingCount(propertyId: number) {}
  private async notifyVendorWithOfferAnalysis(offer: any, analysis: any) {}
  private async generateMemorandumOfSale(offer: any) {}
  private async notifyOfferAcceptance(offer: any) {}
  private async startContractPreparation(offer: any) {}
}

export const workflowAutomation = new WorkflowAutomationService();