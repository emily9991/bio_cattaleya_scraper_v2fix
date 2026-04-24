// ============================================================
// RUTAS DE AUTENTICACIÓN JWT
// ============================================================
// Endpoints para obtener y renovar tokens JWT
// ============================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Generar token JWT para la extensión
router.post('/token', async (req, res) => {
  try {
    const { chromeRuntimeId, timestamp } = req.body;
    
    // Validar datos requeridos
    if (!chromeRuntimeId) {
      return res.status(400).json({
        error: 'Chrome runtime ID is required',
        code: 'MISSING_RUNTIME_ID'
      });
    }
    
    // TODO: PRODUCCIÓN - Validar chromeRuntimeId contra base de datos
    // Por ahora, en desarrollo, aceptamos cualquier runtime ID
    
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

// Validar token existente
router.post('/validate', (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: 'Token is required',
        code: 'TOKEN_REQUIRED'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
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

// Renovar token (requiere token válido)
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
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Generar nuevo token con misma información
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
