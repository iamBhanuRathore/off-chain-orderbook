import { rateLimit } from "express-rate-limit";
import { RateLimiterMemory } from "rate-limiter-flexible";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Options } from "express-rate-limit";

// A multiplier for development environments to avoid rate-limiting during testing
export const REQUEST_MULTIPLIER =
  process.env.NODE_ENV === "development" ? 100 : 1;

// --- Key Generation ---
// Determines the identifier for a request, either by IP or a custom value.

// Gets the IP address from the request.
const getKey = (req: Request): string => {
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  const forwardedFor = req.headers["x-forwarded-for"];

  const ip =
    (Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp) ||
    (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ||
    req.ip ||
    "255.255.255.255";
  return ip;
};

// Gets the user ID if available, otherwise falls back to the IP address.
const getKeyWithUid = (req: Request): string => {
  const uid = req.user?.id; // Assuming you attach user info to the request object
  return uid ? uid.toString() : getKey(req);
};

// --- Custom Handlers ---
// Defines what happens when a rate limit is exceeded.

export const customHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
  options: Options,
): void => {
  // You can customize this response based on the request
  if (req.user && req.user.type === "ApiKey") {
    res.status(429).json({
      code: "API_KEY_RATE_LIMIT_EXCEEDED",
      message: "API key rate limit exceeded. Please try again later.",
    });
  } else {
    res.status(429).json({
      code: "RATE_LIMIT_EXCEEDED",
      message: "Request limit reached, please try again later.",
    });
  }
};

// --- Rate Limit Definitions ---
// A central place to define all your rate-limiting rules.

type Window = "second" | "minute" | "hour" | "day";

interface Limit {
  window: Window | number;
  max: number;
}

interface Limits {
  [key: string]: Limit;
}

export const limits: Limits = {
  // Stricter limit for sensitive operations
  sensitive: {
    window: "minute",
    max: 10,
  },
  // Default limit for most API endpoints
  default: {
    window: "minute",
    max: 100,
  },
  // A more relaxed limit for general use
  relaxed: {
    window: "hour",
    max: 500,
  },
  // A specific limit for API key usage
  defaultApeRateLimit: {
    window: "hour",
    max: 1000,
  },
};

// --- Utility Functions ---

// Converts a window string ("second", "minute", "hour", "day") to milliseconds.
function convertWindowToMs(window: Window | number): number {
  if (typeof window === "number") return window;
  switch (window) {
    case "second":
      return 1000;
    case "minute":
      return 60 * 1000;
    case "hour":
      return 60 * 60 * 1000;
    case "day":
      return 24 * 60 * 60 * 1000;
    default:
      return 60 * 1000; // Default to one minute
  }
}

interface RateLimiters {
  sensitive: RequestHandler;
  default: RequestHandler;
  relaxed: RequestHandler;
  defaultApeRateLimit: RequestHandler;
}

// --- Initialise Limiters ---
// Creates the rate-limiting middleware based on the defined limits.

function initialiseLimiters(): RateLimiters {
  const limiters = Object.keys(limits).reduce((acc, key) => {
    const options = limits[key as keyof Limits]!;
    (acc as any)[key] = rateLimit({
      windowMs: convertWindowToMs(options.window),
      max: options.max * REQUEST_MULTIPLIER,
      handler: customHandler,
      keyGenerator: getKeyWithUid,
    });
    return acc;
  }, {} as RateLimiters);
  return limiters;
}

export const requestLimiters = initialiseLimiters();

// --- Specialized Rate Limiters ---

// A general, root-level rate limiter for all incoming requests.
export const rootRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000 * REQUEST_MULTIPLIER,
  keyGenerator: getKey,
  handler: (
    req: Request,
    res: Response,
    next: NextFunction,
    options: Options,
  ) => {
    res.status(429).send({
      message:
        "Maximum API request (root) limit reached. Please try again later.",
    });
  },
});

// A limiter for handling bad authentication attempts.
const badAuthRateLimiter = new RateLimiterMemory({
  points: 30 * REQUEST_MULTIPLIER,
  duration: 60 * 60, // 1 hour
});

export const badAuthRateLimiterHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void | Response> => {
  try {
    const key = getKey(req);
    const rateLimitStatus = await badAuthRateLimiter.get(key);

    if (rateLimitStatus !== null && rateLimitStatus.remainingPoints <= 0) {
      return res.status(429).send({
        message:
          "Too many bad authentication attempts, please try again later.",
      });
    }
  } catch (error) {
    return next(error);
  }
  next();
};

export const incrementBadAuth = async (req: Request): Promise<void> => {
  try {
    const key = getKey(req);
    await badAuthRateLimiter.penalty(key);
  } catch (error) {
    // Ignore errors here
  }
};

// A very strict limiter for webhooks.
export const webhookLimit = rateLimit({
  windowMs: 1000, // 1 second
  max: 1 * REQUEST_MULTIPLIER,
  keyGenerator: getKeyWithUid,
  handler: customHandler,
});
