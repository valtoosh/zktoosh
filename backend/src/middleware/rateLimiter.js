// backend/src/middleware/rateLimiter.js
// PHASE 4: Security Hardening - Rate Limiting

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for proof generation endpoints
 * Prevents DoS attacks and excessive resource consumption
 */
const proofGenerationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // Limit each IP to 10 requests per minute
  message: {
    error: 'Too many proof generation requests',
    message: 'You have exceeded the 10 requests per minute limit. Please try again later.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests from local development
  skip: (req) => {
    if (process.env.NODE_ENV === 'development' && req.ip === '::1') {
      return false; // Don't skip in dev either (for testing)
    }
    return false;
  },
  // Custom key generator (use IP address)
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
  // Handler for when limit is exceeded
  handler: (req, res) => {
    console.warn(`⚠️  Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit for proof generation. Please try again in 1 minute.',
      retryAfter: 60,
      limit: 10,
      window: '1 minute'
    });
  }
});

/**
 * Stricter rate limiter for sensitive operations
 * Used for contract interaction endpoints
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit to 5 requests per minute
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded for this endpoint.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * General API rate limiter
 * Applied to all API endpoints
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per 15 minutes
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the general API rate limit.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  proofGenerationLimiter,
  strictLimiter,
  generalLimiter
};
