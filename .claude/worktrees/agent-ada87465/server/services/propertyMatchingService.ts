/**
 * Property Matching Service
 *
 * Matches email content to property records using address/postcode extraction.
 * Also matches lead preferences to available properties for recommendations.
 */

import { db } from '../db';
import { properties } from '@shared/schema';
import { eq, and, ilike, or, sql, gte, lte } from 'drizzle-orm';
import type { AiAnalysisResult } from './email/emailProcessor';

export interface PropertyMatchResult {
  propertyId: number;
  address: string;
  confidence: number;
  matchType: 'exact_ref' | 'postcode_address' | 'postcode_only' | 'address_fuzzy';
}

class PropertyMatchingService {

  /**
   * Match email AI analysis to a property record
   */
  async matchFromEmail(
    aiResult: AiAnalysisResult,
    department?: string | null
  ): Promise<PropertyMatchResult | null> {
    // 1. Try property references first (if AI extracted IDs)
    const refs = aiResult.extractedEntities?.propertyReferences || [];
    for (const ref of refs) {
      const numericId = parseInt(ref, 10);
      if (!isNaN(numericId)) {
        const [prop] = await db.select({ id: properties.id, address: properties.address })
          .from(properties)
          .where(eq(properties.id, numericId))
          .limit(1);
        if (prop) {
          return { propertyId: prop.id, address: prop.address || '', confidence: 1.0, matchType: 'exact_ref' };
        }
      }
    }

    // 2. Try propertyMatch from AI
    if (aiResult.propertyMatch) {
      const match = await this.matchByAddressAndPostcode(
        aiResult.propertyMatch.address,
        aiResult.propertyMatch.postcode,
        department
      );
      if (match) return match;
    }

    // 3. Try extracted addresses
    const addresses = aiResult.extractedEntities?.addresses || [];
    for (const addr of addresses) {
      const postcode = this.extractPostcode(addr);
      const match = await this.matchByAddressAndPostcode(addr, postcode, department);
      if (match) return match;
    }

    return null;
  }

  /**
   * Match by address text and/or postcode
   */
  async matchByAddressAndPostcode(
    address: string | null,
    postcode: string | null,
    department?: string | null
  ): Promise<PropertyMatchResult | null> {
    if (!address && !postcode) return null;

    // Build conditions
    const conditions = [];

    // Filter by listing type based on department
    if (department === 'sales') {
      conditions.push(eq(properties.isListedSale, true));
    } else if (department === 'lettings') {
      conditions.push(eq(properties.isListedRental, true));
    }

    // Try postcode + address match first
    if (postcode && address) {
      const cleanAddress = this.cleanAddress(address);
      const addressWords = cleanAddress.split(/\s+/).filter(w => w.length > 2);
      // Take first few meaningful words for matching
      const searchTerms = addressWords.slice(0, 3);

      if (searchTerms.length > 0) {
        const addressConditions = searchTerms.map(term =>
          or(
            ilike(properties.address, `%${term}%`),
            ilike(properties.addressLine1, `%${term}%`)
          )
        );

        const results = await db.select({
          id: properties.id,
          address: properties.address,
          postcode: properties.postcode,
        })
          .from(properties)
          .where(and(
            ilike(properties.postcode, `%${postcode.replace(/\s/g, '')}%`),
            ...addressConditions.filter(Boolean) as any[],
            ...conditions
          ))
          .limit(5);

        if (results.length === 1) {
          return { propertyId: results[0].id, address: results[0].address || '', confidence: 0.95, matchType: 'postcode_address' };
        }
        if (results.length > 1) {
          // Multiple matches — return the best one but lower confidence
          return { propertyId: results[0].id, address: results[0].address || '', confidence: 0.7, matchType: 'postcode_address' };
        }
      }
    }

    // Try postcode only
    if (postcode) {
      const normalizedPostcode = postcode.replace(/\s/g, '').toUpperCase();
      const results = await db.select({
        id: properties.id,
        address: properties.address,
      })
        .from(properties)
        .where(and(
          sql`REPLACE(UPPER(${properties.postcode}), ' ', '') = ${normalizedPostcode}`,
          ...conditions
        ))
        .limit(5);

      if (results.length === 1) {
        return { propertyId: results[0].id, address: results[0].address || '', confidence: 0.8, matchType: 'postcode_only' };
      }
      if (results.length > 1) {
        return { propertyId: results[0].id, address: results[0].address || '', confidence: 0.5, matchType: 'postcode_only' };
      }
    }

    // Try fuzzy address match (no postcode)
    if (address) {
      const cleanAddress = this.cleanAddress(address);
      const words = cleanAddress.split(/\s+/).filter(w => w.length > 3);
      if (words.length >= 2) {
        const results = await db.select({
          id: properties.id,
          address: properties.address,
        })
          .from(properties)
          .where(and(
            ilike(properties.address, `%${words[0]}%`),
            ilike(properties.address, `%${words[1]}%`),
            ...conditions
          ))
          .limit(3);

        if (results.length === 1) {
          return { propertyId: results[0].id, address: results[0].address || '', confidence: 0.6, matchType: 'address_fuzzy' };
        }
      }
    }

    return null;
  }

  /**
   * Match available properties to a lead's preferences
   */
  async matchPropertiesToLead(leadPreferences: {
    leadType: string;
    budget?: number | null; // max budget in pence
    bedrooms?: number | null;
    areas?: string[] | null;
  }): Promise<{ propertyId: number; address: string; matchScore: number }[]> {
    const conditions = [];

    // Filter by listing type
    if (leadPreferences.leadType === 'rental' || leadPreferences.leadType === 'both') {
      conditions.push(eq(properties.isListedRental, true));
    } else if (leadPreferences.leadType === 'purchase') {
      conditions.push(eq(properties.isListedSale, true));
    }

    // Budget filter
    if (leadPreferences.budget) {
      if (leadPreferences.leadType === 'rental') {
        conditions.push(lte(properties.rentAmount, leadPreferences.budget));
      } else {
        conditions.push(lte(properties.price, leadPreferences.budget));
      }
    }

    // Bedrooms filter
    if (leadPreferences.bedrooms) {
      conditions.push(gte(properties.bedrooms, leadPreferences.bedrooms));
    }

    // Area/postcode filter
    if (leadPreferences.areas && leadPreferences.areas.length > 0) {
      const areaConditions = leadPreferences.areas.map(area =>
        or(
          ilike(properties.postcode, `${area}%`),
          ilike(properties.city, `%${area}%`),
          ilike(properties.address, `%${area}%`)
        )
      );
      conditions.push(or(...areaConditions.filter(Boolean) as any[]));
    }

    if (conditions.length === 0) return [];

    const results = await db.select({
      id: properties.id,
      address: properties.address,
    })
      .from(properties)
      .where(and(...conditions))
      .limit(20);

    return results.map((r, i) => ({
      propertyId: r.id,
      address: r.address || '',
      matchScore: Math.max(0.5, 1 - (i * 0.05)), // Simple scoring by result order
    }));
  }

  /**
   * Extract UK postcode from text
   */
  private extractPostcode(text: string): string | null {
    // UK postcode regex
    const match = text.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
    return match ? match[0].toUpperCase() : null;
  }

  /**
   * Clean address for matching (remove common noise words)
   */
  private cleanAddress(address: string): string {
    return address
      .replace(/,/g, ' ')
      .replace(/\b(flat|apartment|apt|unit|floor|suite|room)\b/gi, '')
      .replace(/\b(london|uk|united kingdom|england)\b/gi, '')
      .replace(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/gi, '') // Remove postcode
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const propertyMatchingService = new PropertyMatchingService();
