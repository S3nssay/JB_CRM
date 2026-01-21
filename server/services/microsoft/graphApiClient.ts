/**
 * Microsoft Graph API Client
 *
 * Provides methods for interacting with Microsoft Graph API for email operations.
 * Handles sending, receiving, and managing emails through Microsoft 365 mailboxes.
 */

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Types for Graph API responses
export interface GraphEmailAddress {
  emailAddress: {
    name?: string;
    address: string;
  };
}

export interface GraphEmailBody {
  contentType: 'text' | 'html';
  content: string;
}

export interface GraphAttachment {
  '@odata.type': string;
  id?: string;
  name: string;
  contentType: string;
  size: number;
  isInline?: boolean;
  contentId?: string;
  contentBytes?: string; // Base64 encoded
}

export interface GraphMessage {
  id: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  receivedDateTime: string;
  sentDateTime?: string;
  hasAttachments: boolean;
  internetMessageId?: string;
  subject?: string;
  bodyPreview?: string;
  importance: 'low' | 'normal' | 'high';
  parentFolderId?: string;
  conversationId?: string;
  conversationIndex?: string;
  isDeliveryReceiptRequested?: boolean;
  isReadReceiptRequested?: boolean;
  isRead?: boolean;
  isDraft?: boolean;
  webLink?: string;
  inferenceClassification?: 'focused' | 'other';
  body?: GraphEmailBody;
  sender?: GraphEmailAddress;
  from?: GraphEmailAddress;
  toRecipients?: GraphEmailAddress[];
  ccRecipients?: GraphEmailAddress[];
  bccRecipients?: GraphEmailAddress[];
  replyTo?: GraphEmailAddress[];
  categories?: string[];
  attachments?: GraphAttachment[];
}

export interface GraphMessageList {
  '@odata.context': string;
  '@odata.nextLink'?: string;
  value: GraphMessage[];
}

export interface GraphFolder {
  id: string;
  displayName: string;
  parentFolderId?: string;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}

export interface GraphSubscription {
  id: string;
  resource: string;
  applicationId: string;
  changeType: string;
  clientState?: string;
  notificationUrl: string;
  expirationDateTime: string;
  creatorId?: string;
  latestSupportedTlsVersion?: string;
}

export interface SendEmailOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  importance?: 'low' | 'normal' | 'high';
  attachments?: {
    name: string;
    contentType: string;
    contentBytes: string; // Base64 encoded
  }[];
  replyTo?: string;
  saveToSentItems?: boolean;
}

export interface CreateSubscriptionOptions {
  resource: string;
  changeType: string;
  notificationUrl: string;
  expirationDateTime: Date;
  clientState: string;
}

/**
 * Microsoft Graph API Client
 */
