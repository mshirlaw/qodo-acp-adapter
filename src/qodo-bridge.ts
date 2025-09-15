import { spawn } from 'child_process';
import { QodoSession } from './types';

export class QodoCommandBridge {
  private sessions: Map<string, QodoSession> = new Map();
  private qodoPath: string;

  constructor(options: { qodoPath?: string } = {}) {
    this.qodoPath = options.qodoPath || 'qodo';
  }

  async createSession(metadata?: Record<string, any>): Promise<string> {
    const sessionId =
      metadata?.sessionId ?? `qodo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: QodoSession = {
      id: sessionId,
      threadId: sessionId,
      buffer: '',
      isActive: false,
      process: undefined,
    };

    this.sessions.set(sessionId, session);

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
        const qodoProcess = spawn(
          this.qodoPath,
          ['--ci', '--permissions=rw', '--tools=filesystem', message],
          {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
              ...process.env,
              CI: 'true',
              NO_COLOR: '1',
              TERM: 'dumb',
            },
            cwd: process.cwd(), // Use current working directory
          }
        );

        session.process = qodoProcess;
        session.isActive = true;

        let errorBuffer = '';
        let hasResponded = false;

        qodoProcess.stdout.on('data', (chunk) => {
          const text = chunk.toString();

          onProgress(text);
          hasResponded = true;
        });

        qodoProcess.stderr.on('data', (chunk) => {
          const text = chunk.toString();
          errorBuffer += text;
        });

        qodoProcess.on('exit', (code) => {
          session.isActive = false;
          session.process = undefined;

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
    for (const session of this.sessions.values()) {
      if (session.process && session.isActive) {
        session.process.kill('SIGTERM');
      }
    }

    this.sessions.clear();
  }
}
