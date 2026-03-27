import crypto from 'crypto';

// DocuSign OAuth Configuration (Authorization Code Grant)
interface DocuSignOAuthConfig {
  integrationKey: string;      // Client ID
  secretKey: string;           // Client Secret
  redirectUri: string;
  environment: 'demo' | 'production';
}

// Stored tokens for the authenticated user
interface DocuSignTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  accountId: string;
  baseUri: string;
  userName: string;
  email: string;
}

interface EnvelopeRecipient {
  email: string;
  name: string;
  recipientId: string;
  routingOrder?: string;
  tabs?: {
    signHereTabs?: Array<{
      documentId: string;
      pageNumber: string;
      xPosition: string;
      yPosition: string;
    }>;
    dateSignedTabs?: Array<{
      documentId: string;
      pageNumber: string;
      xPosition: string;
      yPosition: string;
    }>;
    textTabs?: Array<{
      documentId: string;
      pageNumber: string;
      xPosition: string;
      yPosition: string;
      tabLabel: string;
      value?: string;
    }>;
  };
}

interface EnvelopeDocument {
  documentBase64: string;
  name: string;
  fileExtension: string;
  documentId: string;
}

interface CreateEnvelopeRequest {
  emailSubject: string;
  emailBlurb?: string;
  documents: EnvelopeDocument[];
  recipients: {
    signers: EnvelopeRecipient[];
    carbonCopies?: EnvelopeRecipient[];
  };
  status: 'created' | 'sent';
}

interface EnvelopeStatus {
  envelopeId: string;
  status: string;
  statusChangedDateTime: string;
  recipients?: {
    signers: Array<{
      email: string;
      name: string;
      status: string;
      signedDateTime?: string;
    }>;
  };
}

// Legacy interfaces for backwards compatibility
interface DocuSignEnvelope {
  envelopeId: string;
  status: 'created' | 'sent' | 'delivered' | 'signed' | 'completed' | 'voided';
  documents: DocuSignDocument[];
  recipients: DocuSignRecipient[];
  createdAt: Date;
  sentAt?: Date;
  completedAt?: Date;
}

interface DocuSignDocument {
  documentId: string;
  name: string;
  fileType: string;
  content?: string;
}

interface DocuSignRecipient {
  recipientId: string;
  email: string;
  name: string;
  role: 'vendor' | 'buyer' | 'agent' | 'witness';
  signatureStatus: 'pending' | 'sent' | 'viewed' | 'signed';
  signedAt?: Date;
}

class DocuSignService {
  private config: DocuSignOAuthConfig | null = null;
  private tokens: DocuSignTokens | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
    const secretKey = process.env.DOCUSIGN_SECRET_KEY;
    const environment = (process.env.DOCUSIGN_ENVIRONMENT || 'demo') as 'demo' | 'production';
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

