# TODO

## Type Safety Improvements

### High Priority
- [ ] Create proper TypeScript interfaces for all ACP protocol messages
- [ ] Define strict types for Qodo command responses
- [ ] Replace `any` types in message handlers with proper union types
- [ ] Add type guards for runtime type checking of JSON-RPC messages

### Medium Priority
- [ ] Re-enable TypeScript strict mode once types are defined
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
- [ ] Add unit tests with type checking

## Code Quality
- [ ] Refactor `handleMessage` method to reduce complexity (currently at 20, should be under 15)
- [ ] Consider splitting message handling into separate strategy classes

## Features
- [ ] Add support for more ACP protocol methods
- [ ] Implement proper session management
- [ ] Add configuration file support