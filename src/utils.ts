import { ACPResponse, ACPError } from './types';

/**
 * JSON-RPC error codes as defined in the specification
 */
export const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_NOT_INITIALIZED: -32002,
} as const;

/**
 * Creates a JSON-RPC error response
 * @param id - The request ID
 * @param code - The error code
 * @param message - The error message
 * @param data - Optional additional error data
 * @returns A properly formatted JSON-RPC error response
 */
export function createJsonRpcErrorResponse(
  id: string | number,
  code: number,
  message: string,
  data?: any
): ACPResponse {
  const error: ACPError = {
    code,
    message,
  };

  if (data !== undefined) {
    error.data = data;
  }

  return {
    jsonrpc: '2.0',
    id,
    error,
  };
}

/**
 * Creates a "Server not initialized" error response
 * @param id - The request ID
 * @returns A JSON-RPC error response for uninitialized server
 */
export function createServerNotInitializedError(id: string | number): ACPResponse {
  return createJsonRpcErrorResponse(
    id,
    JsonRpcErrorCodes.SERVER_NOT_INITIALIZED,
    'Server not initialized'
  );
}

/**
 * Creates a "Method not found" error response
 * @param id - The request ID
 * @param method - The method that was not found
 * @returns A JSON-RPC error response for unknown method
 */
export function createMethodNotFoundError(id: string | number, method: string): ACPResponse {
  return createJsonRpcErrorResponse(
    id,
    JsonRpcErrorCodes.METHOD_NOT_FOUND,
    `Method not found: ${method}`
  );
}

/**
 * Creates an "Internal error" response
 * @param id - The request ID
 * @param error - The error that occurred
 * @returns A JSON-RPC error response for internal errors
 */
export function createInternalError(id: string | number, error: unknown): ACPResponse {
  return createJsonRpcErrorResponse(
    id,
    JsonRpcErrorCodes.INTERNAL_ERROR,
    'Internal error',
    error instanceof Error ? error.message : String(error)
  );
}

/**
 * Creates a "Failed to stop generation" error response
 * @param id - The request ID
 * @param error - The error that occurred
 * @returns A JSON-RPC error response for stop generation failures
 */
export function createStopGenerationError(id: string | number, error: unknown): ACPResponse {
  return createJsonRpcErrorResponse(
    id,
    JsonRpcErrorCodes.INTERNAL_ERROR,
    'Failed to stop generation',
    error instanceof Error ? error.message : String(error)
  );
}
