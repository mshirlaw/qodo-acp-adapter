import { describe, it, expect } from 'vitest';
import { QodoToolParser, formatToolCall, hasToolCallPattern } from '../src/tool-parser';

describe('Simple Tool Parser', () => {
  const parser = new QodoToolParser();

  it('should detect tool call patterns', () => {
    const withTool = `┌─ read_files
├── paths: test.ts
└─── ✓ ✓ Success: done`;

    const withoutTool = `Just regular text without any special patterns`;

    expect(hasToolCallPattern(withTool)).toBe(true);
    expect(hasToolCallPattern(withoutTool)).toBe(false);
  });

  it('should extract tool name from tool calls', () => {
    const input = `┌─ read_files
├── paths: package.json
└─── ✓ ✓ Success: File read successfully`;

    const result = parser.parseChunk(input);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('tool_call');
    expect(result[0].content).toMatchObject({
      type: 'tool_call',
      toolName: 'read_files',
      status: 'success',
    });
  });

  it('should return regular text as-is', () => {
    const input = `This is just regular text.
No tool calls here.
Just normal output from Qodo.`;

    const result = parser.parseChunk(input);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    expect(result[0].content).toBe(input);
  });

  it('should filter out tool parameters and results', () => {
    const input = `├── some parameter
└─── ✓ ✓ Success: something`;

    const result = parser.parseChunk(input);

    // Should be filtered out because it's part of tool output
    expect(result).toHaveLength(0);
  });

  it('should format tool calls simply', () => {
    const toolCall = {
      type: 'tool_call' as const,
      toolName: 'read_files',
      status: 'success' as const,
    };

    const formatted = formatToolCall(toolCall);

    expect(formatted).toBe('✅ Tool call: read_files\n');
  });
});