export class GraphApiClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Makes an authenticated request to Graph API
   */
  private async graphRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorText;
      } catch {
        errorMessage = errorText;
      }

      throw new Error(`Graph API error (${response.status}): ${errorMessage}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // ==========================================
  // USER OPERATIONS
  // ==========================================

  /**
   * Gets the current user's profile
   */
  async getMe(): Promise<{ id: string; displayName: string; mail: string; userPrincipalName: string }> {
    return this.graphRequest('/me');
  }

  // ==========================================
  // EMAIL OPERATIONS
  // ==========================================

  /**
   * Gets messages from a folder (default: inbox)
   */
  async getMessages(options: {
    folderId?: string;
    top?: number;
    skip?: number;
    filter?: string;
    orderBy?: string;
    select?: string[];
  } = {}): Promise<GraphMessageList> {
    const {
      folderId = 'inbox',
      top = 50,
      skip = 0,
      filter,
      orderBy = 'receivedDateTime desc',
      select = [
        'id',
        'subject',
        'bodyPreview',
        'from',
        'toRecipients',
        'ccRecipients',
        'receivedDateTime',
        'sentDateTime',
        'hasAttachments',
        'importance',
        'isRead',
        'isDraft',
        'conversationId',
        'internetMessageId',
        'parentFolderId',
        'categories',
      ],
    } = options;

    const params = new URLSearchParams({
      $top: top.toString(),
      $skip: skip.toString(),
      $orderby: orderBy,
      $select: select.join(','),
    });

    if (filter) {
      params.set('$filter', filter);
    }

    return this.graphRequest(`/me/mailFolders/${folderId}/messages?${params.toString()}`);
  }

  /**
   * Gets a specific message by ID
   */
  async getMessage(messageId: string, includeBody: boolean = true): Promise<GraphMessage> {
    const select = [
      'id',
      'subject',
      'bodyPreview',
      'from',
      'sender',
      'toRecipients',
      'ccRecipients',
      'bccRecipients',
      'replyTo',
      'receivedDateTime',
      'sentDateTime',
      'hasAttachments',
      'importance',
      'isRead',
      'isDraft',
      'conversationId',
      'internetMessageId',
      'parentFolderId',
      'categories',
      'webLink',
    ];

    if (includeBody) {
      select.push('body');
    }

    return this.graphRequest(`/me/messages/${messageId}?$select=${select.join(',')}`);
  }

  /**
   * Gets attachments for a message
   */
  async getAttachments(messageId: string): Promise<{ value: GraphAttachment[] }> {
    return this.graphRequest(`/me/messages/${messageId}/attachments`);
  }

  /**
   * Gets a specific attachment with content
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<GraphAttachment> {
    return this.graphRequest(`/me/messages/${messageId}/attachments/${attachmentId}`);
  }

  /**
   * Sends an email
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    const message: any = {
      subject: options.subject,
      body: {
        contentType: options.bodyHtml ? 'html' : 'text',
        content: options.bodyHtml || options.bodyText || '',
      },
      toRecipients: options.to.map((email) => ({
        emailAddress: { address: email },
      })),
      importance: options.importance || 'normal',
    };

    if (options.cc?.length) {
      message.ccRecipients = options.cc.map((email) => ({
        emailAddress: { address: email },
      }));
    }

    if (options.bcc?.length) {
      message.bccRecipients = options.bcc.map((email) => ({
        emailAddress: { address: email },
      }));
    }

    if (options.replyTo) {
      message.replyTo = [{ emailAddress: { address: options.replyTo } }];
    }

    if (options.attachments?.length) {
      message.attachments = options.attachments.map((att) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.name,
        contentType: att.contentType,
        contentBytes: att.contentBytes,
      }));
    }

    await this.graphRequest('/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({
        message,
        saveToSentItems: options.saveToSentItems !== false,
      }),
    });
  }

  /**
   * Creates a draft message
   */
  async createDraft(options: SendEmailOptions): Promise<GraphMessage> {
    const message: any = {
      subject: options.subject,
      body: {
        contentType: options.bodyHtml ? 'html' : 'text',
        content: options.bodyHtml || options.bodyText || '',
      },
      toRecipients: options.to.map((email) => ({
        emailAddress: { address: email },
      })),
      importance: options.importance || 'normal',
    };

    if (options.cc?.length) {
      message.ccRecipients = options.cc.map((email) => ({
        emailAddress: { address: email },
      }));
    }

    if (options.bcc?.length) {
      message.bccRecipients = options.bcc.map((email) => ({
        emailAddress: { address: email },
      }));
    }

    return this.graphRequest('/me/messages', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  /**
   * Sends an existing draft message
   */
  async sendDraft(messageId: string): Promise<void> {
    await this.graphRequest(`/me/messages/${messageId}/send`, {
      method: 'POST',
    });
  }

  /**
   * Creates a reply to a message
   */
  async createReply(messageId: string, comment?: string): Promise<GraphMessage> {
    return this.graphRequest(`/me/messages/${messageId}/createReply`, {
      method: 'POST',
      body: JSON.stringify({ comment: comment || '' }),
    });
  }

  /**
   * Creates a reply-all to a message
   */
  async createReplyAll(messageId: string, comment?: string): Promise<GraphMessage> {
    return this.graphRequest(`/me/messages/${messageId}/createReplyAll`, {
      method: 'POST',
      body: JSON.stringify({ comment: comment || '' }),
    });
  }

  /**
   * Creates a forward of a message
   */
  async createForward(messageId: string, comment?: string): Promise<GraphMessage> {
    return this.graphRequest(`/me/messages/${messageId}/createForward`, {
      method: 'POST',
      body: JSON.stringify({ comment: comment || '' }),
    });
  }

  /**
   * Updates a message (e.g., mark as read)
   */
  async updateMessage(
    messageId: string,
    updates: { isRead?: boolean; categories?: string[]; importance?: string }
  ): Promise<GraphMessage> {
    return this.graphRequest(`/me/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Marks a message as read
   */
  async markAsRead(messageId: string): Promise<GraphMessage> {
    return this.updateMessage(messageId, { isRead: true });
  }

  /**
   * Marks a message as unread
   */
  async markAsUnread(messageId: string): Promise<GraphMessage> {
    return this.updateMessage(messageId, { isRead: false });
  }

  /**
   * Moves a message to a folder
   */
  async moveMessage(messageId: string, destinationFolderId: string): Promise<GraphMessage> {
    return this.graphRequest(`/me/messages/${messageId}/move`, {
      method: 'POST',
      body: JSON.stringify({ destinationId: destinationFolderId }),
    });
  }

  /**
   * Deletes a message (moves to deleted items)
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.graphRequest(`/me/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // FOLDER OPERATIONS
  // ==========================================

  /**
   * Gets mail folders
   */
  async getMailFolders(): Promise<{ value: GraphFolder[] }> {
    return this.graphRequest('/me/mailFolders?$top=100');
  }

  /**
   * Gets a specific folder
   */
  async getMailFolder(folderId: string): Promise<GraphFolder> {
    return this.graphRequest(`/me/mailFolders/${folderId}`);
  }

  /**
   * Gets well-known folder IDs
   */
  async getWellKnownFolders(): Promise<{
    inbox: string;
    drafts: string;
    sentItems: string;
    deletedItems: string;
    junkEmail: string;
  }> {
    const wellKnownFolderNames = ['inbox', 'drafts', 'sentitems', 'deleteditems', 'junkemail'];
    const folders: any = {};

    for (const name of wellKnownFolderNames) {
      try {
        const folder = await this.graphRequest<GraphFolder>(`/me/mailFolders/${name}`);
        const key = name === 'sentitems' ? 'sentItems' :
                    name === 'deleteditems' ? 'deletedItems' :
                    name === 'junkemail' ? 'junkEmail' : name;
        folders[key] = folder.id;
      } catch (error) {
        console.warn(`Could not get folder ${name}:`, error);
      }
    }

    return folders;
  }

  // ==========================================
  // SUBSCRIPTION OPERATIONS (Webhooks)
  // ==========================================

  /**
   * Creates a webhook subscription for mail changes
   */
  async createSubscription(options: CreateSubscriptionOptions): Promise<GraphSubscription> {
    return this.graphRequest('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        changeType: options.changeType,
        notificationUrl: options.notificationUrl,
        resource: options.resource,
        expirationDateTime: options.expirationDateTime.toISOString(),
        clientState: options.clientState,
      }),
    });
  }

  /**
   * Updates (renews) a subscription
   */
  async updateSubscription(
    subscriptionId: string,
    expirationDateTime: Date
  ): Promise<GraphSubscription> {
    return this.graphRequest(`/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        expirationDateTime: expirationDateTime.toISOString(),
      }),
    });
  }

  /**
   * Deletes a subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    await this.graphRequest(`/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Gets a subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<GraphSubscription> {
    return this.graphRequest(`/subscriptions/${subscriptionId}`);
  }

  /**
   * Lists all subscriptions
   */
  async listSubscriptions(): Promise<{ value: GraphSubscription[] }> {
    return this.graphRequest('/subscriptions');
  }

  // ==========================================
  // SEARCH OPERATIONS
  // ==========================================

  /**
   * Searches messages
   */
  async searchMessages(query: string, top: number = 25): Promise<GraphMessageList> {
    const params = new URLSearchParams({
      $search: `"${query}"`,
      $top: top.toString(),
      $select: 'id,subject,bodyPreview,from,receivedDateTime,hasAttachments,importance,isRead',
    });

    return this.graphRequest(`/me/messages?${params.toString()}`);
  }
}

/**
 * Creates a Graph API client with the given access token
 */
export function createGraphClient(accessToken: string): GraphApiClient {
  return new GraphApiClient(accessToken);
}
