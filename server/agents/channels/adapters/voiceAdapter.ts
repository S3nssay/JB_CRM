/**
 * Voice Channel Adapter
 * Normalises voice call transcript messages into NormalizedMessage format
 * for the ChannelGateway.
 */

import type { NormalizedMessage, ChannelAdapter } from '../types';

/**
 * Payload shape for individual voice transcript messages.
 */
interface VoicePayload {
  from: string;
  body: string;
  timestamp?: Date;
  externalId?: string;
  metadata?: Record<string, any>;
}

export class VoiceAdapter implements ChannelAdapter {
  normalize(payload: unknown): NormalizedMessage {
    const p = payload as VoicePayload;

    return {
      from: p.from || 'caller',
      body: p.body || '',
      channel: 'phone',
      externalId: p.externalId,
      timestamp: p.timestamp ?? new Date(),
      metadata: p.metadata,
    };
  }
}
