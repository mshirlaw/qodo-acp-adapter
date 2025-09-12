import { ChildProcess } from 'child_process';

// ACP Protocol Types
// Based on https://agentclientprotocol.com

export interface ACPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: ACPError;
}

export interface ACPError {
  code: number;
  message: string;
  data?: any;
}

// Qodo-specific types
export interface QodoSession {
  id: string;
  threadId: string;
  process?: ChildProcess;
  buffer: string;
  isActive: boolean;
}
