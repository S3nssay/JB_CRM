/**
 * Microsoft Graph OAuth Service
 *
 * Handles OAuth 2.0 Authorization Code Flow with PKCE for Microsoft 365 mailbox connections.
 * Provides token management, refresh, and validation.
 *
 * Required environment variables:
 * - MICROSOFT_CLIENT_ID: Azure AD app registration client ID
 * - MICROSOFT_CLIENT_SECRET: Azure AD app registration client secret
 * - MICROSOFT_TENANT_ID: Azure AD tenant ID (use 'common' for multi-tenant)
 * - BASE_URL: Application base URL for OAuth redirect
 * - EMAIL_TOKEN_ENCRYPTION_KEY: Encryption key for token storage
 */

import crypto from 'crypto';
import { encryptToken, decryptToken, generateSecureToken } from '../../lib/encryption';

// Microsoft identity platform endpoints
const MICROSOFT_AUTHORITY_BASE = 'https://login.microsoftonline.com';
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Required Microsoft Graph permissions (delegated)
export const REQUIRED_SCOPES = [
  'offline_access', // Required for refresh tokens
  'User.Read', // Read user profile
  'Mail.Read', // Read mailbox
  'Mail.ReadWrite', // Read and write to mailbox
  'Mail.Send', // Send mail as user
  'MailboxSettings.Read', // Read mailbox settings
];

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
  id_token?: string;
}

interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

interface AuthorizationResult {
  accessToken: string; // Encrypted
  refreshToken: string; // Encrypted
  expiresAt: Date;
  scopes: string[];
  tenantId: string;
  user: GraphUser;
}

interface OAuthState {
  userId: number;
  nonce: string;
  codeVerifier: string;
  timestamp: number;
}

