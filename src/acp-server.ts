import * as readline from 'readline';
import {
  ACPRequest,
  ACPResponse,
  ACPNotification,
  InitializeResult,
  CreateThreadParams,
  SendMessageParams,
} from './types';
import { QodoCommandBridge } from './qodo-bridge';

const ProtocolMethods = {
  INITIALIZE: 'initialize',
  AGENT_INITIALIZE: 'agent/initialize',
  SESSION_NEW: 'session/new',
  CREATE_THREAD: 'createThread',
  AGENT_CREATE_THREAD: 'agent/createThread',
  SESSION_PROMPT: 'session/prompt',
  PROMPT: 'prompt',
  SEND_MESSAGE: 'sendMessage',
  AGENT_SEND_MESSAGE: 'agent/sendMessage',
  CANCEL: 'cancel',
  STOP_GENERATION: 'stopGeneration',
  AGENT_STOP_GENERATION: 'agent/stopGeneration',
  LIST_THREADS: 'listThreads',
  AGENT_LIST_THREADS: 'agent/listThreads',
};

export class ACPServer {
  private rl: readline.Interface;
  private bridge: QodoCommandBridge;
  private debug: boolean;
  private initialized = false;

  constructor(bridge: QodoCommandBridge, options: { debug?: boolean } = {}) {
    this.bridge = bridge;
    this.debug = options.debug || false;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.rl.on('line', (line) => {
      void this.handleMessage(line);
    });
  }

  async start() {
    if (this.debug) {
      console.error('[acp-server] Server started, waiting for messages...');
    }
  }

  async stop() {
    await this.bridge.cleanup();
    this.rl.close();
  }

