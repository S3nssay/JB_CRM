import OpenAI from "openai";

const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

let openaiClient: OpenAI | null = null;

if (apiKey) {
  openaiClient = new OpenAI({ 
    apiKey,
    baseURL: baseURL || undefined
  });
} else {
  console.warn("OpenAI API key not configured - AI features will be unavailable");
}

export function isOpenAIConfigured(): boolean {
  return openaiClient !== null;
}

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    throw new Error("OpenAI not configured - please set OPENAI_API_KEY environment variable");
  }
  return openaiClient;
}

export { openaiClient };
