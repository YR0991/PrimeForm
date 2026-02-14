/**
 * Firebase Admin ID token verification and requireUser helper.
 * Use verifyIdToken(admin) then requireUser() on routes that must be authenticated.
 */

/**
 * Verifies Authorization: Bearer <idToken> and sets req.user = { uid, email, claims }.
 * Returns 401 if header missing or token invalid.
 * @param {object} admin - Firebase Admin SDK (must be initialized)
 * @returns {function(req, res, next)}
 */
function verifyIdToken(admin) {
  return async (req, res, next) => {
    const authHeader = (req.headers.authorization || req.headers.Authorization || '').trim();
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Use: Authorization: Bearer <idToken>'
      });
    }
    const idToken = authHeader.slice(7).trim();
    if (!idToken) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Empty Bearer token'
      });
    }
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        claims: decodedToken
      };
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: err.code === 'auth/id-token-expired' ? 'Token expired' : 'Invalid ID token'
      });
    }
  };
}

/**
 * Requires req.user to be set (by verifyIdToken). Returns 401 if not.
 * @returns {function(req, res, next)}
 */
function requireUser() {
  return (req, res, next) => {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    next();
  };
}

/**
 * Requires a Firebase custom claim (e.g. admin, coach) on req.user.claims.
 * Use after verifyIdToken + requireUser. Break-glass: if BREAKGLASS_ENABLED==="true"
 * and req.user.email === BREAKGLASS_ADMIN_EMAIL, allows and logs BREAKGLASS_USED.
 * @param {string} role - Claim key to require (e.g. 'admin', 'coach')
 * @returns {function(req, res, next)}
 */
function requireRole(role) {
  const breakglassEnabled = process.env.BREAKGLASS_ENABLED === 'true';
  const breakglassEmail = (process.env.BREAKGLASS_ADMIN_EMAIL || '').trim().toLowerCase();

  return (req, res, next) => {
    const email = (req.user?.email || '').toString().trim().toLowerCase();
    const hasClaim = req.user?.claims && req.user.claims[role] === true;

    if (hasClaim) {
      return next();
    }
    if (breakglassEnabled && breakglassEmail && email === breakglassEmail) {
      console.warn('BREAKGLASS_USED', { role, email });
      return next();
    }
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: `Role '${role}' required`
    });
  };
}

module.exports = { verifyIdToken, requireUser, requireRole };
