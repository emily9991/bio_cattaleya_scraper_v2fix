// ============================================================
// MIDDLEWARE DE AUTENTICACIÓN JWT
// ============================================================
// Valida tokens JWT en todas las rutas protegidas
// ============================================================

const jwt = require('jsonwebtoken');

// Middleware para validar JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Token requerido'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Token inválido o expirado'
      });
    }

    // Agregar información del usuario decodificada al request
    req.user = {
      id: decoded.id,
      chromeRuntimeId: decoded.chromeRuntimeId,
      timestamp: decoded.timestamp
    };
    
    next();
  });
};

// Middleware opcional para validar Chrome Runtime ID
const validateChromeRuntime = (req, res, next) => {
  if (!req.user.chromeRuntimeId) {
    return res.status(401).json({ 
      error: 'Invalid Chrome runtime identification',
      code: 'INVALID_RUNTIME_ID'
    });
  }
  next();
};

module.exports = { 
  verifyToken,
  validateChromeRuntime  // Mantenido por uso en server.js
};
