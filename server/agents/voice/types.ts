/**
 * Vapi Voice Integration Types
 *
 * Type definitions for Vapi webhook payloads, assistant configurations,
 * and squad configurations used by the voice integration layer.
 */

// ---- Webhook message types ----

export type VapiMessageType =
  | 'tool-calls'
  | 'end-of-call-report'
  | 'assistant-request'
  | 'hang'
  | 'status-update'
  | 'transfer-destination-request'
  | 'transcript';

// ---- Tool call types ----

export interface VapiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

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

export interface VapiToolCallResult {
  results: Array<{
    toolCallId: string;
    result: string; // Must be string per Vapi requirement
  }>;
}

// ---- End-of-call report ----

export interface VapiEndOfCallReport {
  type: 'end-of-call-report';
  artifact?: {
    messages?: Array<{
      role: string;
      content: string;
      time?: number;
    }>;
    transcript?: string;
  };
  analysis?: {
    summary?: string;
    successEvaluation?: string;
  };
  call?: {
    id: string;
    startedAt?: string;
    endedAt?: string;
    customer?: {
      number?: string;
    };
  };
  endedReason?: string;
  recordingUrl?: string;
  cost?: number;
}

// ---- Assistant request ----

export interface VapiAssistantRequest {
  type: 'assistant-request';
  call?: {
    id: string;
    customer?: {
      number?: string;
    };
  };
}

// ---- Hang event ----

export interface VapiHangMessage {
  type: 'hang';
  call?: {
    id: string;
  };
}

// ---- Generic server message wrapper ----

export interface VapiServerMessage {
  message:
    | VapiToolCallMessage
    | VapiEndOfCallReport
    | VapiAssistantRequest
    | VapiHangMessage
    | {
        type: VapiMessageType;
        call?: { id: string; customer?: { number?: string } };
        [key: string]: unknown;
      };
}

// ---- Tool definitions ----

export interface VapiCustomToolMessage {
  type: 'request-start' | 'request-complete';
  content: string;
}

export interface VapiCustomTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
  async?: boolean;
  server?: {
    url: string;
  };
  messages?: VapiCustomToolMessage[];
}

export interface VapiTransferDestination {
  type: 'number';
  number: string;
  message: string;
}

export interface VapiTransferCallTool {
  type: 'transferCall';
  destinations: VapiTransferDestination[];
}

export type VapiTool = VapiCustomTool | VapiTransferCallTool;

// ---- Voice configuration ----

export interface VapiModel {
  provider: string;
  model: string;
}

export interface VapiVoice {
  provider: string;
  voiceId: string;
}

// ---- Assistant configuration ----

export interface VapiAssistantConfig {
  name: string;
  model: VapiModel;
  voice: VapiVoice;
  firstMessage: string | null;
  instructions: string;
  serverUrl: string;
  tools: VapiTool[];
  backchannelingEnabled?: boolean;
  fillerInjectionEnabled?: boolean;
  endCallPhrases?: string[];
  silenceTimeoutSeconds?: number;
  maxDurationSeconds?: number;
  voicemailDetection?: {
    enabled: boolean;
  };
}

// ---- Squad configuration ----

export interface VapiAssistantDestination {
  type: 'assistant';
  assistantName: string;
  message: string;
  description: string;
}

export interface VapiSquadMember {
  assistant: VapiAssistantConfig | { assistantId: string };
  assistantDestinations?: VapiAssistantDestination[];
}

export interface VapiSquadConfig {
  name: string;
  members: VapiSquadMember[];
}
