export interface LmStudioMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LmStudioOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  /** External AbortSignal. Combined with the internal 30-second timeout signal. */
  signal?: AbortSignal
}

export interface LmStudioError extends Error {
  name: 'LmStudioError'
  code: 'connection_error' | 'timeout' | 'stream_error' | 'api_error'
  status?: number
}
