import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'csfaq-secret-key-2026';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware: require an authenticated user with 'intern' role.
 * Blocks faculty from SP-earning endpoints.
 */
export function requireIntern(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role === 'faculty') {
    return res.status(403).json({ error: 'Faculty cannot perform this action' });
  }
  next();
}

/**
 * Middleware: require Faculty role.
 * All /api/faculty/* routes are protected by this.
 */
export function requireFaculty(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'faculty') {
    return res.status(403).json({ error: 'Faculty access required' });
  }
  next();
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch {
      // ignore invalid tokens for optional auth
    }
  }
  next();
}

export { JWT_SECRET };