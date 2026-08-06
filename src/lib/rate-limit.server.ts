import { getWebRequest } from "@tanstack/react-start/server";

// Minimal In-Memory Rate Limiter for Brute-Force Protection
// IMPORTANT: This in-memory store resets on server restart.
// For a distributed production system (Vercel/Cloudflare Edge), you MUST upgrade 
// to a persistent store like Redis (e.g. Upstash) to share rate limit state across instances.

interface RateLimitData {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitData>();

/**
 * Checks if the request should be rate-limited based on combined IP + userId.
 * Throws an Error if the limit is exceeded.
 */
export function rateLimit(userId: string, action: string, limit: number, windowMs: number) {
  let ip = "unknown";
  try {
    const req = getWebRequest();
    if (req) {
      ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() 
        || req.headers.get("x-real-ip") 
        || "unknown";
    }
  } catch (e) {
    // Ignore if not available
  }

  const key = `${action}:${ip}:${userId}`;
  const now = Date.now();

  const record = rateLimitStore.get(key);

  if (record) {
    if (now > record.resetAt) {
      // Window expired, reset
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      // Still in window
      if (record.count >= limit) {
        throw new Error("429: Too Many Requests. Please try again later.");
      }
      record.count += 1;
    }
  } else {
    // New record
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
  }

  // Periodic cleanup of old keys to prevent memory leaks in dev/long-running processes
  if (Math.random() < 0.05) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetAt) {
        rateLimitStore.delete(k);
      }
    }
  }
}
