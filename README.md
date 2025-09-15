# Qodo ACP Adapter

[![Test](https://github.com/mshirlaw/qodo-acp-adapter/actions/workflows/test.yml/badge.svg)](https://github.com/mshirlaw/qodo-acp-adapter/actions/workflows/test.yml)
[![CI](https://github.com/mshirlaw/qodo-acp-adapter/actions/workflows/ci.yml/badge.svg)](https://github.com/mshirlaw/qodo-acp-adapter/actions/workflows/ci.yml)

An experimental ACP (Agent Client Protocol) adapter for Qodo Command, allowing it to work with Zed editor and other ACP-compatible clients.

## ⚠️ Experimental Status

This is a proof-of-concept implementation showing how to create an ACP adapter for a CLI tool that wasn't designed for programmatic interaction. While functional, it has significant limitations due to the mismatch between Qodo Command's terminal-based design and ACP's programmatic requirements.

Below is a screenshot showing the Qodo ACP Adapter in action within the Zed editor.

<img src="img/489346040-5099ee1e-bcfe-4f7f-91d8-cf87763bb202.jpg" alt="Qodo ACP Adapter Example" width="400" />

## Architecture

This adapter implements the Agent Client Protocol to bridge between:

- **ACP Clients** (like Zed editor) that speak JSON-RPC over stdio
- **Qodo Command** CLI tool that expects terminal interaction

### Key Components

1. **`index.ts`** - Entry point that sets up the server and handles process lifecycle
2. **`acp-agent.ts`** - Implements the ACP protocol, handling JSON-RPC messages with UUID v7 session IDs
3. **`qodo-bridge.ts`** - Manages Qodo Command subprocess with hardcoded permissions (`--permissions=rw --tools=filesystem`)
4. **`tool-parser.ts`** - Filters out verbose tool call output to keep messages clean (see Tool Output Filtering below)
5. **`types.ts`** - TypeScript type definitions for ACP protocol and session management
6. **`utils.ts`** - Utility functions for stream conversion between Node.js and Web streams

## How It Works

1. **Initialization**: When Zed starts the adapter, it sends an `initialize` request which returns agent capabilities
2. **Session Creation**: Each conversation creates a new session via `session/new` using UUID v7 for unique IDs
3. **Message Handling**: User messages are sent via `session/prompt` with text content extraction
4. **Qodo Integration**: The bridge spawns `qodo --ci --permissions=rw --tools=filesystem <prompt>` for each message
5. **Progress Updates**: Qodo's stdout is streamed back as `session/update` notifications in real-time
6. **Error Handling**: Both stdout and stderr are captured for proper error reporting

### Protocol Translation

The adapter handles the differences between Zed's ACP implementation and the standard protocol:

- `initialize` → Standard initialization with agent capabilities (supports images and embedded context)
- `session/new` → Creates a new conversation session using UUID v7 (returns `sessionId`)
- `session/prompt` → Sends a message and waits for completion (returns `stopReason`)
- `session/update` → Progress notifications during message processing
- `cancel` → Attempts to stop ongoing generation for a session

## Installation

```bash
# Clone this repository
git clone https://github.com/mshirlaw/qodo-acp-adapter.git
cd qodo-acp-adapter

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

## Usage in Zed

Add to your Zed `settings.json`:

```json
{
  "agent_servers": {
    "Qodo Command": {
      "command": "node",
      "args": ["/full/path/to/qodo-acp-adapter/dist/index.js"],
      "env": {
        "QODO_PATH": "/usr/local/bin/qodo" // Custom qodo path if needed (optional)
      }
    }
  }
}
```

**Note**: Make sure to use the full absolute path to the adapter's `dist/index.js` file.

## Tool Output Filtering

Qodo Command outputs verbose tool call information that clutters the conversation in ACP clients. The adapter includes a `QodoToolParser` that filters this output to keep messages clean.

### What It Does

The parser identifies Qodo's tool call patterns and:

1. **Detects tool calls** by looking for known tool names after `┌─` markers
2. **Shows just the tool name** with a status icon (✅ for success, ❌ for error, ⏳ for pending)
3. **Filters out all parameters and results** that appear in `├──` and `└──` lines
4. **Preserves regular text** between tool calls

### Example

**Before (Raw Qodo Output):**

```
┌─ read_files
├── paths: package.json,README.md
└─── ✓ ✓ Success: [{"path": "package.json", "content": "..."}]
```

**After (Filtered Output):**

```
✅ Tool call: read_files
```

### Supported Tools

The parser currently recognizes these Qodo tools:

- `read_files`
- `list_files`
- `list_files_in_directories`
- `directory_tree`
- `write_file`
- `create_file`
- `delete_file`
- `move_file`
- `get_current_directory`
- `search_files`
- `replace_in_file`

To add support for new tools, simply add the tool name to the `KNOWN_TOOLS` array in `tool-parser.ts`.

### Limitations

The tool parser is a simple filter that operates on streaming text chunks. It cannot:

- Maintain state between chunks (each chunk is processed independently)
- Parse complex multi-line tool outputs that span multiple chunks
- Distinguish between actual tool calls and similar-looking text patterns
- Provide detailed information about tool parameters or results

This is a workaround for the verbose output from Qodo's CLI mode. A proper solution would require Qodo to support a structured output format or ACP natively.

## Current Limitations

Due to the fundamental mismatch between Qodo Command's terminal-based design and ACP's programmatic requirements:

### Permissions Model Limitations

**Critical Issue**: It is currently difficult to implement a valid permissions model due to limitations in the Qodo command line tool. Each new request from the user is sent to Qodo as a completely new request with no history or context. The CLI tool does not provide:

- A way to maintain session state between invocations
- Mechanisms to request permissions from the client during execution
- Support for interactive permission prompts when running in CI mode
- Ability to remember previously granted permissions within a conversation

This means that permissions must be pre-configured (e.g., `--permissions=rw --tools=filesystem`) and cannot be dynamically requested or managed during the conversation flow.

### Functional Limitations

1. **No Conversation Context**: Each message runs as an independent `qodo --ci` command, so there's no memory between messages. Qodo won't remember previous questions or answers within a session. Every user request is treated as a new, isolated interaction.

2. **Terminal UI Issues**: Qodo Command uses Ink (React for terminals) which requires raw mode input. This doesn't work when running as a subprocess with piped stdio, forcing us to use CI mode which has limited functionality.

3. **Limited Feature Set**: Many Qodo features that require interactive mode (like the chat interface, real-time updates, and interactive prompts) don't work in CI mode.

4. **No Session Persistence**: While we track sessions in the adapter, Qodo itself doesn't maintain state between command invocations.

5. **Authentication**: Assumes Qodo is already authenticated via `qodo login`. The adapter cannot handle authentication flows.

### Technical Limitations

1. **Response Completion**: The adapter waits for the process to exit to determine when Qodo has finished responding, which may not capture streaming responses properly.

2. **Error Recovery**: Basic error handling that may not gracefully recover from all failure scenarios.

3. **Tool Integration**: Doesn't handle Qodo's tool calls, MCP servers, or special slash commands.

4. **Resource Handling**: Cannot properly handle file references, images, or other resources that might be part of the conversation.

5. **Performance**: Each message spawns a new process, which has overhead and prevents efficient resource reuse.

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Type checking
npm run typecheck

# Build for production
npm run build

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Linting and formatting
npm run lint
npm run lint:fix
npm run format
npm run format:check

# Spell checking
npm run spell
npm run spell:fix
```

## Error Handling

Error logs are written to stderr and include:

- Incoming ACP messages
- Qodo process management
- Message routing
- Response streaming

## Suggested Improvements

### Short-term Improvements (Workarounds)

1. **Context Injection**: Prepend a summary of previous messages to each new prompt to simulate conversation memory:

   ```javascript
   const context = previousMessages.join('\n');
   const fullPrompt = `Previous context:\n${context}\n\nCurrent question: ${message}`;
   ```

2. **Response Caching**: Store previous Q&A pairs and include relevant ones in new prompts to maintain some context.

3. **Better Process Management**: Implement a process pool to reuse Qodo processes where possible, reducing startup overhead.

4. **Output Parsing**: Parse Qodo's output to extract structured responses, code blocks, and tool calls.

5. **Timeout Configuration**: Make the response timeout configurable based on expected prompt complexity.

### Long-term Solutions (Ideal)

1. **Native ACP Support in Qodo**: The best solution would be for Qodo Command to implement ACP support directly, similar to how Gemini CLI did. This would involve:
   - Adding an `--acp` flag to run in ACP server mode
   - Implementing proper session management
   - Supporting streaming responses over JSON-RPC
   - Handling tool calls and resources properly

2. **Qodo API Mode**: If Qodo provided a programmatic API or SDK (similar to Claude's SDK), the adapter could use that instead of the CLI:

   ```javascript
   import { QodoClient } from '@qodo/sdk';
   const client = new QodoClient({ apiKey: process.env.QODO_API_KEY });
   ```

3. **Alternative Protocol Support**: Qodo could implement MCP (Model Context Protocol) server mode, which it already partially supports, making it easier to integrate with various clients.

4. **Headless Mode**: A headless mode for Qodo that doesn't require terminal UI but maintains session state would solve most current issues:
   ```bash
   qodo --headless --session-id=xxx
   ```

### For Qodo Team Consideration

If you're from the Qodo team or want to request these features:

1. **Issue to Open**: "Add ACP (Agent Client Protocol) support for editor integration"
2. **Key Points to Mention**:
   - Growing adoption of ACP in editors (Zed, potentially VS Code)
   - Need for programmatic access without terminal UI
   - Session persistence across multiple prompts
   - Streaming response support
3. **Reference Implementations**:
   - [Gemini CLI's ACP implementation](https://github.com/google-gemini/gemini-cli)
   - [Claude Code ACP adapter](https://github.com/zed-industries/claude-code-acp)

## References

- [Agent Client Protocol Specification](https://agentclientprotocol.com)
- [Claude Code ACP Adapter](https://github.com/zed-industries/claude-code-acp) - Reference implementation
- [Qodo Command Documentation](https://docs.qodo.ai/qodo-documentation/qodo-command)
- [UUID v7 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-uuidrev-rfc4122bis) - Used for session ID generation

## License

MIT - See [LICENSE](LICENSE) file for details

## Contributing

This is an experimental proof-of-concept. Feel free to fork and improve!
