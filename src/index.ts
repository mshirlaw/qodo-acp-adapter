#!/usr/bin/env node

import { ACPServer } from './acp-server';
import { QodoCommandBridge } from './qodo-bridge';

async function main() {
  const debug = process.env.ACP_DEBUG === 'true';

  if (debug) {
    console.error('[qodo-acp] Starting Qodo ACP adapter...');
  }

  try {
    const qodoBridge = new QodoCommandBridge({
      debug,
      qodoPath: process.env.QODO_PATH || 'qodo',
    });

    const server = new ACPServer(qodoBridge, { debug });

    await server.start();

    process.on('SIGINT', async () => {
      if (debug) {
        console.error('[qodo-acp] Shutting down...');
      }
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      if (debug) {
        console.error('[qodo-acp] Shutting down...');
      }
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('[qodo-acp] Fatal error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[qodo-acp] Unhandled error:', error);
  process.exit(1);
});
