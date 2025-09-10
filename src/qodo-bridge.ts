import { spawn } from 'child_process';
import { QodoSession } from './types';

export class QodoCommandBridge {
  private sessions: Map<string, QodoSession> = new Map();
  private debug: boolean;
  private qodoPath: string;

  constructor(options: { debug?: boolean; qodoPath?: string } = {}) {
    this.debug = options.debug || false;
    this.qodoPath = options.qodoPath || 'qodo';
  }

  async createSession(_metadata?: Record<string, any>): Promise<string> {
    const sessionId = `qodo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: QodoSession = {
      id: sessionId,
      threadId: sessionId,
      buffer: '',
      isActive: false,
      process: undefined,
    };

    this.sessions.set(sessionId, session);

    if (this.debug) {
      console.error(`[qodo-bridge] Created session: ${sessionId}`);
    }

    return sessionId;
  }

  async sendMessage(
    threadId: string,
    message: string,
    onProgress: (content: string) => void
  ): Promise<void> {
    const session = this.sessions.get(threadId);
    if (!session) {
      throw new Error(`Session not found: ${threadId}`);
    }

    return new Promise((resolve, reject) => {
      try {
        if (this.debug) {
          console.error(`[qodo-bridge] Running qodo command for session ${threadId}`);
          console.error(`[qodo-bridge] Message: ${message}`);
        }

        const qodoProcess = spawn(this.qodoPath, ['--ci', '-y', message], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            CI: 'true',
            NO_COLOR: '1',
            TERM: 'dumb',
          },
          cwd: process.cwd(), // Use current working directory
        });

        session.process = qodoProcess;
        session.isActive = true;

        let responseBuffer = '';
        let errorBuffer = '';
        let hasResponded = false;

        qodoProcess.stdout.on('data', (chunk) => {
          const text = chunk.toString();
          responseBuffer += text;

          if (this.debug) {
            console.error(`[qodo-bridge] stdout chunk: ${text}`);
          }

          onProgress(text);
          hasResponded = true;
        });

        qodoProcess.stderr.on('data', (chunk) => {
          const text = chunk.toString();
          errorBuffer += text;

          if (this.debug) {
            console.error(`[qodo-bridge] stderr: ${text}`);
          }
        });

        qodoProcess.on('exit', (code) => {
          session.isActive = false;
          session.process = undefined;

          if (this.debug) {
            console.error(`[qodo-bridge] Process exited with code ${code}`);
            console.error(`[qodo-bridge] Full response: ${responseBuffer}`);
            console.error(`[qodo-bridge] Full error: ${errorBuffer}`);
          }

          if (code === 0 || hasResponded) {
            resolve();
          } else {
            reject(
              new Error(
                `Qodo process exited with code ${code}: ${errorBuffer || 'No error message'}`
              )
            );
          }
        });

        qodoProcess.on('error', (error) => {
          console.error(`[qodo-bridge] Process error:`, error);
          reject(error);
        });
      } catch (error) {
        console.error(`[qodo-bridge] Error sending message:`, error);
        reject(error);
      }
    });
  }

  async stopGeneration(threadId: string): Promise<void> {
    const session = this.sessions.get(threadId);
    if (!session || !session.process) {
      return;
    }

    if (this.debug) {
      console.error(`[qodo-bridge] Stopping generation for session ${threadId}`);
    }

    if (session.process.stdin) {
      session.process.stdin.write('\x03');
    }

    setTimeout(() => {
      if (session.process && session.isActive) {
        session.process.kill('SIGTERM');
        session.isActive = false;
      }
    }, 1000);
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  async cleanup(): Promise<void> {
    if (this.debug) {
      console.error('[qodo-bridge] Cleaning up all sessions...');
    }
    for (const session of this.sessions.values()) {
      if (session.process && session.isActive) {
        session.process.kill('SIGTERM');
      }
    }

    this.sessions.clear();
  }
}