// In-memory store for OAuth state (short-lived, cleared on completion)
// In production with multiple instances, use Redis or database
const pendingAuthStates = new Map<string, OAuthState>();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  for (const [key, state] of pendingAuthStates.entries()) {
    if (now - state.timestamp > maxAge) {
      pendingAuthStates.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Microsoft Graph OAuth Service
 */
export class GraphAuthService {
  private clientId: string;
  private clientSecret: string;
  private tenantId: string;
  private redirectUri: string;
  private isConfigured: boolean = false;

  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID || '';
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
    this.tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    this.redirectUri = `${baseUrl}/api/email-integration/oauth/callback`;

    this.isConfigured = !!(this.clientId && this.clientSecret);

    if (this.isConfigured) {
      console.log('Microsoft Graph OAuth service configured');
    } else {
      console.warn('Microsoft Graph OAuth service not configured - missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET');
    }
  }

  /**
   * Returns configuration status
   */
  getStatus(): { configured: boolean; redirectUri: string } {
    return {
      configured: this.isConfigured,
      redirectUri: this.redirectUri,
    };
  }

  /**
   * Generates PKCE code verifier and challenge
   */
  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = generateSecureToken(64);
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return { codeVerifier, codeChallenge };
  }

  /**
   * Generates the authorization URL for OAuth consent flow
   */
  generateAuthorizationUrl(userId: number): { url: string; state: string } {
    if (!this.isConfigured) {
      throw new Error('Microsoft Graph OAuth not configured');
    }

    const { codeVerifier, codeChallenge } = this.generatePKCE();
    const nonce = generateSecureToken(16);
    const state = generateSecureToken(32);

    // Store state for validation
    pendingAuthStates.set(state, {
      userId,
      nonce,
      codeVerifier,
      timestamp: Date.now(),
    });

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      response_mode: 'query',
      scope: REQUIRED_SCOPES.join(' '),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'consent', // Always show consent to ensure we get required permissions
    });

    const authorizeUrl = `${MICROSOFT_AUTHORITY_BASE}/${this.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;

    return { url: authorizeUrl, state };
  }

  /**
   * Exchanges authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    state: string
  ): Promise<AuthorizationResult> {
    if (!this.isConfigured) {
      throw new Error('Microsoft Graph OAuth not configured');
    }

    // Validate and retrieve state
    const storedState = pendingAuthStates.get(state);
    if (!storedState) {
      throw new Error('Invalid or expired OAuth state');
    }

    // Clean up state immediately
    pendingAuthStates.delete(state);

    // Check state age (max 10 minutes)
    if (Date.now() - storedState.timestamp > 10 * 60 * 1000) {
      throw new Error('OAuth state expired');
    }

    // Exchange code for tokens
    const tokenUrl = `${MICROSOFT_AUTHORITY_BASE}/${this.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: storedState.codeVerifier,
      scope: REQUIRED_SCOPES.join(' '),
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('Token exchange failed:', errorBody);
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokens: TokenResponse = await tokenResponse.json();

    if (!tokens.refresh_token) {
      throw new Error('No refresh token received - ensure offline_access scope is requested');
    }

    // Get user info to determine tenant and mailbox
    const userInfo = await this.getUserInfo(tokens.access_token);

    // Extract tenant ID from token (it's in the token claims)
    const tokenParts = tokens.access_token.split('.');
    const tokenPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const tenantId = tokenPayload.tid;

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    return {
      accessToken: encryptToken(tokens.access_token),
      refreshToken: encryptToken(tokens.refresh_token),
      expiresAt,
      scopes: tokens.scope.split(' '),
      tenantId,
      user: userInfo,
    };
  }

  /**
   * Retrieves user from stored state (for associating with CRM user after callback)
   */
  getUserIdFromState(state: string): number | null {
    const storedState = pendingAuthStates.get(state);
    return storedState?.userId || null;
  }

  /**
   * Refreshes an expired access token using the refresh token
   */
  async refreshAccessToken(
    encryptedRefreshToken: string,
    tenantId: string
  ): Promise<{
    accessToken: string; // Encrypted
    refreshToken: string; // Encrypted
    expiresAt: Date;
    scopes: string[];
  }> {
    if (!this.isConfigured) {
      throw new Error('Microsoft Graph OAuth not configured');
    }

    const refreshToken = decryptToken(encryptedRefreshToken);
    const tokenUrl = `${MICROSOFT_AUTHORITY_BASE}/${tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: REQUIRED_SCOPES.join(' '),
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Token refresh failed:', errorBody);

      // Check for specific error codes that indicate revocation
      if (response.status === 400 || response.status === 401) {
        throw new Error('REFRESH_TOKEN_REVOKED');
      }

      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const tokens: TokenResponse = await response.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    return {
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token
        ? encryptToken(tokens.refresh_token)
        : encryptedRefreshToken, // Microsoft may or may not return a new refresh token
      expiresAt,
      scopes: tokens.scope.split(' '),
    };
  }

  /**
   * Gets user profile information from Microsoft Graph
   */
  async getUserInfo(accessToken: string): Promise<GraphUser> {
    const response = await fetch(`${GRAPH_API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Gets a valid (non-expired) access token, refreshing if necessary
   */
  async getValidAccessToken(
    encryptedAccessToken: string,
    encryptedRefreshToken: string,
    tokenExpiresAt: Date,
    tenantId: string
  ): Promise<{
    accessToken: string; // Decrypted, ready to use
    needsUpdate: boolean; // If true, caller should update stored tokens
    newAccessToken?: string; // Encrypted new access token
    newRefreshToken?: string; // Encrypted new refresh token
    newExpiresAt?: Date;
  }> {
    // Check if token expires within 5 minutes
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    const needsRefresh = tokenExpiresAt.getTime() - Date.now() < expiryBuffer;

    if (!needsRefresh) {
      return {
        accessToken: decryptToken(encryptedAccessToken),
        needsUpdate: false,
      };
    }

    // Refresh the token
    const refreshed = await this.refreshAccessToken(encryptedRefreshToken, tenantId);

    return {
      accessToken: decryptToken(refreshed.accessToken),
      needsUpdate: true,
      newAccessToken: refreshed.accessToken,
      newRefreshToken: refreshed.refreshToken,
      newExpiresAt: refreshed.expiresAt,
    };
  }

  /**
   * Revokes tokens (disconnect mailbox)
   * Note: Microsoft doesn't have a simple token revocation endpoint,
   * so we just mark the connection as revoked in our database.
   */
  async revokeConnection(): Promise<void> {
    // Microsoft Graph doesn't have a token revocation endpoint.
    // The calling code should update the database to mark the connection as revoked.
    // Tokens will naturally expire and become invalid.
    console.log('Connection marked for revocation');
  }
}

// Export singleton instance
export const graphAuthService = new GraphAuthService();
