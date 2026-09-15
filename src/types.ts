export interface ChatImage {
  id: string;
  data: string; // base64 or data URL
  mimeType: string;
  name: string;
  size?: number;
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
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  model: string;
  enableThinking: boolean;
  systemInstruction?: string;
}

export interface PresetPrompt {
  id: string;
  category: string;
  title: string;
  description: string;
  prompt: string;
  enableThinking: boolean;
  model: "gemini-3.8-flash" | "gemini-3.6-flash" | "gemini-3.1-pro-preview";
  iconName: string;
}
