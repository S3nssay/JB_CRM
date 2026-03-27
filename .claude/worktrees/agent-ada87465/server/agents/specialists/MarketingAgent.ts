/**
 * Marketing Agent
 * Manages social media, content creation, and marketing campaigns
 */

import { BaseAgent } from '../BaseAgent';
import { AgentTask, TaskContext, AgentConfig } from '../types';

export class MarketingAgent extends BaseAgent {
  constructor(customConfig?: Partial<AgentConfig>) {
    super({
      id: 'marketing',
      name: 'Marketing Agent',
      description: 'Manages all marketing activities including social media, content creation, email campaigns, and brand promotion.',
      enabled: true,
      handlesMessageTypes: ['general', 'lead'],
      handlesTaskTypes: ['post_to_social', 'create_listing', 'send_notification', 'general_response'],
      communicationChannels: ['email', 'social_media'],
      personality: 'Creative, brand-conscious, and data-driven. Expert at creating engaging property content and building John Barclay\'s premium brand presence.',
      tone: 'friendly',
      language: 'en-GB',
      workingHours: { start: '08:00', end: '18:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      responseDelaySeconds: 120, // Can take time for creative work
      maxConcurrentTasks: 10,
      ...customConfig,
    });
  }

  protected buildUserPrompt(task: AgentTask, context: TaskContext): string {
    return `
TASK: ${task.type}
Priority: ${task.priority}
Description: ${task.description}

${task.input.message ? `
REQUEST DETAILS:
${task.input.body}
` : ''}

${context.property ? `
PROPERTY FOR MARKETING:
Address: ${context.property.address}
Type: ${context.property.type}
Bedrooms: ${context.property.bedrooms}
Price: £${context.property.price.toLocaleString()}
Status: ${context.property.status}
Listing Type: ${context.property.listingType}
` : ''}

MARKETING AGENT GUIDELINES:

BRAND VOICE:
- Premium, sophisticated, trustworthy
- Local expertise with over 30 years in West London
- Personal service, not corporate
- Community-focused
- Data-driven insights

SOCIAL MEDIA STRATEGY:

INSTAGRAM:
- High-quality property photos
- Behind-the-scenes office content
- Local area highlights
- "Just Listed" and "Just Sold" posts
- Client testimonials
- Market insights in carousel format
Best posting times: 9am, 12pm, 6pm

FACEBOOK:
- Property listings with virtual tours
- Community events
- Local business partnerships
- Educational content for buyers/sellers
- Live Q&A sessions

LINKEDIN:
- Market analysis and trends
- Professional achievements
- Industry insights
- Recruitment posts
- Commercial property focus

TWITTER/X:
- Quick property updates
- Market news commentary
- Local event promotion
- Engage with local businesses

CONTENT TYPES:
1. Property Showcases: High-quality images, key features, price
2. Market Updates: Monthly stats, trend analysis
3. Area Guides: Schools, transport, amenities
4. Tips & Advice: Buying/selling/renting guides
5. Team Spotlights: Agent profiles, achievements
6. Client Stories: Success stories, testimonials
7. Behind the Scenes: Office life, property viewings

HASHTAG STRATEGY:
Primary: #JohnBarclay #WestLondonProperty #LondonEstateAgent
Area: #MaidaVale #W9 #NottingHill #W11 #KilburnProperty #NW6
Type: #LuxuryProperty #LondonHomes #PropertyForSale #PropertyToRent

Determine the best action and provide an appropriate response.
`;
  }

  /**
   * Generate social media post for a property
   */
  generatePropertyPost(
    platform: 'instagram' | 'facebook' | 'linkedin' | 'twitter',
    property: {
      address: string;
      postcode: string;
      type: string;
      bedrooms: number;
      bathrooms: number;
      price: number;
      listingType: 'sale' | 'rental';
      features: string[];
      description?: string;
    }
  ): {
    content: string;
    hashtags: string[];
    callToAction: string;
    suggestedImageCount: number;
    bestPostingTimes: string[];
  } {
    const area = this.getAreaFromPostcode(property.postcode);
    const priceFormatted = property.listingType === 'rental'
      ? `£${property.price.toLocaleString()} pcm`
      : `£${property.price.toLocaleString()}`;

    const platformContent: Record<typeof platform, { content: string; hashtags: string[]; cta: string; images: number }> = {
      instagram: {
        content: `✨ Just Listed in ${area} ✨

${property.bedrooms} Bed ${property.type} | ${priceFormatted}

${property.features.slice(0, 4).map(f => `🏠 ${f}`).join('\n')}

📍 ${property.postcode}

${property.listingType === 'sale' ? 'Ready for viewings this weekend!' : 'Available now - perfect for professionals!'}`,
        hashtags: [
          'JohnBarclay', 'WestLondonProperty', area.replace(/\s/g, ''),
          `${property.postcode.split(' ')[0]}Property`, 'LondonHomes',
          property.listingType === 'sale' ? 'PropertyForSale' : 'PropertyToRent',
          'LuxuryLiving', 'DreamHome', 'LondonLife'
        ],
        cta: 'DM us or click link in bio to book a viewing! 🏡',
        images: 5,
      },
      facebook: {
        content: `🏠 NEW LISTING: ${property.bedrooms} Bedroom ${property.type} in ${area}

${priceFormatted} | ${property.bedrooms} Beds | ${property.bathrooms} Baths

Key Features:
${property.features.map(f => `✓ ${f}`).join('\n')}

${property.description || `A stunning property in one of West London's most sought-after locations.`}

📍 ${property.address}

Contact us today to arrange a viewing:
📞 020 7624 6699
📧 info@johnbarclay.co.uk
🌐 www.johnbarclay.co.uk`,
        hashtags: ['JohnBarclay', 'WestLondonProperty', area.replace(/\s/g, '')],
        cta: 'Book your viewing today!',
        images: 8,
      },
      linkedin: {
        content: `New to Market: Premium ${property.type} in ${area}

We're pleased to present this exceptional ${property.bedrooms}-bedroom ${property.type.toLowerCase()} in ${area}, one of London's most prestigious neighbourhoods.

Investment Highlights:
• Location: ${property.postcode}
• Price: ${priceFormatted}
• Property Type: ${property.type}
• Bedrooms: ${property.bedrooms}

${property.features.slice(0, 3).map(f => `• ${f}`).join('\n')}

${property.listingType === 'sale'
  ? 'With strong capital growth in this area and high rental demand, this presents an excellent investment opportunity.'
  : 'An ideal property for corporate tenants or relocating professionals.'}

Contact our team for a private viewing or investment consultation.

#PropertyInvestment #LondonProperty #RealEstate #${area.replace(/\s/g, '')}`,
        hashtags: ['PropertyInvestment', 'LondonProperty', 'RealEstate', 'CommercialProperty'],
        cta: 'Contact us for investment opportunities',
        images: 3,
      },
      twitter: {
        content: `🏠 Just Listed: ${property.bedrooms}BR ${property.type} in ${area}
${priceFormatted}

${property.features.slice(0, 2).join(' | ')}

📍 ${property.postcode}
🔗 Link in bio for details`,
        hashtags: ['WestLondon', area.replace(/\s/g, ''), property.listingType === 'sale' ? 'PropertyForSale' : 'ToRent'],
        cta: 'DM for viewing',
        images: 4,
      },
    };

    const config = platformContent[platform];

    return {
      content: config.content,
      hashtags: config.hashtags,
      callToAction: config.cta,
      suggestedImageCount: config.images,
      bestPostingTimes: this.getBestPostingTimes(platform),
    };
  }

  /**
   * Get area name from postcode
   */
  private getAreaFromPostcode(postcode: string): string {
    const postcodePrefix = postcode.split(' ')[0].toUpperCase();

    const areas: Record<string, string> = {
      'W9': 'Maida Vale',
      'W10': 'North Kensington',
      'W11': 'Notting Hill',
      'NW6': 'Queen\'s Park',
      'NW10': 'Kensal Green',
      'W2': 'Bayswater',
      'NW8': 'St John\'s Wood',
    };

    return areas[postcodePrefix] || 'West London';
  }

  /**
   * Get best posting times for platform
   */
  private getBestPostingTimes(platform: string): string[] {
    const times: Record<string, string[]> = {
      instagram: ['09:00', '12:00', '18:00', '20:00'],
      facebook: ['09:00', '13:00', '16:00'],
      linkedin: ['08:00', '10:00', '17:00'],
      twitter: ['09:00', '12:00', '17:00', '21:00'],
    };

    return times[platform] || ['09:00', '12:00', '18:00'];
  }

  /**
   * Generate email campaign content
   */
  generateEmailCampaign(
    campaignType: 'new_listing' | 'price_reduction' | 'just_sold' | 'market_update' | 'newsletter',
    data: Record<string, any>
  ): {
    subject: string;
    preheader: string;
    headline: string;
    body: string;
    callToAction: { text: string; url: string };
    audienceSegment: string[];
  } {
    const campaigns: Record<typeof campaignType, ReturnType<MarketingAgent['generateEmailCampaign']>> = {
      new_listing: {
        subject: `New Property Alert: ${data.bedrooms} Bed ${data.type} in ${data.area}`,
        preheader: `Just listed at ${data.price} - Book your viewing today`,
        headline: `Introducing: ${data.address}`,
        body: `We're excited to share this stunning new listing with you.\n\n${data.description || 'A beautiful property in a prime location.'}\n\nKey Features:\n${(data.features || []).map((f: string) => `• ${f}`).join('\n')}`,
        callToAction: { text: 'Book a Viewing', url: `https://johnbarclay.co.uk/property/${data.id}` },
        audienceSegment: ['active_buyers', data.listingType === 'rental' ? 'tenants' : 'buyers'],
      },
      price_reduction: {
        subject: `Price Reduced: ${data.area} Property Now ${data.newPrice}`,
        preheader: `Save ${data.reduction} on this fantastic property`,
        headline: `Price Reduction Alert`,
        body: `Great news! The price on this property has been reduced.\n\nOriginal Price: ${data.oldPrice}\nNew Price: ${data.newPrice}\nSaving: ${data.reduction}\n\nDon't miss this opportunity!`,
        callToAction: { text: 'View Property', url: `https://johnbarclay.co.uk/property/${data.id}` },
        audienceSegment: ['price_sensitive_buyers', 'property_alerts'],
      },
      just_sold: {
        subject: `Just Sold: ${data.area} - Thinking of Selling?`,
        preheader: `We achieved ${data.percentOverAsking}% over asking price`,
        headline: `Another Successful Sale in ${data.area}`,
        body: `We're delighted to announce another successful sale in ${data.area}.\n\n📍 ${data.address}\n💰 Sold for ${data.soldPrice}\n⏱️ Time on market: ${data.daysOnMarket} days\n\nThinking of selling your property? Contact us for a free valuation.`,
        callToAction: { text: 'Get Your Free Valuation', url: 'https://johnbarclay.co.uk/valuation' },
        audienceSegment: ['potential_sellers', `${data.postcode}_residents`],
      },
      market_update: {
        subject: `${data.area} Property Market Update - ${data.month}`,
        preheader: `Average prices ${data.priceChange > 0 ? 'up' : 'down'} ${Math.abs(data.priceChange)}%`,
        headline: `${data.area} Market Report`,
        body: `Here's what's happening in the ${data.area} property market:\n\n📈 Average Price: ${data.averagePrice}\n📊 Price Change: ${data.priceChange > 0 ? '+' : ''}${data.priceChange}%\n🏠 Properties Sold: ${data.propertiesSold}\n⏱️ Average Time to Sell: ${data.averageDays} days\n\n${data.commentary}`,
        callToAction: { text: 'Download Full Report', url: 'https://johnbarclay.co.uk/market-report' },
        audienceSegment: ['all_subscribers', 'investors'],
      },
      newsletter: {
        subject: `John Barclay Newsletter - ${data.month}`,
        preheader: 'Property news, tips, and exclusive listings',
        headline: `Your Monthly Property Update`,
        body: `Welcome to our monthly newsletter!\n\n${data.introduction}\n\nFeatured Properties:\n${(data.featuredProperties || []).map((p: any) => `• ${p.address} - ${p.price}`).join('\n')}\n\n${data.marketInsight}\n\nTip of the Month:\n${data.tip}`,
        callToAction: { text: 'View All Properties', url: 'https://johnbarclay.co.uk/properties' },
        audienceSegment: ['newsletter_subscribers'],
      },
    };

    return campaigns[campaignType];
  }

  /**
   * Analyze marketing performance
   */
  analyzePerformance(metrics: {
    platform: string;
    impressions: number;
    engagements: number;
    clicks: number;
    followers: number;
    followerGrowth: number;
  }[]): {
    overallEngagementRate: number;
    bestPerformingPlatform: string;
    recommendations: string[];
    insights: string[];
  } {
    let totalImpressions = 0;
    let totalEngagements = 0;
    let bestPlatform = { name: '', rate: 0 };

    for (const m of metrics) {
      totalImpressions += m.impressions;
      totalEngagements += m.engagements;

      const rate = m.impressions > 0 ? (m.engagements / m.impressions) * 100 : 0;
      if (rate > bestPlatform.rate) {
        bestPlatform = { name: m.platform, rate };
      }
    }

    const overallEngagementRate = totalImpressions > 0
      ? (totalEngagements / totalImpressions) * 100
      : 0;

    const recommendations: string[] = [];
    const insights: string[] = [];

    // Generate recommendations based on performance
    if (overallEngagementRate < 2) {
      recommendations.push('Increase posting frequency with more engaging content');
      recommendations.push('Test different content formats (video, carousels)');
    } else if (overallEngagementRate < 5) {
      recommendations.push('Content is performing well - consider paid promotion');
    } else {
      recommendations.push('Excellent engagement - replicate successful content types');
    }

    for (const m of metrics) {
      const rate = m.impressions > 0 ? (m.engagements / m.impressions) * 100 : 0;
      if (rate < 1) {
        recommendations.push(`${m.platform}: Review content strategy and posting times`);
      }
      if (m.followerGrowth > 5) {
        insights.push(`${m.platform}: Strong follower growth (+${m.followerGrowth}%)`);
      }
    }

    return {
      overallEngagementRate: Math.round(overallEngagementRate * 100) / 100,
      bestPerformingPlatform: bestPlatform.name,
      recommendations,
      insights,
    };
  }
}

export const marketingAgent = new MarketingAgent();
