import { fApiUrl } from '../api-url';
export const API_MODELS = {
  LIST: fApiUrl('/v1/models'),
  LOAD: fApiUrl('/models/load'),
  UNLOAD: fApiUrl('/models/unload'),
  SSE: fApiUrl('/models/sse')
};

// chat completion routes, the control route drives realtime inference (e.g. end reasoning)
export const API_CHAT = {
  COMPLETIONS: fApiUrl('./v1/chat/completions'),
  CONTROL: fApiUrl('./v1/chat/completions/control')
};

// slot introspection, requires the --slots flag on the server
export const API_SLOTS = {
  LIST: fApiUrl('./slots')
};

export const API_TOOLS = {
  LIST: fApiUrl('/tools'),
  EXECUTE: fApiUrl('/tools')
};

// resumable stream routes, the conv::model identity travels as the conv_id query param
// because model names can contain slashes that a path segment cannot carry
// resume retry cadence while the owning model is still loading (server answers 503)
export const STREAM_RESUME_RETRY_MS = 2000;

export const API_STREAM = {
  BASE: fApiUrl('./v1/stream'),
  LOOKUP: fApiUrl('./v1/streams/lookup')
};

/** CORS proxy endpoint path */
export const CORS_PROXY_ENDPOINT = fApiUrl('/cors-proxy');
