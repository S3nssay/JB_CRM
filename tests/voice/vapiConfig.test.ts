/**
 * Vapi Configuration Tests
 *
 * Validates that Vapi assistant and squad configuration builders
 * produce valid JSON structures for the Vapi API.
 */

import { describe, it, expect } from 'vitest';
import {
  buildReceptionistConfig,
  buildSalesAssistantConfig,
  buildLettingsAssistantConfig,
  buildAdminAssistantConfig,
  buildSquadConfig,
  VAPI_SERVER_URL,
} from '../../server/agents/voice/vapiConfig';
import type {
  VapiAssistantConfig,
  VapiSquadConfig,
  VapiCustomTool,
  VapiTransferCallTool,
} from '../../server/agents/voice/types';

// ---- Helper: check if a tool array contains a function tool by name ----
function hasFunctionTool(tools: any[], name: string): boolean {
  return tools.some(
    (t) => t.type === 'function' && t.function?.name === name,
  );
}

// ---- Helper: check if a tool array contains transferCall ----
function hasTransferCallTool(tools: any[]): boolean {
  return tools.some((t) => t.type === 'transferCall');
}

// ---- Helper: check filler messages on function tools ----
function functionToolsHaveFillerMessages(tools: any[]): boolean {
  const fnTools = tools.filter((t) => t.type === 'function');
  return fnTools.length > 0 && fnTools.every((t) => t.messages && t.messages.length > 0);
}

describe('Vapi Configuration Builders', () => {
  describe('buildReceptionistConfig', () => {
    it('returns valid assistant with firstMessage containing AI disclosure', () => {
      const config = buildReceptionistConfig();
      expect(config.name).toBe('Sarah - Receptionist');
      expect(config.firstMessage).toBeTruthy();
      expect(config.firstMessage!.toLowerCase()).toContain('ai');
      expect(config.firstMessage!).toContain('John Barclay');
    });

    it('has British voice configuration', () => {
      const config = buildReceptionistConfig();
      expect(config.voice).toBeDefined();
      expect(config.voice.provider).toBeTruthy();
      expect(config.voice.voiceId).toBeTruthy();
    });

    it('has backchannelingEnabled true and fillerInjectionEnabled false', () => {
      const config = buildReceptionistConfig();
      expect(config.backchannelingEnabled).toBe(true);
      expect(config.fillerInjectionEnabled).toBe(false);
    });

    it('has transferCall tool for human escalation', () => {
      const config = buildReceptionistConfig();
      expect(hasTransferCallTool(config.tools)).toBe(true);
    });

    it('does not have CRM function tools (only routes to specialists)', () => {
      const config = buildReceptionistConfig();
      expect(hasFunctionTool(config.tools, 'search_properties')).toBe(false);
      expect(hasFunctionTool(config.tools, 'book_viewing')).toBe(false);
    });
  });

  describe('buildSalesAssistantConfig', () => {
    it('includes search_properties and book_viewing tools', () => {
      const config = buildSalesAssistantConfig();
      expect(hasFunctionTool(config.tools, 'search_properties')).toBe(true);
      expect(hasFunctionTool(config.tools, 'book_viewing')).toBe(true);
    });

    it('includes create_lead and query_knowledge_base tools', () => {
      const config = buildSalesAssistantConfig();
      expect(hasFunctionTool(config.tools, 'create_lead')).toBe(true);
      expect(hasFunctionTool(config.tools, 'query_knowledge_base')).toBe(true);
    });

    it('has transferCall tool for human escalation', () => {
      const config = buildSalesAssistantConfig();
      expect(hasTransferCallTool(config.tools)).toBe(true);
    });

    it('has filler speech messages on CRM tools', () => {
      const config = buildSalesAssistantConfig();
      expect(functionToolsHaveFillerMessages(config.tools)).toBe(true);
    });

    it('has fillerInjectionEnabled true for natural conversation', () => {
      const config = buildSalesAssistantConfig();
      expect(config.fillerInjectionEnabled).toBe(true);
    });
  });

  describe('buildLettingsAssistantConfig', () => {
    it('includes search_properties and book_viewing tools', () => {
      const config = buildLettingsAssistantConfig();
      expect(hasFunctionTool(config.tools, 'search_properties')).toBe(true);
      expect(hasFunctionTool(config.tools, 'book_viewing')).toBe(true);
    });

    it('has transferCall tool for human escalation', () => {
      const config = buildLettingsAssistantConfig();
      expect(hasTransferCallTool(config.tools)).toBe(true);
    });

    it('has filler speech messages on CRM tools', () => {
      const config = buildLettingsAssistantConfig();
      expect(functionToolsHaveFillerMessages(config.tools)).toBe(true);
    });
  });

  describe('buildAdminAssistantConfig', () => {
    it('includes generate_checklist tool', () => {
      const config = buildAdminAssistantConfig();
      expect(hasFunctionTool(config.tools, 'generate_checklist')).toBe(true);
    });

    it('includes chase_checklist_item tool', () => {
      const config = buildAdminAssistantConfig();
      expect(hasFunctionTool(config.tools, 'chase_checklist_item')).toBe(true);
    });

    it('has transferCall tool for human escalation', () => {
      const config = buildAdminAssistantConfig();
      expect(hasTransferCallTool(config.tools)).toBe(true);
    });
  });

  describe('buildSquadConfig', () => {
    it('has 4 members with Sarah first', () => {
      const squad = buildSquadConfig();
      expect(squad.members.length).toBe(4);
      const firstMember = squad.members[0].assistant as VapiAssistantConfig;
      expect(firstMember.name).toBe('Sarah - Receptionist');
    });

    it('has correct squad name', () => {
      const squad = buildSquadConfig();
      expect(squad.name).toBe('John Barclay Estate Agents');
    });

    it('receptionist has assistant destinations for all specialists', () => {
      const squad = buildSquadConfig();
      const receptionistMember = squad.members[0];
      expect(receptionistMember.assistantDestinations).toBeDefined();
      expect(receptionistMember.assistantDestinations!.length).toBe(3);

      const names = receptionistMember.assistantDestinations!.map(
        (d) => d.assistantName,
      );
      expect(names).toContain('Alex - Sales Specialist');
      expect(names).toContain('Jordan - Lettings Specialist');
      expect(names).toContain('Sam - Admin Specialist');
    });

    it('specialist members do not have assistant destinations', () => {
      const squad = buildSquadConfig();
      // Members 1, 2, 3 are specialists -- they don't route further
      for (let i = 1; i < squad.members.length; i++) {
        expect(squad.members[i].assistantDestinations).toBeUndefined();
      }
    });
  });

  describe('all assistants', () => {
    it('reference correct server URL', () => {
      const configs = [
        buildReceptionistConfig(),
        buildSalesAssistantConfig(),
        buildLettingsAssistantConfig(),
        buildAdminAssistantConfig(),
      ];
      for (const config of configs) {
        expect(config.serverUrl).toBe(VAPI_SERVER_URL);
      }
    });

    it('have transferCall tool for human escalation', () => {
      const configs = [
        buildReceptionistConfig(),
        buildSalesAssistantConfig(),
        buildLettingsAssistantConfig(),
        buildAdminAssistantConfig(),
      ];
      for (const config of configs) {
        expect(hasTransferCallTool(config.tools)).toBe(true);
      }
    });
  });
});
