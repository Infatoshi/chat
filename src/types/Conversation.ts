export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastResponseTime: string; // ISO string
  model: string;
  systemPrompt: string;
} 