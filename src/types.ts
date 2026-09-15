export interface ChatImage {
  id: string;
  data: string; // base64 or data URL or text
  mimeType: string;
  name: string;
  size?: number;
  fileType?: "image" | "pdf" | "code" | "text";
  textContent?: string;
}

export type ChatAttachment = ChatImage;

export interface GroundingChunk {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  thoughtProcess?: string;
  images?: ChatImage[];
  timestamp: number;
  modelUsed?: string;
  fallbackReason?: string;
  isStreaming?: boolean;
  error?: boolean;
  groundingSources?: GroundingChunk[];
  webSearchQueries?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  model: string;
  enableThinking: boolean;
  enableSearch?: boolean;
  systemInstruction?: string;
  userId?: string;
}

export interface PresetPrompt {
  id: string;
  category: string;
  title: string;
  description: string;
  prompt: string;
  enableThinking: boolean;
  model: "gemini-3.6-flash";
  iconName: string;
}

export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
  token?: string;
  isGoogleAccount?: boolean;
}
