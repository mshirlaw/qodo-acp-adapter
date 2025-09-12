#!/usr/bin/env node

// stdout is used to send messages to the client
// redirect as per Zed implementation for claude code
console.log = console.error;
console.info = console.error;
console.warn = console.error;
console.debug = console.error;

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

import { runAcp as runAcp } from './acp-agent';

runAcp();

// Keep process alive
process.stdin.resume();
