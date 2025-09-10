import { ACPResponse, ACPRequest } from './types';

/**
 * Creates a standardized "Server not initialized" error response
 * @param request The original request that triggered the error
 * @returns ACPResponse with the server not initialized error
 */
export function createServerNotInitializedError(request: ACPRequest): ACPResponse {
  return {
    jsonrpc: '2.0',
    id: request.id,
    error: {
      code: -32002,
      message: 'Server not initialized',
    },
  };
}

/**
 * Creates a standardized "Method not found" error response
 * @param request The original request that triggered the error
 * @param method The method that was not found
 * @returns ACPResponse with the method not found error
 */
export function createMethodNotFoundError(request: ACPRequest, method: string): ACPResponse {
  return {
    jsonrpc: '2.0',
    id: request.id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`,
    },
  };
}

/**
 * Creates a standardized "Internal error" response
 * @param request The original request that triggered the error
 * @param error The error that occurred
 * @returns ACPResponse with the internal error
 */
export function createInternalError(request: ACPRequest, error: unknown): ACPResponse {
  return {
    jsonrpc: '2.0',
    id: request.id,
    error: {
      code: -32603,
      message: 'Internal error',
      data: error instanceof Error ? error.message : String(error),
    },
  };
}
