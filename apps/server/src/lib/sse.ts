/**
 * Shared SSE (Server-Sent Events) utilities.
 *
 * Used by both the dashboard event stream (GET /events) and the
 * prompt relay stream (GET /prompts/stream) to safely encode SSE frames.
 */

/**
 * Sanitize an SSE event name to prevent header injection.
 * Allows only alphanumeric characters, dots, underscores, and hyphens.
 * Strips everything else, including newlines, colons, and spaces.
 * Spaces are stripped because an SSE `event:` field value is terminated by
 * a newline, and a leading space would be included in the event name verbatim.
 */
export function sanitizeEventType(eventType: string): string {
  return eventType.replace(/[^a-zA-Z0-9._-]/g, '');
}

/**
 * Encode an SSE data field correctly per the SSE spec.
 * Each newline in the data must be sent as a separate `data:` line.
 * This prevents injection of arbitrary SSE fields via newlines in JSON.
 */
export function encodeSSEData(data: string): string {
  return data
    .split('\n')
    .map((line) => `data: ${line}`)
    .join('\n');
}
