import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ACPAgent } from '../src/acp-agent';
import { QodoCommandBridge } from '../src/qodo-bridge';
import {
  InitializeRequest,
  NewSessionRequest,
  PromptRequest,
  CancelNotification,
} from '@zed-industries/agent-client-protocol';

vi.mock('../src/qodo-bridge');
vi.mock('uuid', () => ({
  v7: vi.fn(() => 'test-uuid-123'),
}));

describe('ACPAgent', () => {
  let mockClient: any;
  let mockBridge: any;
  let agent: ACPAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      sessionUpdate: vi.fn().mockResolvedValue(undefined),
    };

    mockBridge = {
      createSession: vi.fn().mockResolvedValue('session-123'),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopGeneration: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(QodoCommandBridge).mockImplementation(() => mockBridge);

    agent = new ACPAgent(mockClient);
  });

  describe('constructor', () => {
    it('should initialize with client and create bridge', () => {
      expect(agent.client).toBe(mockClient);
      expect(agent.bridge).toBe(mockBridge);
      expect(agent.sessions).toEqual({});
      expect(QodoCommandBridge).toHaveBeenCalledWith({ debug: true });
    });
  });

  describe('initialize', () => {
    it('should return proper initialization response', async () => {
      const request: InitializeRequest = {
        protocolVersion: 1,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
        },
      };

      const response = await agent.initialize(request);

      expect(agent.clientCapabilities).toEqual(request.clientCapabilities);
      expect(response).toEqual({
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
      });
    });

    it('should store client capabilities', async () => {
      const request: InitializeRequest = {
        protocolVersion: 1,
        clientCapabilities: {
          fs: {
            readTextFile: false,
            writeTextFile: false,
          },
        },
      };

      await agent.initialize(request);

      expect(agent.clientCapabilities).toEqual(request.clientCapabilities);
    });
  });

  describe('newSession', () => {
    it('should create a new session with generated UUID', async () => {
      const request: NewSessionRequest = {
        cwd: '/test/path',
        mcpServers: [],
      };

      const response = await agent.newSession(request);

      expect(response.sessionId).toBe('test-uuid-123');
      expect(agent.sessions['test-uuid-123']).toEqual({
        cancelled: false,
      });
      expect(mockBridge.createSession).toHaveBeenCalledWith({
        sessionId: 'test-uuid-123',
      });
    });

    it('should handle multiple sessions', async () => {
      const request: NewSessionRequest = {
        cwd: '/test/path',
        mcpServers: [],
      };

      const response1 = await agent.newSession(request);
      const response2 = await agent.newSession(request);

      expect(response1.sessionId).toBe('test-uuid-123');
      expect(response2.sessionId).toBe('test-uuid-123');
      expect(Object.keys(agent.sessions).length).toBe(1);
      expect(mockBridge.createSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('prompt', () => {
    beforeEach(async () => {
      await agent.newSession({ cwd: '/', mcpServers: [] });
    });

    it('should handle text prompt successfully', async () => {
      const request: PromptRequest = {
        sessionId: 'test-uuid-123',
        prompt: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: 'World' },
        ],
      };

      const response = await agent.prompt(request);

      expect(mockBridge.sendMessage).toHaveBeenCalledWith(
        'test-uuid-123',
        'Hello\nWorld',
        expect.any(Function)
      );
      expect(response).toEqual({
        stopReason: 'end_turn',
      });
    });

    it('should handle empty prompt', async () => {
      const request: PromptRequest = {
        sessionId: 'test-uuid-123',
        prompt: [],
      };

      const response = await agent.prompt(request);

      expect(mockBridge.sendMessage).toHaveBeenCalledWith(
        'test-uuid-123',
        '',
        expect.any(Function)
      );
      expect(response).toEqual({
        stopReason: 'end_turn',
      });
    });

    it('should handle progress updates', async () => {
      const request: PromptRequest = {
        sessionId: 'test-uuid-123',
        prompt: [{ type: 'text', text: 'Test message' }],
      };

      mockBridge.sendMessage.mockImplementation(
        async (sessionId: string, message: string, onProgress: (content: string) => void) => {
          onProgress('Progress update 1');
          onProgress('Progress update 2');
        }
      );

      await agent.prompt(request);

      expect(mockClient.sessionUpdate).toHaveBeenCalledTimes(2);
      expect(mockClient.sessionUpdate).toHaveBeenNthCalledWith(1, {
        sessionId: 'test-uuid-123',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'text',
            text: 'Progress update 1',
          },
        },
      });
      expect(mockClient.sessionUpdate).toHaveBeenNthCalledWith(2, {
        sessionId: 'test-uuid-123',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'text',
            text: 'Progress update 2',
          },
        },
      });
    });

    it('should throw error for non-existent session', async () => {
      const request: PromptRequest = {
        sessionId: 'non-existent',
        prompt: [{ type: 'text', text: 'Test' }],
      };

      await expect(agent.prompt(request)).rejects.toThrow('Session not found');
    });

    it('should handle errors from bridge.sendMessage', async () => {
      const request: PromptRequest = {
        sessionId: 'test-uuid-123',
        prompt: [{ type: 'text', text: 'Test' }],
      };

      const testError = new Error('Bridge error');
      mockBridge.sendMessage.mockRejectedValue(testError);

      const response = await agent.prompt(request);

      expect(mockClient.sessionUpdate).toHaveBeenCalledWith({
        sessionId: 'test-uuid-123',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'text',
            text: 'Error: Bridge error',
          },
        },
      });
      expect(response).toEqual({
        stopReason: 'end_turn',
      });
    });

    it('should reset cancelled flag on new prompt', async () => {
      agent.sessions['test-uuid-123'].cancelled = true;

      const request: PromptRequest = {
        sessionId: 'test-uuid-123',
        prompt: [{ type: 'text', text: 'Test' }],
      };

      await agent.prompt(request);

      expect(agent.sessions['test-uuid-123'].cancelled).toBe(false);
    });

    it('should filter out non-text prompt items', async () => {
      const request: PromptRequest = {
        sessionId: 'test-uuid-123',
        prompt: [
          { type: 'text', text: 'Text 1' },
          { type: 'image', data: 'base64data', mimeType: 'image/png' } as any,
          { type: 'text', text: 'Text 2' },
        ],
      };

      await agent.prompt(request);

      expect(mockBridge.sendMessage).toHaveBeenCalledWith(
        'test-uuid-123',
        'Text 1\n\nText 2',
        expect.any(Function)
      );
    });
  });

  describe('cancel', () => {
    beforeEach(async () => {
      await agent.newSession({ cwd: '/', mcpServers: [] });
    });

    it('should cancel an active session', async () => {
      const params: CancelNotification = {
        sessionId: 'test-uuid-123',
      };

      await agent.cancel(params);

      expect(agent.sessions['test-uuid-123'].cancelled).toBe(true);
      expect(mockBridge.stopGeneration).toHaveBeenCalledWith('test-uuid-123');
    });

    it('should handle cancel for non-existent session', async () => {
      const params: CancelNotification = {
        sessionId: 'non-existent',
      };

      const result = await agent.cancel(params);
      expect(result).toBeUndefined();
      expect(mockBridge.stopGeneration).not.toHaveBeenCalled();
    });

    it('should handle multiple cancellations', async () => {
      const params: CancelNotification = {
        sessionId: 'test-uuid-123',
      };

      await agent.cancel(params);
      await agent.cancel(params);

      expect(agent.sessions['test-uuid-123'].cancelled).toBe(true);
      expect(mockBridge.stopGeneration).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should log errors to console.error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await agent.newSession({ cwd: '/', mcpServers: [] });

      const request: PromptRequest = {
        sessionId: 'test-uuid-123',
        prompt: [{ type: 'text', text: 'Test' }],
      };

      const testError = new Error('Test error');
      mockBridge.sendMessage.mockRejectedValue(testError);

      await agent.prompt(request);

      expect(consoleSpy).toHaveBeenCalledWith('[acp-server] Error in prompt:', testError);
      expect(consoleSpy).toHaveBeenCalledWith('[acp-server] Error stack:', testError.stack);

      consoleSpy.mockRestore();
    });

    it('should handle non-Error objects in catch block', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await agent.newSession({ cwd: '/', mcpServers: [] });

      const request: PromptRequest = {
        sessionId: 'test-uuid-123',
        prompt: [{ type: 'text', text: 'Test' }],
      };

      mockBridge.sendMessage.mockRejectedValue('String error');

      await agent.prompt(request);

      expect(consoleSpy).toHaveBeenCalledWith('[acp-server] Error in prompt:', 'String error');
      expect(consoleSpy).toHaveBeenCalledWith('[acp-server] Error stack:', 'No stack trace');

      consoleSpy.mockRestore();
    });
  });
});
