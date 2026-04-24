// ============================================================
// RUTAS DE PROXY PARA NOTION API
// ============================================================
// Intermediario seguro para API de Notion
// La extensión nunca accede directamente al NOTION_TOKEN
// ============================================================

const express = require('express');
const router = express.Router();

// Middleware para verificar que NOTION_TOKEN esté configurado
const requireNotionToken = (req, res, next) => {
  if (!process.env.NOTION_TOKEN || process.env.NOTION_TOKEN === 'secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    return res.status(500).json({
      error: 'Notion API not configured on server',
      code: 'NOTION_NOT_CONFIGURED'
    });
  }
  next();
};

// Proxy para crear página en Notion
router.post('/create-page', requireNotionToken, async (req, res) => {
  try {
    const { pageData } = req.body;
    
    if (!pageData) {
      return res.status(400).json({
        error: 'Page data is required',
        code: 'MISSING_PAGE_DATA'
      });
    }
    
    // Construir payload para Notion API
    const notionPayload = {
      parent: {
        database_id: process.env.NOTION_DATABASE_ID
      },
      properties: {
        [process.env.NOTION_PROP_TITLE || 'Nombre']: {
          title: [
            {
              text: {
                content: pageData.nombre || 'Sin nombre'
              }
            }
          ]
        },
        [process.env.NOTION_PROP_URL || 'URL Taobao']: {
          url: pageData.url || ''
        },
        [process.env.NOTION_PROP_CNY || 'Precio CNY']: {
          number: pageData.precio_cny ? parseFloat(pageData.precio_cny) : null
        },
        [process.env.NOTION_PROP_USD || 'Precio USD']: {
          number: pageData.precio_usd ? parseFloat(pageData.precio_usd) : null
        },
        [process.env.NOTION_PROP_CAT || 'Categoría']: {
          select: {
            name: pageData.categoria || 'General'
          }
        }
      }
    };
    
    // Agregar propiedades adicionales si existen
    if (pageData.descripcion) {
      notionPayload.properties.Description = {
        rich_text: [
          {
            text: {
              content: pageData.descripcion
            }
          }
        ]
      };
    }
    
    // Llamar a Notion API
    const notionResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(notionPayload)
    });
    
    const notionData = await notionResponse.json();
    
    if (!notionResponse.ok) {
      console.error('Notion API error:', notionResponse.status);
      return res.status(notionResponse.status).json({
        error: 'Notion API request failed',
        code: 'NOTION_API_ERROR'
      });
    }
    
    res.json({
      success: true,
      notionPageId: notionData.id,
      url: notionData.url,
      created: notionData.created_time
    });
    
  } catch (error) {
    console.error('Error creating Notion page:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      code: 'PAGE_CREATION_FAILED'
    });
  }
});

// Proxy para consultar base de datos de Notion
router.get('/database-query', requireNotionToken, async (req, res) => {
  try {
    const { pageSize = 10, startCursor } = req.query;
    
    const notionPayload = {
      page_size: parseInt(pageSize)
    };
    
    if (startCursor) {
      notionPayload.start_cursor = startCursor;
    }
    
    const notionResponse = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(notionPayload)
    });
    
    const notionData = await notionResponse.json();
    
    if (!notionResponse.ok) {
      console.error('Notion API error:', notionResponse.status);
      return res.status(notionResponse.status).json({
        error: 'Notion API request failed',
        code: 'NOTION_API_ERROR'
      });
    }
    
    res.json({
      success: true,
      results: notionData.results,
      hasMore: notionData.has_more,
      nextCursor: notionData.next_cursor
    });
    
  } catch (error) {
    console.error('Error querying Notion database:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      code: 'DATABASE_QUERY_FAILED'
    });
  }
});

// Proxy para actualizar página existente
router.patch('/pages/:pageId', requireNotionToken, async (req, res) => {
  try {
    const { pageId } = req.params;
    const { properties } = req.body;
    
    if (!properties) {
      return res.status(400).json({
        error: 'Properties are required',
        code: 'MISSING_PROPERTIES'
      });
    }
    
    const notionResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({ properties })
    });
    
    const notionData = await notionResponse.json();
    
    if (!notionResponse.ok) {
      console.error('Notion API error:', notionResponse.status);
      return res.status(notionResponse.status).json({
        error: 'Notion API request failed',
        code: 'NOTION_API_ERROR'
      });
    }
    
    res.json({
      success: true,
      pageId: notionData.id,
      lastEdited: notionData.last_edited_time
    });
    
  } catch (error) {
    console.error('Error updating Notion page:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      code: 'PAGE_UPDATE_FAILED'
    });
  }
});

module.exports = router;
