// ACP Protocol Types
// Based on https://agentclientprotocol.com

export interface ACPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface ACPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: ACPError;
}

export interface ACPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export interface ACPError {
  code: number;
  message: string;
  data?: any;
}

// Agent Protocol Methods
export interface InitializeParams {
  protocolVersion: string;
  capabilities?: {
    experimental?: Record<string, any>;
  };
  clientInfo?: {
    name: string;
    version?: string;
  };
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: boolean;
    followLinks?: boolean;
    editOperations?: boolean;
  };
  serverInfo?: {
    name: string;
    version?: string;
  };
}

export interface CreateThreadParams {
  metadata?: Record<string, any>;
}

export interface CreateThreadResult {
  threadId: string;
  metadata?: Record<string, any>;
}

export interface SendMessageParams {
  threadId: string;
  message: {
    role: 'user' | 'assistant';
    content: MessageContent[];
  };
  metadata?: Record<string, any>;
}

export type MessageContent = TextContent | ImageContent | ResourceContent;

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string; // base64
  mimeType: string;
}

export interface ResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
  };
}

export interface SendMessageResult {
  messageId: string;
  role: 'assistant';
  content: MessageContent[];
  metadata?: Record<string, any>;
}

// Progress notifications
export interface ProgressParams {
  threadId: string;
  messageId: string;
  delta?: {
    content?: MessageContent[];
  };
  metadata?: Record<string, any>;
}

// Tool-related types
export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface ToolResult {
  toolCallId: string;
  result: any;
  isError?: boolean;
}

// Qodo-specific types
export interface QodoSession {
  id: string;
  threadId: string;
  process?: any; // Child process
  buffer: string;
  isActive: boolean;
}
