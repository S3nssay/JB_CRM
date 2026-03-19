/**
 * Channel Gateway Types
 * Types for the multi-channel messaging infrastructure.
 */

import type { CommunicationChannel } from '../types';

/** A message normalised from any channel adapter */
export interface NormalizedMessage {
  from: string;
  fromName?: string;
  body: string;
  channel: CommunicationChannel;
  externalId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/** A contact resolved from a phone/email identifier */
export interface ResolvedContact {
  contactIdentityId: number;
  contactId: number;
  contactType: string;
  identifierValue: string;
}

/** Result returned by ChannelGateway.processInbound */
export interface InboundResult {
  conversationId: number;
  messageId: number;
  contact: ResolvedContact;
  isNewConversation: boolean;
}

/** Interface that all channel adapters must implement */
export interface ChannelAdapter {
  normalize(payload: unknown): NormalizedMessage;
}
