const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Rate limit estricto para auth — 20 intentos por 15 minutos
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos, espera 15 minutos', code: 'RATE_LIMIT_EXCEEDED' }
});

router.use(authLimiter);

// IDs de extensión Chrome autorizados
const ALLOWED_RUNTIME_IDS = (process.env.ALLOWED_CHROME_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

const isAllowedRuntimeId = (id) => {
  if (!id || typeof id !== 'string') return false;
  if (!/^[a-z]{32}$/.test(id)) return false;
  if (ALLOWED_RUNTIME_IDS.length > 0) {
    return ALLOWED_RUNTIME_IDS.includes(id);
  }
  return true;
};

// ─── HELPER: validar campo chromeRuntimeId del payload ───────────
function validarRuntimeIdPayload(decoded, res) {
  if (
    !decoded.chromeRuntimeId ||
    typeof decoded.chromeRuntimeId !== 'string' ||
    !/^[a-z]{32}$/.test(decoded.chromeRuntimeId)
  ) {
    res.status(403).json({
      error: 'Token malformado',
      code: 'INVALID_TOKEN_PAYLOAD'
    });
    return false;
  }
  return true;
}
// ─────────────────────────────────────────────────────────────────

router.post('/token', async (req, res) => {
  try {
    const { chromeRuntimeId, timestamp } = req.body;

    if (!chromeRuntimeId) {
      return res.status(400).json({
        error: 'Chrome runtime ID is required',
        code: 'MISSING_RUNTIME_ID'
      });
    }

    if (!isAllowedRuntimeId(chromeRuntimeId)) {
      return res.status(403).json({
        error: 'Unauthorized extension',
        code: 'UNAUTHORIZED_RUNTIME_ID'
      });
    }

    const payload = {
      id: `ext_${chromeRuntimeId}_${Date.now()}`,
      chromeRuntimeId: chromeRuntimeId,
      timestamp: timestamp || Date.now()
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      token: token,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      user: {
        id: payload.id,
        chromeRuntimeId: payload.chromeRuntimeId
      }
    });

  } catch (error) {
    console.error('Error generating JWT token:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      code: 'TOKEN_GENERATION_FAILED'
    });
  }
});

router.post('/validate', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token is required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // FIX #52: fijar algoritmo, bloquea alg:none y confusion attacks
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    // FIX #52 #59: validar payload antes de usarlo en security check
    if (!validarRuntimeIdPayload(decoded, res)) return;

    if (!isAllowedRuntimeId(decoded.chromeRuntimeId)) {
      return res.status(403).json({
        success: false,
        valid: false,
        error: 'Token de extensión no autorizada'
      });
    }

    res.json({
      success: true,
      valid: true,
      user: {
        id: decoded.id,
        chromeRuntimeId: decoded.chromeRuntimeId,
        timestamp: decoded.timestamp
      }
    });

  } catch (error) {
    res.json({
      success: false,
      valid: false,
      error: 'Token inválido o expirado'
    });
  }
});

router.post('/refresh', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Token required for refresh',
        code: 'TOKEN_REQUIRED'
      });
    }

    // FIX #53: fijar algoritmo, bloquea alg:none y confusion attacks
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    // FIX #53 #59: validar payload antes de usarlo en security check
    if (!validarRuntimeIdPayload(decoded, res)) return;

    if (!isAllowedRuntimeId(decoded.chromeRuntimeId)) {
      return res.status(403).json({
        error: 'Unauthorized extension',
        code: 'UNAUTHORIZED_RUNTIME_ID'
      });
    }

    const payload = {
      id: decoded.id,
      chromeRuntimeId: decoded.chromeRuntimeId,
      timestamp: Date.now()
    };

    const newToken = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      token: newToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

  } catch (error) {
    res.status(401).json({
      error: 'Cannot refresh token',
      code: 'REFRESH_FAILED'
    });
  }
});

module.exports = router;