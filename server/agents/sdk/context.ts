/**
 * Agent Context
 * Defines the context object passed to all SDK agents during execution.
 */

import type { AgentType, CommunicationChannel } from '../types';

export interface AgentContext {
  conversationId: number;
  contactId: number;
  channel: CommunicationChannel;
  isFirstMessage: boolean;
  agentType: AgentType;
}
