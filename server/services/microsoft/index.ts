/**
 * Microsoft Graph Services
 *
 * Exports all Microsoft Graph related services for OAuth and API access.
 */

export { graphAuthService, GraphAuthService, REQUIRED_SCOPES } from './graphAuthService';

export { createGraphClient, GraphApiClient } from './graphApiClient';
export type {
  GraphEmailAddress,
  GraphEmailBody,
  GraphAttachment,
  GraphMessage,
  GraphMessageList,
  GraphFolder,
  GraphSubscription,
  SendEmailOptions,
  CreateSubscriptionOptions,
} from './graphApiClient';