  private async handleMessage(line: string) {
    try {
      const message = JSON.parse(line) as ACPRequest;

      if (this.debug) {
        console.error('[acp-server] Received:', JSON.stringify(message, null, 2));
      }

      let response: ACPResponse | null = null;

      switch (message.method) {
        case ProtocolMethods.INITIALIZE:
        case ProtocolMethods.AGENT_INITIALIZE:
          response = await this.handleInitialize(message);
          break;

        case ProtocolMethods.SESSION_NEW: // Zed uses this instead of createThread
        case ProtocolMethods.CREATE_THREAD:
        case ProtocolMethods.AGENT_CREATE_THREAD:
          response = await this.handleCreateThread(message);
          break;

        case ProtocolMethods.SESSION_PROMPT: // Zed uses this for sending messages
        case ProtocolMethods.PROMPT: // Alternative format
        case ProtocolMethods.SEND_MESSAGE:
        case ProtocolMethods.AGENT_SEND_MESSAGE:
          response = await this.handleSendMessage(message);
          break;

        case ProtocolMethods.CANCEL: // Zed might use this instead of stopGeneration
        case ProtocolMethods.STOP_GENERATION:
        case ProtocolMethods.AGENT_STOP_GENERATION:
          response = await this.handleStopGeneration(message);
          break;

        case ProtocolMethods.LIST_THREADS:
        case ProtocolMethods.AGENT_LIST_THREADS:
          response = await this.handleListThreads(message);
          break;

        default:
          response = {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32601,
              message: `Method not found: ${message.method}`,
            },
          };
      }

      if (response) {
        this.sendResponse(response);
      }
    } catch (error) {
      console.error('[acp-server] Error handling message:', error);
      try {
        const errorMessage = JSON.parse(line) as ACPRequest;
        this.sendResponse({
          jsonrpc: '2.0',
          id: errorMessage.id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : String(error),
          },
        });
      } catch {
        // Can't send error response
      }
    }
  }

  private async handleInitialize(request: ACPRequest): Promise<ACPResponse> {
    const result: InitializeResult = {
      protocolVersion: 1 as any, // Zed expects a number, not a string
      capabilities: {
        tools: true,
        followLinks: false,
        editOperations: true,
      },
      serverInfo: {
        name: 'qodo-acp-adapter',
        version: '0.1.0',
      },
    };

    this.initialized = true;

    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
    };
  }

  private async handleCreateThread(request: ACPRequest): Promise<ACPResponse> {
    if (!this.initialized) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32002,
          message: 'Server not initialized',
        },
      };
    }

    const params = request.params as CreateThreadParams;
    const sessionId = await this.bridge.createSession(params?.metadata);

    const result =
      request.method === ProtocolMethods.SESSION_NEW
        ? { sessionId, metadata: params?.metadata }
        : { threadId: sessionId, metadata: params?.metadata };

    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
    };
  }

  private async handleSendMessage(request: ACPRequest): Promise<ACPResponse> {
    if (!this.initialized) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32002,
          message: 'Server not initialized',
        },
      };
    }

    let params: any;
    let sessionId: string;

    if (
      request.method === ProtocolMethods.SESSION_PROMPT ||
      request.method === ProtocolMethods.PROMPT
    ) {
      params = request.params as any;
      sessionId = params.sessionId;
    } else {
      params = request.params as SendMessageParams;
      sessionId = params.threadId;
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (
      request.method === ProtocolMethods.SESSION_PROMPT ||
      request.method === ProtocolMethods.PROMPT
    ) {
      return this.processPromptSync(params, sessionId, request);
    } else {
      const initialResult = {
        messageId,
        role: 'assistant',
        content: [],
        metadata: {},
      };

      this.sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        result: initialResult,
      });

      void this.processMessageAsync(params, messageId, sessionId, request.method);

      return null!;
    }
  }

  private async processMessageAsync(
    params: any,
    messageId: string,
    sessionId: string,
    method: string
  ) {
    try {
      let textContent: string;

      if (method === ProtocolMethods.SESSION_PROMPT || method === ProtocolMethods.PROMPT) {
        textContent =
          params.prompt
            ?.map((p: any) => {
              if (typeof p === 'string') return p;
              if (p.type === 'text') return p.text;
              return '';
            })
            .join('\n') || '';
      } else {
        textContent =
          params.message?.content
            ?.filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n') || '';
      }

      // Set up progress callback
      const onProgress = (content: string) => {
        const notificationMethod =
          method === ProtocolMethods.SESSION_PROMPT || method === ProtocolMethods.PROMPT
            ? 'session/update' // Zed uses session/update for prompt methods
            : 'agent/progress';

        const progressNotification: ACPNotification = {
          jsonrpc: '2.0',
          method: notificationMethod,
          params: {
            sessionId: sessionId,
            threadId: sessionId, // Include both for compatibility
            messageId,
            delta: {
              content: [
                {
                  type: 'text',
                  text: content,
                },
              ],
            },
          } as any,
        };
        this.sendNotification(progressNotification);
      };

      await this.bridge.sendMessage(sessionId, textContent, onProgress);

      const completionNotification: ACPNotification = {
        jsonrpc: '2.0',
        method:
          method === ProtocolMethods.SESSION_PROMPT || method === ProtocolMethods.PROMPT
            ? 'session/update'
            : 'agent/progress',
        params: {
          sessionId: sessionId,
          threadId: sessionId,
          messageId,
          metadata: {
            status: 'complete',
          },
        } as any,
      };
      this.sendNotification(completionNotification);
    } catch (error) {
      console.error('[acp-server] Error processing message:', error);

      const errorNotification: ACPNotification = {
        jsonrpc: '2.0',
        method:
          method === ProtocolMethods.SESSION_PROMPT || method === ProtocolMethods.PROMPT
            ? 'session/update'
            : 'agent/progress',
        params: {
          sessionId: sessionId,
          threadId: sessionId,
          messageId,
          metadata: {
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          },
        } as any,
      };
      this.sendNotification(errorNotification);
    }
  }

  private async handleStopGeneration(request: ACPRequest): Promise<ACPResponse> {
    const params = request.params as { threadId: string };

    try {
      await this.bridge.stopGeneration(params.threadId);
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true },
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: 'Failed to stop generation',
          data: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private async handleListThreads(request: ACPRequest): Promise<ACPResponse> {
    const threads = this.bridge.listSessions();

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { threads },
    };
  }

  private sendResponse(response: ACPResponse) {
    const message = JSON.stringify(response);
    if (this.debug) {
      console.error('[acp-server] Sending response:', message);
    }
    console.log(message);
  }

  private sendNotification(notification: ACPNotification) {
    const message = JSON.stringify(notification);
    if (this.debug) {
      console.error('[acp-server] Sending notification:', message);
    }
    console.log(message);
  }

  private async processPromptSync(
    params: any,
    sessionId: string,
    request: ACPRequest
  ): Promise<ACPResponse> {
    try {
      const textContent =
        params.prompt
          ?.map((p: any) => {
            if (typeof p === 'string') return p;
            if (p.type === 'text') return p.text;
            return '';
          })
          .join('\n') || '';

      // We don't need to accumulate the response since we're streaming it
      const onProgress = (content: string) => {
        const progressNotification: ACPNotification = {
          jsonrpc: '2.0',
          method: 'session/update',
          params: {
            sessionId: sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: content,
              },
            },
          } as any,
        };
        this.sendNotification(progressNotification);
      };

      await this.bridge.sendMessage(sessionId, textContent, onProgress);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          stopReason: 'end_turn', // Indicates successful completion
        },
      };
    } catch (error) {
      console.error('[acp-server] Error in processPromptSync:', error);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          stopReason: 'error', // Indicates an error occurred
        },
      };
    }
  }
}
