/**
 * Email Attachment Service
 *
 * Downloads email attachments from Graph API / IMAP, saves them to local storage,
 * classifies them using AI analysis results, and files them to the correct entity
 * repositories (landlord, property, tenant documents).
 */

import { db } from '../../db';
import {
  emailAttachments,
  document,
  processedEmails,
  InsertEmailAttachment,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { graphAuthService } from '../microsoft/graphAuthService';
import { createGraphClient } from '../microsoft/graphApiClient';
import { emailConnections } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { AiAnalysisResult } from './emailProcessor';

// Ensure upload directory exists
const documentsUploadDir = path.join(process.cwd(), 'uploads', 'documents');
if (!fs.existsSync(documentsUploadDir)) {
  fs.mkdirSync(documentsUploadDir, { recursive: true });
}

// KYC document types that should update entity KYC status
const KYC_DOCUMENT_TYPES = ['passport', 'driving_licence', 'proof_of_address', 'bank_statement'];

// Property compliance document types
const PROPERTY_DOCUMENT_TYPES = ['gas_safety', 'epc', 'eicr', 'insurance', 'licence', 'certificate'];

export interface AttachmentProcessingResult {
  emailAttachmentId: number;
  documentId: number | null;
  filename: string;
  documentType: string;
  entityType: string;
  entityId: number | null;
  storageUrl: string | null;
  reviewStatus: string;
}

export interface ContactMatch {
  type: 'tenant' | 'landlord' | 'contractor' | 'lead' | 'contact' | 'unknown';
  id: number;
  name: string;
  propertyId?: number;
}

class EmailAttachmentService {

  /**
   * Process all attachments for a processed email.
   * Downloads files, classifies them, files them to entity repositories.
   */
  async processAttachments(
    processedEmailId: number,
    aiClassifications: AiAnalysisResult['attachmentClassifications'],
    contact: ContactMatch,
    options: {
      connectionId: number;
      graphMessageId: string;
      isImap: boolean;
      imapAttachments?: { name: string; contentType: string; size: number; content?: Buffer }[];
    }
  ): Promise<AttachmentProcessingResult[]> {
    const results: AttachmentProcessingResult[] = [];

    // Get the processed email's attachment metadata
    const [email] = await db.select()
      .from(processedEmails)
      .where(eq(processedEmails.id, processedEmailId))
      .limit(1);

    if (!email || !email.attachments) {
      console.log(`[AttachmentService] No attachments for email ${processedEmailId}`);
      return results;
    }

    const attachmentMeta = email.attachments as { id?: string; name: string; contentType: string; size: number }[];

    for (const meta of attachmentMeta) {
      try {
        // Skip inline images (content IDs)
        if (meta.contentType?.startsWith('image/') && (meta as any).contentId) {
          continue;
        }

        // Skip tiny files (likely signatures or tracking pixels)
        if (meta.size < 1024) {
          continue;
        }

        // Find AI classification for this attachment
        const classification = aiClassifications?.find(
          c => c.filename === meta.name
        );

        // Download the file
        let fileBuffer: Buffer | null = null;
        let savedPath: string | null = null;

        if (options.isImap && options.imapAttachments) {
          // IMAP: content already available
          const imapAtt = options.imapAttachments.find(a => a.name === meta.name);
          if (imapAtt?.content) {
            fileBuffer = imapAtt.content;
          }
        } else if (!options.isImap && meta.id) {
          // Graph API: download attachment content
          fileBuffer = await this.downloadFromGraph(
            options.connectionId,
            options.graphMessageId,
            meta.id
          );
        }

        // Save file to disk
        if (fileBuffer) {
          savedPath = await this.saveFile(fileBuffer, meta.name, meta.contentType);
        }

        // Determine entity routing
        const { entityType, entityId, propertyId, landlordId, tenantId } =
          this.determineEntityRouting(classification, contact);

        // Determine confidence-based review status
        const confidence = classification?.confidence || 0;
        const reviewStatus = confidence >= 0.9 ? 'confirmed' : 'pending';

        // Create email_attachment record
        const [emailAtt] = await db.insert(emailAttachments).values({
          processedEmailId,
          originalFilename: meta.name,
          contentType: meta.contentType,
          fileSize: meta.size,
          storageUrl: savedPath,
          aiDocumentType: classification?.documentType || 'other',
          aiEntityType: entityType,
          aiEntityId: entityId,
          aiConfidence: confidence.toString(),
          reviewStatus,
        }).returning();

        // Create document record in the unified document table
        let documentId: number | null = null;
        if (savedPath) {
          const [doc] = await db.insert(document).values({
            name: meta.name,
            originalName: meta.name,
            documentType: classification?.documentType || 'other',
            storageUrl: savedPath,
            mimeType: meta.contentType,
            size: meta.size,
            storageProvider: 'local',
            entityType: entityType !== 'unknown' ? entityType : null,
            entityId: entityId || null,
            propertyId: propertyId || null,
            landlordId: landlordId || null,
            tenantId: tenantId || null,
            description: `Auto-filed from email: ${email.subject || 'No subject'}`,
            status: reviewStatus === 'confirmed' ? 'active' : 'pending_review',
            uploadedBy: 'system',
          }).returning();

          documentId = doc.id;

          // Link email_attachment to document
          await db.update(emailAttachments)
            .set({ documentId: doc.id })
            .where(eq(emailAttachments.id, emailAtt.id));
        }

        results.push({
          emailAttachmentId: emailAtt.id,
          documentId,
          filename: meta.name,
          documentType: classification?.documentType || 'other',
          entityType,
          entityId,
          storageUrl: savedPath,
          reviewStatus,
        });

        console.log(`[AttachmentService] Processed ${meta.name}: type=${classification?.documentType || 'other'}, entity=${entityType}/${entityId}, review=${reviewStatus}`);

      } catch (error) {
        console.error(`[AttachmentService] Failed to process attachment ${meta.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Download an attachment from Microsoft Graph API
   */
  private async downloadFromGraph(
    connectionId: number,
    graphMessageId: string,
    attachmentId: string
  ): Promise<Buffer | null> {
    try {
      const [connection] = await db.select()
        .from(emailConnections)
        .where(eq(emailConnections.id, connectionId))
        .limit(1);

      if (!connection) {
        console.error(`[AttachmentService] Connection ${connectionId} not found`);
        return null;
      }

      const tokenResult = await graphAuthService.getValidAccessToken(
        connection.accessToken,
        connection.refreshToken,
        connection.tokenExpiresAt,
        connection.tenantId
      );

      if (tokenResult.needsUpdate) {
        await db.update(emailConnections)
          .set({
            accessToken: tokenResult.newAccessToken!,
            refreshToken: tokenResult.newRefreshToken!,
            tokenExpiresAt: tokenResult.newExpiresAt!,
            updatedAt: new Date(),
          })
          .where(eq(emailConnections.id, connectionId));
      }

      const graphClient = createGraphClient(tokenResult.accessToken);
      const { buffer } = await graphClient.getAttachmentContent(graphMessageId, attachmentId);
      return buffer;
    } catch (error) {
      console.error(`[AttachmentService] Graph download failed for attachment ${attachmentId}:`, error);
      return null;
    }
  }

  /**
   * Save file buffer to local storage
   */
  private async saveFile(buffer: Buffer, originalName: string, contentType: string): Promise<string> {
    const ext = path.extname(originalName) || this.getExtensionFromMime(contentType);
    const filename = `doc-${randomUUID()}${ext}`;
    const filePath = path.join(documentsUploadDir, filename);

    fs.writeFileSync(filePath, buffer);

    return `/uploads/documents/${filename}`;
  }

  /**
   * Determine which entity a document belongs to based on AI classification and sender context
   */
  private determineEntityRouting(
    classification: AiAnalysisResult['attachmentClassifications'][0] | undefined,
    contact: ContactMatch
  ): {
    entityType: string;
    entityId: number | null;
    propertyId: number | null;
    landlordId: number | null;
    tenantId: number | null;
  } {
    const docType = classification?.documentType || 'other';
    const aiEntityType = classification?.entityType || 'unknown';

    // KYC documents: route based on sender
    if (KYC_DOCUMENT_TYPES.includes(docType)) {
      if (contact.type === 'landlord') {
        return { entityType: 'landlord', entityId: contact.id, propertyId: null, landlordId: contact.id, tenantId: null };
      }
      if (contact.type === 'tenant') {
        return { entityType: 'tenant', entityId: contact.id, propertyId: contact.propertyId || null, landlordId: null, tenantId: contact.id };
      }
    }

    // Property compliance documents: route to property
    if (PROPERTY_DOCUMENT_TYPES.includes(docType)) {
      if (contact.type === 'landlord') {
        // Landlord sending property docs — we'd need to look up their property
        return { entityType: 'landlord', entityId: contact.id, propertyId: null, landlordId: contact.id, tenantId: null };
      }
      if (contact.propertyId) {
        return { entityType: 'property', entityId: contact.propertyId, propertyId: contact.propertyId, landlordId: null, tenantId: null };
      }
    }

    // Tenancy agreement: route to tenancy/property
    if (docType === 'tenancy_agreement' || docType === 'inventory') {
      if (contact.type === 'tenant' && contact.propertyId) {
        return { entityType: 'property', entityId: contact.propertyId, propertyId: contact.propertyId, landlordId: null, tenantId: contact.id };
      }
    }

    // Photos (damage reports): route to property via tenant
    if (docType === 'photo' && contact.type === 'tenant' && contact.propertyId) {
      return { entityType: 'property', entityId: contact.propertyId, propertyId: contact.propertyId, landlordId: null, tenantId: contact.id };
    }

    // Invoices from contractors: route to property if available
    if (docType === 'invoice' && contact.type === 'contractor') {
      return { entityType: 'contractor', entityId: contact.id, propertyId: null, landlordId: null, tenantId: null };
    }

    // Use AI suggestion if available
    if (aiEntityType !== 'unknown' && classification?.confidence && classification.confidence >= 0.7) {
      const entityId = contact.type === aiEntityType ? contact.id : null;
      return {
        entityType: aiEntityType,
        entityId,
        propertyId: aiEntityType === 'property' ? entityId : (contact.propertyId || null),
        landlordId: aiEntityType === 'landlord' ? entityId : null,
        tenantId: aiEntityType === 'tenant' ? entityId : null,
      };
    }

    // Fallback: associate with sender if known
    if (contact.type !== 'unknown' && contact.id > 0) {
      return {
        entityType: contact.type,
        entityId: contact.id,
        propertyId: contact.propertyId || null,
        landlordId: contact.type === 'landlord' ? contact.id : null,
        tenantId: contact.type === 'tenant' ? contact.id : null,
      };
    }

    return { entityType: 'unknown', entityId: null, propertyId: null, landlordId: null, tenantId: null };
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'text/plain': '.txt',
      'text/csv': '.csv',
    };
    return map[mimeType] || '';
  }
}

export const emailAttachmentService = new EmailAttachmentService();
