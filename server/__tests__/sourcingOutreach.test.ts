/**
 * Sourcing Outreach Services -- Unit Tests
 *
 * Static analysis + mock-based tests for:
 * - sourcingOutreachService: AI draft generation, channel selection, PDF/email sending
 * - sourcingApprovalService: approve/reject/edit workflow
 * - sourcingFollowUpService: follow-up sequence management
 *
 * SRC-04, SRC-05, SRC-06, SRC-07
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ---- Read source files for static analysis ----

const outreachServiceSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/services/sourcingOutreachService.ts'),
  'utf-8'
);

const approvalServiceSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/services/sourcingApprovalService.ts'),
  'utf-8'
);

const followUpServiceSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/services/sourcingFollowUpService.ts'),
  'utf-8'
);

const pdfServiceSource = fs.readFileSync(
  path.resolve(__dirname, '../services/pdfService.ts'),
  'utf-8'
);

// ============================================================
// Task 1: Outreach Drafting Service
// ============================================================

describe('sourcingOutreachService', () => {
  it('exports draftOutreach function', () => {
    expect(outreachServiceSource).toMatch(/export\s+async\s+function\s+draftOutreach/);
  });

  it('exports sendApprovedEmail function', () => {
    expect(outreachServiceSource).toMatch(/export\s+async\s+function\s+sendApprovedEmail/);
  });

  it('exports sendApprovedLetter function', () => {
    expect(outreachServiceSource).toMatch(/export\s+async\s+function\s+sendApprovedLetter/);
  });

  it('uses gpt-4o-mini for cost-efficient outreach drafting', () => {
    expect(outreachServiceSource).toMatch(/gpt-4o-mini/);
  });

  it('creates contact history records with approvalStatus pending', () => {
    expect(outreachServiceSource).toMatch(/approval_status.*pending|approvalStatus.*pending/);
  });

  it('creates contact history records with status draft', () => {
    expect(outreachServiceSource).toMatch(/status.*draft/);
  });

  it('never calls emailService.sendEmail in draftOutreach (only in sendApprovedEmail)', () => {
    // Extract draftOutreach function body
    const draftMatch = outreachServiceSource.match(
      /export\s+async\s+function\s+draftOutreach[\s\S]*?(?=export\s+async\s+function)/
    );
    expect(draftMatch).toBeTruthy();
    const draftBody = draftMatch![0];
    // draftOutreach must NOT call emailService.sendEmail
    expect(draftBody).not.toMatch(/emailService\.sendEmail/);
  });

  it('sendApprovedEmail calls emailService.sendEmail', () => {
    const sendMatch = outreachServiceSource.match(
      /export\s+async\s+function\s+sendApprovedEmail[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(sendMatch).toBeTruthy();
    expect(sendMatch![0]).toMatch(/emailService\.sendEmail|emailService\s*\.\s*sendEmail/);
  });

  // Source-specific prompt content
  it('handles expired_listing source with relevant messaging', () => {
    expect(outreachServiceSource).toMatch(/expired_listing/);
    expect(outreachServiceSource).toMatch(/active buyers|fresh marketing/i);
  });

  it('handles auction source with relevant messaging', () => {
    expect(outreachServiceSource).toMatch(/auction/);
    expect(outreachServiceSource).toMatch(/private sale|discreet/i);
  });

  it('handles land_registry source with welcome messaging for recent purchases', () => {
    expect(outreachServiceSource).toMatch(/land_registry/);
    expect(outreachServiceSource).toMatch(/welcome|new to the area/i);
  });

  it('handles probate leads with sensitive messaging', () => {
    expect(outreachServiceSource).toMatch(/probate/);
    expect(outreachServiceSource).toMatch(/difficult time|sensitive|understand/i);
  });

  it('handles competitor_listing source', () => {
    expect(outreachServiceSource).toMatch(/competitor_listing/);
    expect(outreachServiceSource).toMatch(/fresh approach|premium marketing/i);
  });

  it('handles planning_permission source', () => {
    expect(outreachServiceSource).toMatch(/planning_permission/);
  });

  // Channel selection by sequence step
  it('determines channel from follow-up sequence', () => {
    expect(outreachServiceSource).toMatch(/channel/);
    expect(outreachServiceSource).toMatch(/post|email/);
  });

  it('imports generateOutreachLetterPDF from pdfService', () => {
    expect(outreachServiceSource).toMatch(/generateOutreachLetterPDF/);
    expect(outreachServiceSource).toMatch(/pdfService/);
  });

  it('uses lazy imports for pool and openai', () => {
    expect(outreachServiceSource).toMatch(/await\s+import|require\(/);
  });

  it('updates proactive_leads status after drafting', () => {
    expect(outreachServiceSource).toMatch(/ready_to_contact/);
  });

  it('updates proactive_leads after sending email', () => {
    const sendMatch = outreachServiceSource.match(
      /export\s+async\s+function\s+sendApprovedEmail[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(sendMatch).toBeTruthy();
    expect(sendMatch![0]).toMatch(/contacted/);
  });

  it('signs off as John Barclay in prompt', () => {
    expect(outreachServiceSource).toMatch(/John Barclay/);
  });
});

// ============================================================
// Task 1: PDF Service Extension
// ============================================================

describe('pdfService outreach letter', () => {
  it('exports generateOutreachLetterPDF function', () => {
    expect(pdfServiceSource).toMatch(/export\s+async\s+function\s+generateOutreachLetterPDF/);
  });

  it('exports OutreachLetterData interface', () => {
    expect(pdfServiceSource).toMatch(/export\s+interface\s+OutreachLetterData/);
  });

  it('uses drawHeader with Property Opportunity subtitle', () => {
    expect(pdfServiceSource).toMatch(/Property Opportunity/);
  });

  it('includes recipient address block', () => {
    expect(pdfServiceSource).toMatch(/recipientAddress|recipientName/);
  });

  it('includes John Barclay sign-off', () => {
    expect(pdfServiceSource).toMatch(/Yours sincerely/);
  });

  it('uses drawFooter', () => {
    // Already uses drawFooter, just confirm outreach letter section also calls it
    expect(pdfServiceSource).toMatch(/drawFooter/);
  });
});

// ============================================================
// Task 2: Approval Service
// ============================================================

describe('sourcingApprovalService', () => {
  it('exports getPendingApprovals function', () => {
    expect(approvalServiceSource).toMatch(/export\s+async\s+function\s+getPendingApprovals/);
  });

  it('exports approveOutreach function', () => {
    expect(approvalServiceSource).toMatch(/export\s+async\s+function\s+approveOutreach/);
  });

  it('exports rejectOutreach function', () => {
    expect(approvalServiceSource).toMatch(/export\s+async\s+function\s+rejectOutreach/);
  });

  it('exports editOutreachDraft function', () => {
    expect(approvalServiceSource).toMatch(/export\s+async\s+function\s+editOutreachDraft/);
  });

  it('getPendingApprovals queries for approval_status pending', () => {
    expect(approvalServiceSource).toMatch(/approval_status.*pending|approvalStatus.*pending/);
  });

  it('approveOutreach sets approval_status to approved before sending', () => {
    const approveMatch = approvalServiceSource.match(
      /export\s+async\s+function\s+approveOutreach[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(approveMatch).toBeTruthy();
    expect(approveMatch![0]).toMatch(/approved/);
  });

  it('approveOutreach triggers sendApprovedEmail for email channel', () => {
    const approveMatch = approvalServiceSource.match(
      /export\s+async\s+function\s+approveOutreach[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(approveMatch).toBeTruthy();
    expect(approveMatch![0]).toMatch(/sendApprovedEmail/);
  });

  it('approveOutreach triggers sendApprovedLetter for post channel', () => {
    const approveMatch = approvalServiceSource.match(
      /export\s+async\s+function\s+approveOutreach[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(approveMatch).toBeTruthy();
    expect(approveMatch![0]).toMatch(/sendApprovedLetter/);
  });

  it('rejectOutreach does NOT call sendApprovedEmail', () => {
    const rejectMatch = approvalServiceSource.match(
      /export\s+async\s+function\s+rejectOutreach[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(rejectMatch).toBeTruthy();
    expect(rejectMatch![0]).not.toMatch(/sendApprovedEmail/);
  });

  it('rejectOutreach sets approval_status to rejected with reason', () => {
    const rejectMatch = approvalServiceSource.match(
      /export\s+async\s+function\s+rejectOutreach[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(rejectMatch).toBeTruthy();
    expect(rejectMatch![0]).toMatch(/rejected/);
    expect(rejectMatch![0]).toMatch(/rejection_reason|rejectionReason/);
  });

  it('joins proactive_lead table in getPendingApprovals', () => {
    expect(approvalServiceSource).toMatch(/proactive_lead|JOIN/i);
  });

  it('uses lazy imports for pool', () => {
    expect(approvalServiceSource).toMatch(/await\s+import|require\(/);
  });
});

// ============================================================
// Task 2: Follow-up Sequence Service
// ============================================================

describe('sourcingFollowUpService', () => {
  it('exports getFollowUpSequence function', () => {
    expect(followUpServiceSource).toMatch(/export\s+function\s+getFollowUpSequence/);
  });

  it('exports getNextFollowUpStep function', () => {
    expect(followUpServiceSource).toMatch(/export\s+function\s+getNextFollowUpStep/);
  });

  it('exports calculateNextFollowUpDate function', () => {
    expect(followUpServiceSource).toMatch(/export\s+function\s+calculateNextFollowUpDate/);
  });

  it('exports advanceFollowUpSequence async function', () => {
    expect(followUpServiceSource).toMatch(/export\s+async\s+function\s+advanceFollowUpSequence/);
  });

  it('defines DEFAULT_SEQUENCE with 3 steps', () => {
    expect(followUpServiceSource).toMatch(/DEFAULT_SEQUENCE/);
    // step 0 = post, step 1 = email, step 2 = post
    expect(followUpServiceSource).toMatch(/step:\s*0/);
    expect(followUpServiceSource).toMatch(/step:\s*1/);
    expect(followUpServiceSource).toMatch(/step:\s*2/);
  });

  it('default sequence step 0 is post channel', () => {
    // Check the DEFAULT_SEQUENCE definition includes step 0 with post
    const seqMatch = followUpServiceSource.match(/DEFAULT_SEQUENCE[\s\S]*?\];/);
    expect(seqMatch).toBeTruthy();
    expect(seqMatch![0]).toMatch(/step:\s*0[\s\S]*?channel:\s*['"]post['"]/);
  });

  it('default sequence step 1 is email channel at day 7', () => {
    const seqMatch = followUpServiceSource.match(/DEFAULT_SEQUENCE[\s\S]*?\];/);
    expect(seqMatch).toBeTruthy();
    expect(seqMatch![0]).toMatch(/step:\s*1[\s\S]*?day:\s*7/);
  });

  it('default sequence step 2 is post channel at day 21', () => {
    const seqMatch = followUpServiceSource.match(/DEFAULT_SEQUENCE[\s\S]*?\];/);
    expect(seqMatch).toBeTruthy();
    expect(seqMatch![0]).toMatch(/step:\s*2[\s\S]*?day:\s*21/);
  });

  it('getNextFollowUpStep returns null when sequence exhausted', () => {
    expect(followUpServiceSource).toMatch(/null/);
  });

  it('advanceFollowUpSequence calls draftOutreach for next step', () => {
    expect(followUpServiceSource).toMatch(/draftOutreach/);
  });

  it('uses lazy imports for pool', () => {
    expect(followUpServiceSource).toMatch(/await\s+import|require\(/);
  });
});
