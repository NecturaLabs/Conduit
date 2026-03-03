/**
 * Model pricing service.
 *
 * Fetches per-token pricing from OpenRouter's public model list API and
 * caches it in memory. The cache refreshes every 24 hours. No API key is
 * required for the model list endpoint.
 *
 * Pricing is used to compute cost server-side from token counts reported by
 * OpenCode's `message.updated` events, because OpenCode always reports
 * `cost: 0` regardless of actual usage.
 *
 * Cost formula (per message):
 *   cost = input_tokens       * price_per_input_token
 *        + output_tokens      * price_per_output_token   (reasoning tokens included at output rate)
 *        + cache_read_tokens  * price_per_cache_read_token   (0 when model has no cache-read pricing)
 *        + cache_write_tokens * price_per_cache_write_token  (0 when model has no cache-write pricing)
 *
 * All prices are in USD per token (OpenRouter uses USD per token in their API).
 *
 * Model ID mapping:
 *   OpenCode reports `modelID` like "claude-sonnet-4-6" and `providerID` like
 *   "anthropic". OpenRouter model IDs use dots in version numbers, e.g.
 *   "anthropic/claude-sonnet-4.6". We insert a dot→hyphen normalised alias
 *   for every model at fetch time so that exact/suffix lookups always succeed.
 *   A further partial-prefix match handles `:variant` suffixes (e.g. ":beta").
 *
 * Cache pricing:
 *   OpenRouter exposes `input_cache_read` and `input_cache_write` fields on
 *   models that support prompt caching (currently Anthropic and Google). When
 *   those fields are absent the stored price is 0, and cache tokens contribute
 *   $0 to the cost — which is correct for models with no cache pricing tier.
 */

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface TokenPricing {
  /** USD per input token */
  input: number;
  /** USD per output token (reasoning tokens are priced at this rate) */
  output: number;
  /** USD per cache-read token; 0 when model has no cache-read pricing */
  cacheRead: number;
  /** USD per cache-write token; 0 when model has no cache-write pricing */
  cacheWrite: number;
}

interface OpenRouterModel {
  id: string;
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
    /** Cache-read token price (prompt cache hit) */
    input_cache_read?: string | number;
    /** Cache-write token price (prompt cache write) */
    input_cache_write?: string | number;
    request?: string | number;
    image?: string | number;
  };
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

class PricingService {
  /** model id (e.g. "anthropic/claude-sonnet-4.6" or normalised alias) → pricing */
  private cache = new Map<string, TokenPricing>();
  private lastFetch = 0;
  private fetchPromise: Promise<void> | null = null;

  /**
   * Ensure the pricing cache is populated. Refreshes if older than TTL.
   * Concurrent callers share the same in-flight request.
   */
  private async ensureFresh(): Promise<void> {
    if (Date.now() - this.lastFetch < CACHE_TTL_MS) return;
    if (this.fetchPromise) return this.fetchPromise;

    this.fetchPromise = this.fetchAndCache().finally(() => {
      this.fetchPromise = null;
    });
    return this.fetchPromise;
  }

