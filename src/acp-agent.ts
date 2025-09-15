import {
  Agent,
  AgentSideConnection,
  AuthenticateRequest,
  CancelNotification,
  ClientCapabilities,
  InitializeRequest,
  InitializeResponse,
  LoadSessionRequest,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
} from '@zed-industries/agent-client-protocol';

import { QodoCommandBridge } from './qodo-bridge';
import { v7 as uuidv7 } from 'uuid';
import { nodeToWebReadable, nodeToWebWritable } from './utils';

type Session = {
  cancelled: boolean;
};

export class ACPAgent implements Agent {
  client: AgentSideConnection;
  bridge: QodoCommandBridge;
  clientCapabilities?: ClientCapabilities;
  sessions: {
    [key: string]: Session;
  };

  constructor(client: AgentSideConnection) {
    this.client = client;
    this.bridge = new QodoCommandBridge();
    this.sessions = {};
  }

  async initialize(request: InitializeRequest): Promise<InitializeResponse> {
    this.clientCapabilities = request.clientCapabilities;
    return {
      protocolVersion: 1,
      agentCapabilities: {
        promptCapabilities: {
          image: true,
          embeddedContext: true,
        },
      },
      authMethods: [
        {
          description: 'Run `qodo` in the terminal',
          name: 'Log in with Qodo Command',
          id: 'qodo-login',
        },
      ],
    };
  }

  async newSession(_params: NewSessionRequest): Promise<NewSessionResponse> {
    const sessionId = uuidv7();

    this.sessions[sessionId] = {
      cancelled: false,
    };

    await this.bridge.createSession({ sessionId });

    return {
      sessionId,
    };
  }

  loadSession?(_params: LoadSessionRequest): Promise<void> {
    throw new Error('Method not implemented.');
  }

  authenticate(_params: AuthenticateRequest): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    console.error(`[acp-server] Received prompt for session: ${params.sessionId}`);

    if (!this.sessions[params.sessionId]) {
      console.error(`[acp-server] Session not found: ${params.sessionId}`);
      throw new Error('Session not found');
    }

    this.sessions[params.sessionId].cancelled = false;

    try {
      const textContent =
        params.prompt
          ?.map((p) => {
            if (p.type === 'text') {
              return p.text;
            }
            return '';
          })
          .join('\n') || '';

      console.error(`[acp-server] Extracted text content: ${textContent}`);

      const onProgress = async (content: string) => {
        console.error(`[acp-server] Progress update: ${content}`);
        await this.client.sessionUpdate({
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'text',
              text: content,
            },
          },
        });
      };

      console.error(`[acp-server] Calling bridge.sendMessage...`);
      await this.bridge.sendMessage(params.sessionId, textContent, onProgress);
      console.error(`[acp-server] Bridge.sendMessage completed successfully`);

      return {
        stopReason: 'end_turn',
      };
    } catch (error) {
      console.error('[acp-server] Error in prompt:', error);
      console.error(
        '[acp-server] Error stack:',
        error instanceof Error ? error.stack : 'No stack trace'
      );

      await this.client.sessionUpdate({
        sessionId: params.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'text',
            text: `${error}`,
          },
        },
      });

      return {
        stopReason: 'end_turn',
      };
    }
  }

  async cancel(params: CancelNotification): Promise<void> {
    if (this.sessions[params.sessionId]) {
      this.sessions[params.sessionId].cancelled = true;
      await this.bridge.stopGeneration(params.sessionId);
    }
  }
}

export function runAcp() {
  new AgentSideConnection(
    (client) => new ACPAgent(client),
    nodeToWebWritable(process.stdout),
    nodeToWebReadable(process.stdin)
  );
}
