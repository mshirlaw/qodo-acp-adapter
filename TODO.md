# TODO

## Type Safety Improvements

### High Priority
- [x] ~~Create proper TypeScript interfaces for all ACP protocol messages~~ (Using @zed-industries/agent-client-protocol)
- [ ] Define strict types for Qodo command responses
- [ ] Replace `any` types in message handlers with proper union types
- [ ] Add type guards for runtime type checking of JSON-RPC messages

### Medium Priority
- [x] ~~Re-enable TypeScript strict mode once types are defined~~ (Already enabled in tsconfig.json)
- [ ] Re-enable the following ESLint rules:
  - `@typescript-eslint/no-explicit-any`
  - `@typescript-eslint/no-unsafe-assignment`
  - `@typescript-eslint/no-unsafe-member-access`
  - `@typescript-eslint/no-unsafe-call`
  - `@typescript-eslint/no-unsafe-argument`
  - `@typescript-eslint/no-unsafe-return`

### Low Priority
- [ ] Add JSDoc comments for all public methods
- [ ] Consider using a JSON-RPC library with built-in type safety
- [x] ~~Add unit tests with type checking~~ (Tests added in tests/acp-agent.test.ts)

## Code Quality
- [x] ~~Refactor `handleMessage` method to reduce complexity~~ (Refactored to use ACPAgent class with separate methods)
- [x] ~~Consider splitting message handling into separate strategy classes~~ (Implemented with ACPAgent and QodoCommandBridge separation)

## Features
- [x] ~~Add support for more ACP protocol methods~~ (Supports initialize, newSession, prompt, cancel)
- [x] ~~Implement proper session management~~ (Basic session management with UUID v7)
- [ ] Add configuration file support
- [ ] Implement loadSession method
- [ ] Implement authenticate method

## Known Limitations (from README)
- [ ] Address permissions model limitations (requires Qodo CLI changes)
- [ ] Add conversation context between messages (requires Qodo CLI changes)
- [ ] Support for interactive mode features
- [ ] Handle tool calls and MCP servers
- [ ] Support for file references and resources

## Testing
- [x] ~~Add unit tests for ACPAgent~~ (Comprehensive tests added)
- [ ] Add integration tests with actual Qodo CLI
- [ ] Add tests for QodoCommandBridge
- [ ] Add tests for error scenarios and edge cases
- [ ] Add performance tests for session handling

## Documentation
- [x] ~~Update README with current limitations~~ (Updated with permissions model section)
- [ ] Add API documentation
- [ ] Create examples directory with usage examples
- [ ] Add troubleshooting guide