  private async fetchAndCache(): Promise<void> {
    try {
      const res = await fetch(OPENROUTER_MODELS_URL, {
        headers: { 'User-Agent': 'conduit-server/1.0' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        console.warn(`[pricing] OpenRouter fetch failed: ${res.status} ${res.statusText}`);
        // Keep existing cache rather than clearing it
        return;
      }

      const body = await res.json() as OpenRouterResponse;
      if (!Array.isArray(body?.data)) {
        console.warn('[pricing] Unexpected OpenRouter response shape');
        return;
      }

      const newCache = new Map<string, TokenPricing>();
      for (const model of body.data) {
        if (!model.id || !model.pricing) continue;
        const input  = parsePrice(model.pricing.prompt);
        const output = parsePrice(model.pricing.completion);
        if (input === 0 && output === 0) continue; // skip free/unknown models

        const pricing: TokenPricing = {
          input,
          output,
          cacheRead:  parsePrice(model.pricing.input_cache_read),
          cacheWrite: parsePrice(model.pricing.input_cache_write),
        };

        // Primary entry: canonical OpenRouter id (e.g. "anthropic/claude-sonnet-4.6")
        newCache.set(model.id, pricing);

        // Normalised alias: replace dots with hyphens in the model slug so that
        // OpenCode's modelID format (e.g. "claude-sonnet-4-6") resolves via
        // exact or suffix match without needing the partial-prefix fallback.
        // Scoped to the slug (after the first "/") to avoid mangling provider
        // prefixes that may contain dots in the future.
        // e.g. "anthropic/claude-sonnet-4.6" → "anthropic/claude-sonnet-4-6"
        const slashIdx = model.id.indexOf("/");
        const normalizedId = slashIdx === -1
          ? model.id.replace(/[.]/g, "-")
          : model.id.slice(0, slashIdx + 1) + model.id.slice(slashIdx + 1).replace(/[.]/g, "-");
        if (normalizedId !== model.id) {
          newCache.set(normalizedId, pricing);
        }
      }

      this.cache = newCache;
      this.lastFetch = Date.now();
      console.log(`[pricing] Loaded pricing for ${newCache.size} entries (${body.data.length} models) from OpenRouter`);
    } catch (err) {
      console.warn('[pricing] Failed to fetch OpenRouter model pricing:', err);
      // Don't update lastFetch — retry next call
    }
  }

  /**
   * Look up pricing for a model. Returns null if unknown.
   *
   * @param modelId  - e.g. "claude-sonnet-4-6" or "claude-3-5-sonnet-20241022"
   * @param provider - e.g. "anthropic", "openai", "google"
   */
  private lookupPricing(modelId: string, provider: string): TokenPricing | null {
    // 1. Exact match: "provider/modelId"
    const exact = `${provider}/${modelId}`;
    if (this.cache.has(exact)) return this.cache.get(exact)!;

    // 2. Suffix match: any cached key ending with "/modelId"
    //    Handles cases where provider is empty or mismatched
    const suffix = `/${modelId}`;
    for (const [key, pricing] of this.cache) {
      if (key.endsWith(suffix)) return pricing;
    }

    // 3. Partial model name match (handles version aliases like "claude-sonnet-4-6" → "claude-sonnet-4-6:beta")
    for (const [key, pricing] of this.cache) {
      const keyModel = key.includes('/') ? key.split('/').slice(1).join('/') : key;
      if (keyModel.startsWith(modelId) || modelId.startsWith(keyModel)) return pricing;
    }

    return null;
  }

  /**
   * Synchronous cost computation using the in-memory cache.
   * Returns 0 if the cache is empty (not yet populated).
   * Safe to call from synchronous request handlers once the server has warmed up.
   */
  computeCostSync(
    modelId: string,
    provider: string,
    tokens: {
      input?: number;
      output?: number;
      reasoning?: number;
      cache?: { read?: number; write?: number };
    },
  ): number {
    if (this.cache.size === 0) return 0;
    const pricing = this.lookupPricing(modelId, provider);
    if (!pricing) return 0;

    const input      = tokens.input ?? 0;
    const output     = (tokens.output ?? 0) + (tokens.reasoning ?? 0); // reasoning billed at output rate
    const cacheRead  = tokens.cache?.read  ?? 0;
    const cacheWrite = tokens.cache?.write ?? 0;

    return (
      input      * pricing.input +
      output     * pricing.output +
      cacheRead  * pricing.cacheRead +   // 0 when model has no cache-read pricing
      cacheWrite * pricing.cacheWrite    // 0 when model has no cache-write pricing
    );
  }

  /**
   * Compute the cost (USD) for a message given its token counts.
   *
   * @param modelId  - model ID as reported by OpenCode (e.g. "claude-sonnet-4-6")
   * @param provider - provider ID as reported by OpenCode (e.g. "anthropic")
   * @param tokens   - token breakdown from the message.updated event
   */
  async computeCost(
    modelId: string,
    provider: string,
    tokens: {
      input?: number;
      output?: number;
      reasoning?: number;
      cache?: { read?: number; write?: number };
    },
  ): Promise<number> {
    await this.ensureFresh();

    const pricing = this.lookupPricing(modelId, provider);
    if (!pricing) return 0;

    const input      = tokens.input ?? 0;
    const output     = (tokens.output ?? 0) + (tokens.reasoning ?? 0); // reasoning billed at output rate
    const cacheRead  = tokens.cache?.read  ?? 0;
    const cacheWrite = tokens.cache?.write ?? 0;

    return (
      input      * pricing.input +
      output     * pricing.output +
      cacheRead  * pricing.cacheRead +   // 0 when model has no cache-read pricing
      cacheWrite * pricing.cacheWrite    // 0 when model has no cache-write pricing
    );
  }

  /**
   * Pre-warm the cache on startup. Fire-and-forget — never throws.
   */
  warmUp(): void {
    this.fetchAndCache().catch(() => {});
  }
}

function parsePrice(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return isFinite(n) ? n : 0;
}

export const pricingService = new PricingService();