    if (integrationKey && secretKey) {
      this.config = {
        integrationKey,
        secretKey,
        redirectUri: `${baseUrl}/api/crm/docusign/callback`,
        environment,
      };
      console.log('DocuSign OAuth configured');
    }
  }

  private getOAuthBaseUrl(): string {
    return this.config?.environment === 'production'
      ? 'https://account.docusign.com'
      : 'https://account-d.docusign.com';
  }

  private getApiBaseUrl(): string {
    // Use stored baseUri from user info, or default
    if (this.tokens?.baseUri) {
      return this.tokens.baseUri;
    }
    return this.config?.environment === 'production'
      ? 'https://eu.docusign.net/restapi'
      : 'https://demo.docusign.net/restapi';
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  isAuthenticated(): boolean {
    if (!this.tokens) return false;
    // Check if token is expired (with 5 min buffer)
    return new Date() < new Date(this.tokens.expiresAt.getTime() - 5 * 60 * 1000);
  }

  getConfiguration(): {
    configured: boolean;
    authenticated: boolean;
    accountId?: string;
    environment?: string;
    userName?: string;
    email?: string;
  } {
    return {
      configured: this.isConfigured(),
      authenticated: this.isAuthenticated(),
      accountId: this.tokens?.accountId,
      environment: this.config?.environment,
      userName: this.tokens?.userName,
      email: this.tokens?.email,
    };
  }

  // Generate OAuth authorization URL
  getAuthorizationUrl(state?: string): string {
    if (!this.config) {
      throw new Error('DocuSign not configured');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      scope: 'signature extended',
      client_id: this.config.integrationKey,
      redirect_uri: this.config.redirectUri,
      state: state || crypto.randomBytes(16).toString('hex'),
    });

    return `${this.getOAuthBaseUrl()}/oauth/auth?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  async handleCallback(code: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'DocuSign not configured' };
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch(`${this.getOAuthBaseUrl()}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.integrationKey}:${this.config.secretKey}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.config.redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error('DocuSign token exchange failed:', error);
        return { success: false, error: 'Failed to exchange authorization code' };
      }

      const tokenData = await tokenResponse.json();

      // Get user info to find account ID and base URI
      const userInfoResponse = await fetch(`${this.getOAuthBaseUrl()}/oauth/userinfo`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        return { success: false, error: 'Failed to get user info' };
      }

      const userInfo = await userInfoResponse.json();
      const account = userInfo.accounts?.[0]; // Use first/default account

      if (!account) {
        return { success: false, error: 'No DocuSign account found' };
      }

      // Store tokens
      this.tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        accountId: account.account_id,
        baseUri: account.base_uri,
        userName: userInfo.name,
        email: userInfo.email,
      };

      console.log(`DocuSign authenticated: ${userInfo.name} (${userInfo.email})`);
      return { success: true };

    } catch (error) {
      console.error('DocuSign OAuth error:', error);
      return { success: false, error: 'OAuth authentication failed' };
    }
  }

  // Refresh access token
  private async refreshAccessToken(): Promise<boolean> {
    if (!this.config || !this.tokens?.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.getOAuthBaseUrl()}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.integrationKey}:${this.config.secretKey}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.tokens.refreshToken,
        }),
      });

      if (!response.ok) {
        console.error('Token refresh failed');
        return false;
      }

      const data = await response.json();
      this.tokens.accessToken = data.access_token;
      this.tokens.refreshToken = data.refresh_token;
      this.tokens.expiresAt = new Date(Date.now() + data.expires_in * 1000);

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  // Ensure we have a valid access token
  private async ensureValidToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('Not authenticated with DocuSign. Please connect your account first.');
    }

    // Refresh if expired or expiring soon
    if (new Date() >= new Date(this.tokens.expiresAt.getTime() - 5 * 60 * 1000)) {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        throw new Error('DocuSign session expired. Please reconnect your account.');
      }
    }

    return this.tokens.accessToken;
  }

  // Disconnect DocuSign account
  disconnect(): void {
    this.tokens = null;
    console.log('DocuSign disconnected');
  }

  // Make authenticated API request
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.ensureValidToken();
    const url = `${this.getApiBaseUrl()}/v2.1/accounts/${this.tokens!.accountId}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DocuSign API error: ${response.status} - ${error}`);
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  // ============================================
  // ENVELOPE MANAGEMENT
  // ============================================

  // Create and send an envelope for signature
  async createEnvelope(request: CreateEnvelopeRequest): Promise<{ envelopeId: string; status: string; uri: string }> {
    const envelope = {
      emailSubject: request.emailSubject,
      emailBlurb: request.emailBlurb || 'Please sign this document.',
      documents: request.documents,
      recipients: request.recipients,
      status: request.status,
    };

    const result = await this.makeRequest('/envelopes', {
      method: 'POST',
      body: JSON.stringify(envelope),
    });

    return {
      envelopeId: result.envelopeId,
      status: result.status,
      uri: result.uri,
    };
  }

  // Get envelope status
  async getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus> {
    return this.makeRequest(`/envelopes/${envelopeId}?include=recipients`);
  }

  // Get signing URL for embedded signing
  async getSigningUrl(envelopeId: string, recipientEmail: string, recipientName: string, returnUrl: string): Promise<string> {
    const result = await this.makeRequest(`/envelopes/${envelopeId}/views/recipient`, {
      method: 'POST',
      body: JSON.stringify({
        email: recipientEmail,
        userName: recipientName,
        returnUrl: returnUrl,
        authenticationMethod: 'none',
      }),
    });

    return result.url;
  }

  // Void an envelope
  async voidEnvelope(envelopeId: string, voidReason: string): Promise<void> {
    await this.makeRequest(`/envelopes/${envelopeId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'voided',
        voidedReason: voidReason,
      }),
    });
  }

  // Download signed documents
  async downloadDocument(envelopeId: string, documentId: string = 'combined'): Promise<Buffer> {
    const token = await this.ensureValidToken();
    const url = `${this.getApiBaseUrl()}/v2.1/accounts/${this.tokens!.accountId}/envelopes/${envelopeId}/documents/${documentId}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // List recent envelopes
  async listEnvelopes(options: {
    fromDate?: string;
    status?: string;
    count?: number;
  } = {}): Promise<Array<{ envelopeId: string; status: string; emailSubject: string; sentDateTime: string }>> {
    const params = new URLSearchParams();
    if (options.fromDate) params.append('from_date', options.fromDate);
    if (options.status) params.append('status', options.status);
    if (options.count) params.append('count', options.count.toString());

    const result = await this.makeRequest(`/envelopes?${params.toString()}`);
    return result.envelopes || [];
  }

  // Send signature reminder
  async sendReminder(envelopeId: string): Promise<boolean> {
    try {
      await this.makeRequest(`/envelopes/${envelopeId}?resend_envelope=true`, {
        method: 'PUT',
        body: JSON.stringify({}),
      });
      return true;
    } catch (error) {
      console.error('Error sending reminder:', error);
      return false;
    }
  }

  // ============================================
  // ESTATE AGENCY SPECIFIC METHODS
  // ============================================

  // Send tenancy agreement for signature
  async sendTenancyAgreement(params: {
    tenantEmail: string;
    tenantName: string;
    landlordEmail: string;
    landlordName: string;
    propertyAddress: string;
    monthlyRent: number;
    depositAmount: number;
    startDate: string;
    endDate: string;
    documentBase64: string;
  }): Promise<{ envelopeId: string; status: string }> {
    return this.createEnvelope({
      emailSubject: `Tenancy Agreement - ${params.propertyAddress}`,
      emailBlurb: `Please review and sign the tenancy agreement for ${params.propertyAddress}. Monthly rent: £${params.monthlyRent}, Deposit: £${params.depositAmount}.`,
      documents: [{
        documentBase64: params.documentBase64,
        name: 'Tenancy Agreement',
        fileExtension: 'pdf',
        documentId: '1',
      }],
      recipients: {
        signers: [
          {
            email: params.tenantEmail,
            name: params.tenantName,
            recipientId: '1',
            routingOrder: '1',
            tabs: {
              signHereTabs: [{ documentId: '1', pageNumber: '1', xPosition: '100', yPosition: '700' }],
              dateSignedTabs: [{ documentId: '1', pageNumber: '1', xPosition: '300', yPosition: '700' }],
            },
          },
          {
            email: params.landlordEmail,
            name: params.landlordName,
            recipientId: '2',
            routingOrder: '2',
            tabs: {
              signHereTabs: [{ documentId: '1', pageNumber: '1', xPosition: '100', yPosition: '750' }],
              dateSignedTabs: [{ documentId: '1', pageNumber: '1', xPosition: '300', yPosition: '750' }],
            },
          },
        ],
      },
      status: 'sent',
    });
  }

  // Send sales contract for signature
  async sendSalesContract(params: {
    buyerEmail: string;
    buyerName: string;
    sellerEmail: string;
    sellerName: string;
    propertyAddress: string;
    purchasePrice: number;
    completionDate: string;
    documentBase64: string;
  }): Promise<{ envelopeId: string; status: string }> {
    return this.createEnvelope({
      emailSubject: `Sales Contract - ${params.propertyAddress}`,
      emailBlurb: `Please review and sign the sales contract for ${params.propertyAddress}. Purchase price: £${params.purchasePrice.toLocaleString()}.`,
      documents: [{
        documentBase64: params.documentBase64,
        name: 'Sales Contract',
        fileExtension: 'pdf',
        documentId: '1',
      }],
      recipients: {
        signers: [
          {
            email: params.buyerEmail,
            name: params.buyerName,
            recipientId: '1',
            routingOrder: '1',
            tabs: {
              signHereTabs: [{ documentId: '1', pageNumber: '1', xPosition: '100', yPosition: '700' }],
              dateSignedTabs: [{ documentId: '1', pageNumber: '1', xPosition: '300', yPosition: '700' }],
            },
          },
          {
            email: params.sellerEmail,
            name: params.sellerName,
            recipientId: '2',
            routingOrder: '2',
            tabs: {
              signHereTabs: [{ documentId: '1', pageNumber: '1', xPosition: '100', yPosition: '750' }],
              dateSignedTabs: [{ documentId: '1', pageNumber: '1', xPosition: '300', yPosition: '750' }],
            },
          },
        ],
      },
      status: 'sent',
    });
  }

  // Send property management agreement
  async sendManagementAgreement(params: {
    landlordEmail: string;
    landlordName: string;
    propertyAddress: string;
    managementFeePercent: number;
    documentBase64: string;
  }): Promise<{ envelopeId: string; status: string }> {
    return this.createEnvelope({
      emailSubject: `Property Management Agreement - ${params.propertyAddress}`,
      emailBlurb: `Please review and sign the property management agreement for ${params.propertyAddress}. Management fee: ${params.managementFeePercent}% of monthly rent.`,
      documents: [{
        documentBase64: params.documentBase64,
        name: 'Property Management Agreement',
        fileExtension: 'pdf',
        documentId: '1',
      }],
      recipients: {
        signers: [
          {
            email: params.landlordEmail,
            name: params.landlordName,
            recipientId: '1',
            routingOrder: '1',
            tabs: {
              signHereTabs: [{ documentId: '1', pageNumber: '1', xPosition: '100', yPosition: '700' }],
              dateSignedTabs: [{ documentId: '1', pageNumber: '1', xPosition: '300', yPosition: '700' }],
            },
          },
        ],
      },
      status: 'sent',
    });
  }

  // ============================================
  // DOCUMENT GENERATION (Templates)
  // ============================================

  generateSalesContract(propertyData: any, buyerData: any, vendorData: any): string {
    return `
MEMORANDUM OF SALE
===================

Property: ${propertyData.addressLine1}, ${propertyData.postcode}
Sale Price: £${(propertyData.agreedPrice / 100).toLocaleString()}

VENDOR DETAILS:
Name: ${vendorData.name}
Address: ${vendorData.address}
Solicitor: ${vendorData.solicitor || 'To be confirmed'}

PURCHASER DETAILS:
Name: ${buyerData.name}
Address: ${buyerData.address}
Solicitor: ${buyerData.solicitor || 'To be confirmed'}

ESTATE AGENT:
John Barclay Estate & Management
Address: 123 High Street, London W9
Contact: 020 1234 5678

FIXTURES & FITTINGS:
As per attached schedule

COMPLETION DATE:
${propertyData.completionDate || 'To be agreed'}

SPECIAL CONDITIONS:
${propertyData.specialConditions || 'None'}

This memorandum is subject to contract and without prejudice.

Date: ${new Date().toLocaleDateString()}
    `;
  }

  generateTenancyAgreement(propertyData: any, tenantData: any, landlordData: any): string {
    return `
ASSURED SHORTHOLD TENANCY AGREEMENT
====================================

PROPERTY: ${propertyData.addressLine1}, ${propertyData.postcode}

LANDLORD: ${landlordData.name}
TENANT(S): ${tenantData.name}

TERM: ${propertyData.tenancyTerm || '12 months'}
START DATE: ${propertyData.startDate}
RENT: £${(propertyData.monthlyRent / 100).toLocaleString()} per month
DEPOSIT: £${(propertyData.deposit / 100).toLocaleString()}

PAYMENT DETAILS:
Rent is payable monthly in advance
First payment due: ${propertyData.firstPaymentDate}
Payment method: ${propertyData.paymentMethod || 'Standing order'}

TENANT OBLIGATIONS:
1. Pay rent on time
2. Keep property in good condition
3. Not cause nuisance to neighbors
4. Allow landlord access for inspections (24 hours notice)
5. Not sublet without permission

LANDLORD OBLIGATIONS:
1. Maintain structure and exterior
2. Keep installations in working order
3. Provide EPC, Gas Safety Certificate
4. Protect deposit in approved scheme

TERMINATION:
Either party may terminate by giving 2 months written notice

SIGNATURES:
Landlord: ___________________ Date: ___________
Tenant: ____________________ Date: ___________
Witness: ___________________ Date: ___________

This agreement is legally binding once signed.
    `;
  }

  generateInstructionLetter(propertyData: any, vendorData: any): string {
    return `
SOLE AGENCY INSTRUCTION
=======================

Date: ${new Date().toLocaleDateString()}

Dear ${vendorData.name},

We are pleased to confirm your instruction to market your property:

PROPERTY DETAILS:
Address: ${propertyData.addressLine1}, ${propertyData.postcode}
Type: ${propertyData.propertyType}
Bedrooms: ${propertyData.bedrooms}
Asking Price: £${(propertyData.askingPrice / 100).toLocaleString()}

TERMS OF INSTRUCTION:
Agency Type: Sole Agency
Commission: ${propertyData.commissionRate || '1.5%'} + VAT
Minimum Fee: ${propertyData.minimumFee || '£1,500'} + VAT
Period: ${propertyData.instructionPeriod || '12 weeks'}

MARKETING INCLUDES:
- Professional photography
- Floor plans and EPC
- Rightmove and Zoopla listing
- Social media promotion
- Accompanied viewings
- Negotiation of offers
- Sales progression

VENDOR OBLIGATIONS:
- Provide accurate property information
- Allow reasonable access for viewings
- Maintain property in presentable condition
- Inform us of any changes

Please sign and return one copy to confirm your acceptance.

Yours sincerely,
John Barclay Estate & Management

ACCEPTANCE:
I/We accept the terms of this instruction

Signature: ___________________ Date: ___________
Print Name: ___________________
    `;
  }
}

export const docuSignService = new DocuSignService();

export {
  DocuSignService,
  DocuSignEnvelope,
  DocuSignDocument,
  DocuSignRecipient
};
