type ToolCall = {
  type: 'tool_call';
  toolName: string;
  parameters?: Record<string, any>;
  status: 'success' | 'error' | 'pending';
  result?: any;
};

type ParsedMessage = {
  type: 'text' | 'tool_call';
  content: string | ToolCall;
};

// List of known Qodo tool names
const KNOWN_TOOLS = [
  'read_files',
  'list_files',
  'list_files_in_directories',
  'directory_tree',
  'write_file',
  'create_file',
  'delete_file',
  'move_file',
  'get_current_directory',
  'search_files',
  'replace_in_file',
];

/**
 * This is a basic parser to parse Qodo chunks and determine which ones are tool calls.
 * There is a significant limitation as the Qodo stream from the command line interface does not distinguish between tool calls and tool results - they all just appear as messages
 * This means that all tool calls will be displayed as pending for now because we never know which tool call to update when it completes
 * Unless there are changes to the Qodo cli tool this limitation cannot be addressed here
 * TODO: can we work around this limitation
 */
export class QodoToolParser {
  parseChunk(text: string): ParsedMessage[] {
    for (const tool of KNOWN_TOOLS) {
      if (text.includes(`┌─ ${tool}`)) {
        const hasSuccess = text.includes('✓ ✓');
        const hasError = text.includes('✗ ✗');

        return [
          {
            type: 'tool_call',
            content: {
              type: 'tool_call',
              toolName: tool,
              status: hasSuccess ? 'success' : hasError ? 'error' : 'pending',
            },
          },
        ];
      }
    }

    if (text.includes('├──') || text.includes('└──')) {
      return [];
    }

    return [
      {
        type: 'text',
        content: text,
      },
    ];
  }
}

export function formatToolCall(toolCall: ToolCall): string {
  const statusEmoji =
    toolCall.status === 'success' ? '✅' : toolCall.status === 'error' ? '❌' : '⏳';

  return `${statusEmoji} Tool call: ${toolCall.toolName}\n`;
}

export function hasToolCallPattern(text: string): boolean {
  return KNOWN_TOOLS.some((tool) => text.includes(`┌─ ${tool}`));
}
