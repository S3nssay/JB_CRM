/**
 * Vapi Voice Integration Types
 * Types for Vapi webhook payloads, assistant config, and squad config.
 * Created as dependency for webhook handling (03-02).
 */

// Vapi webhook message types
export type VapiMessageType =
  | 'tool-calls'
  | 'end-of-call-report'
  | 'assistant-request'
  | 'hang'
  | 'status-update'
  | 'transfer-destination-request'
  | 'transcript';

// Individual tool call from Vapi
export interface VapiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

// Vapi tool-calls webhook message
export interface VapiToolCallMessage {
  type: 'tool-calls';
  toolCallList: VapiToolCall[];
  call?: {
    id: string;
    customer?: {
      number?: string;
    };
  };
}

// Result format Vapi expects for tool calls
export interface VapiToolCallResult {
  results: Array<{
    toolCallId: string;
    result: string; // Must be string per Vapi requirement
  }>;
}

// End-of-call report from Vapi
export interface VapiEndOfCallReport {
  type: 'end-of-call-report';
  call?: {
    id: string;
    customer?: {
      number?: string;
    };
  };
  artifact?: {
    messages?: Array<{
      role: string;
      content: string;
      time?: number;
    }>;
    transcript?: string;
  };
  endedReason?: string;
  summary?: string;
  recordingUrl?: string;
  startedAt?: string;
  endedAt?: string;
  cost?: number;
}

// Assistant request message from Vapi
export interface VapiAssistantRequest {
  type: 'assistant-request';
  call?: {
    id: string;
    customer?: {
      number?: string;
    };
  };
}

// Hang event from Vapi
export interface VapiHangMessage {
  type: 'hang';
  call?: {
    id: string;
  };
}

// Generic server message wrapper
export interface VapiServerMessage {
  message: VapiToolCallMessage | VapiEndOfCallReport | VapiAssistantRequest | VapiHangMessage | {
    type: VapiMessageType;
    call?: { id: string; customer?: { number?: string } };
    [key: string]: unknown;
  };
}

// Assistant configuration for Vapi
export interface VapiAssistantConfig {
  name: string;
  model: {
    provider: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
    tools?: Array<{
      type: string;
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
      server?: { url: string };
    }>;
  };
  voice: {
    provider: string;
    voiceId: string;
  };
  firstMessage: string;
  serverUrl?: string;
  serverUrlSecret?: string;
  transferPlan?: {
    mode: string;
    destinations: Array<{
      type: string;
      assistantName: string;
      message: string;
      description: string;
    }>;
  };
}

// Squad configuration for Vapi
export interface VapiSquadConfig {
  name: string;
  members: Array<{
    assistant: VapiAssistantConfig;
    assistantDestinations?: Array<{
      type: string;
      assistantName: string;
      message: string;
      description: string;
    }>;
  }>;
}
