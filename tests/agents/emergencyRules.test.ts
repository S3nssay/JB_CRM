/**
 * Emergency Rules Engine — Unit Tests
 *
 * Tests the rules-based urgency classification engine that categorises
 * maintenance fault reports into emergency/urgent/routine/low levels.
 */
import { describe, it, expect } from 'vitest';
import { classifyUrgency } from '../../server/agents/services/emergencyRules';

describe('Emergency Rules Engine', () => {
  describe('Emergency classifications', () => {
    it('should classify gas leak as emergency with score 10', () => {
      const result = classifyUrgency('gas leak in the kitchen', 'heating', null, new Date());
      expect(result.urgency).toBe('emergency');
      expect(result.score).toBe(10);
      expect(result.isEmergency).toBe(true);
      expect(result.reasoning).toMatch(/gas/i);
    });

    it('should classify smelling gas as emergency', () => {
      const result = classifyUrgency('I can smell gas in the hallway', 'heating', null, new Date());
      expect(result.urgency).toBe('emergency');
      expect(result.score).toBe(10);
      expect(result.isEmergency).toBe(true);
    });

    it('should classify carbon monoxide alarm as emergency', () => {
      const result = classifyUrgency('carbon monoxide alarm is going off', 'heating', null, new Date());
      expect(result.urgency).toBe('emergency');
      expect(result.score).toBe(10);
    });

    it('should classify burst pipe / flooding as emergency with score 10', () => {
      const result = classifyUrgency('burst pipe, water flooding the bathroom', 'plumbing', null, new Date());
      expect(result.urgency).toBe('emergency');
      expect(result.score).toBe(10);
      expect(result.isEmergency).toBe(true);
      expect(result.reasoning).toMatch(/flood|burst|water/i);
    });

    it('should classify ceiling leak as emergency', () => {
      const result = classifyUrgency('water is coming through the ceiling', 'plumbing', null, new Date());
      expect(result.urgency).toBe('emergency');
      expect(result.score).toBe(10);
    });

    it('should classify no heating in January (winter) as emergency with score 9', () => {
      const result = classifyUrgency('boiler not working, no heating', 'heating', null, new Date('2026-01-15'));
      expect(result.urgency).toBe('emergency');
      expect(result.score).toBe(9);
      expect(result.isEmergency).toBe(true);
      expect(result.reasoning).toMatch(/winter/i);
    });

    it('should classify no heating in July (summer) as urgent, not emergency', () => {
      const result = classifyUrgency('boiler not working, no heating', 'heating', null, new Date('2026-07-15'));
      expect(result.urgency).toBe('urgent');
      expect(result.score).toBe(7);
      expect(result.isEmergency).toBe(false);
    });

    it('should classify break-in / broken lock as emergency with score 9', () => {
      const result = classifyUrgency('someone tried to break-in and the door lock is broken', 'other', null, new Date());
      expect(result.urgency).toBe('emergency');
      expect(result.score).toBe(9);
      expect(result.isEmergency).toBe(true);
    });

    it('should classify window smashed as emergency', () => {
      const result = classifyUrgency('window smashed, cannot secure the flat', 'other', null, new Date());
      expect(result.urgency).toBe('emergency');
      expect(result.score).toBe(9);
    });

    it('should classify exposed wiring as emergency with score 10', () => {
      const result = classifyUrgency('there is exposed wiring in the bathroom', 'electrical', null, new Date());
      expect(result.urgency).toBe('emergency');
      expect(result.score).toBe(10);
      expect(result.isEmergency).toBe(true);
    });

    it('should classify electrical sparking as emergency', () => {
      const result = classifyUrgency('the socket is sparking when I plug things in', 'electrical', null, new Date());
      expect(result.urgency).toBe('emergency');
      expect(result.score).toBe(10);
    });

    it('should classify burning smell as emergency', () => {
      const result = classifyUrgency('there is a burning smell from the fuse box', 'electrical', null, new Date());
      expect(result.urgency).toBe('emergency');
      expect(result.score).toBe(10);
    });
  });

  describe('Urgent classifications', () => {
    it('should classify no hot water as urgent with score 6', () => {
      const result = classifyUrgency('no hot water at all', 'plumbing', null, new Date());
      expect(result.urgency).toBe('urgent');
      expect(result.score).toBe(6);
      expect(result.isEmergency).toBe(false);
    });

    it('should classify pest infestation as urgent', () => {
      const result = classifyUrgency('there are mice everywhere, pest infestation', 'other', null, new Date());
      expect(result.urgency).toBe('urgent');
      expect(result.isEmergency).toBe(false);
    });
  });

  describe('Routine classifications', () => {
    it('should classify minor appliance issue as routine', () => {
      const result = classifyUrgency('the washing machine is making a strange noise', 'appliance', null, new Date());
      expect(result.urgency).toBe('routine');
      expect(result.isEmergency).toBe(false);
    });

    it('should classify dripping tap as low', () => {
      const result = classifyUrgency('dripping kitchen tap', 'plumbing', null, new Date());
      expect(result.urgency).toBe('low');
      expect(result.score).toBe(2);
      expect(result.isEmergency).toBe(false);
    });
  });

  describe('Low classifications', () => {
    it('should classify cosmetic issues as low', () => {
      const result = classifyUrgency('paint peeling on the bedroom wall', 'other', null, new Date());
      expect(result.urgency).toBe('low');
      expect(result.isEmergency).toBe(false);
    });

    it('should classify scuff marks as low', () => {
      const result = classifyUrgency('scuff marks on the hallway wall', 'other', null, new Date());
      expect(result.urgency).toBe('low');
    });
  });

  describe('Default classification', () => {
    it('should default to routine for unknown descriptions', () => {
      const result = classifyUrgency('something is wrong but I cannot describe it', 'other', null, new Date());
      expect(result.urgency).toBe('routine');
      expect(result.score).toBe(3);
      expect(result.isEmergency).toBe(false);
    });
  });
});
