// ============================================================
// RUTAS DE VALIDACIÓN DE LICENCIA
// ============================================================
// Endpoint para validar licencias de usuario
// ============================================================

const express = require('express');
const router = express.Router();

// Validar licencia (modo desarrollo)
router.post('/validate-license', async (req, res) => {
  try {
    const { licenseKey, chromeRuntimeId, timestamp } = req.body;
    
    // Validar datos requeridos
    if (!licenseKey) {
      return res.status(400).json({
        error: 'License key is required',
        code: 'MISSING_LICENSE_KEY'
      });
    }
    
    if (!chromeRuntimeId) {
      return res.status(400).json({
        error: 'Chrome runtime ID is required',
        code: 'MISSING_RUNTIME_ID'
      });
    }
    
    // TODO: PRODUCCIÓN - Conectar con base de datos de licencias real
    // Por ahora, en desarrollo, aceptamos cualquier licencia
    
        
    // Simulación de validación exitosa en desarrollo
    const isValid = true; // En producción: await validateLicenseInDatabase(licenseKey)
    
    if (isValid) {
      res.json({
        valid: true,
        licenseKey: licenseKey,
        chromeRuntimeId: chromeRuntimeId,
        validatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
        features: {
          ocr: true,
          bulkExport: true,
          notionSync: true,
          advancedSelectors: true
        },
        message: 'License validated successfully'
      });
    } else {
      res.json({
        valid: false,
        licenseKey: licenseKey,
        chromeRuntimeId: chromeRuntimeId,
        validatedAt: new Date().toISOString(),
        error: 'Invalid or expired license',
        code: 'LICENSE_INVALID'
      });
    }
    
  } catch (error) {
    console.error('Error validating license:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      code: 'LICENSE_VALIDATION_FAILED'
    });
  }
});

// Verificar estado de licencia (sin validar de nuevo)
router.get('/license-status/:licenseKey', async (req, res) => {
  try {
    const { licenseKey } = req.params;
    
    if (!licenseKey) {
      return res.status(400).json({
        error: 'License key is required',
        code: 'MISSING_LICENSE_KEY'
      });
    }
    
    // TODO: PRODUCCIÓN - Obtener estado real desde base de datos
    // Por ahora, simulamos estado activo
    
    res.json({
      licenseKey: licenseKey,
      active: true,
      lastValidated: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      features: {
        ocr: true,
        bulkExport: true,
        notionSync: true,
        advancedSelectors: true
      }
    });
    
  } catch (error) {
    console.error('Error getting license status:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      code: 'STATUS_CHECK_FAILED'
    });
  }
});

module.exports = router;
