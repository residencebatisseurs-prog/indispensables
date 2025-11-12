const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

// Configuration CORS pour Zapier
app.use(cors({
  origin: ['https://zapier.com', 'https://hooks.zapier.com'],
  credentials: true
}));

app.use(express.json());

// Configuration
const GMB_API_BASE_URL = 'https://mybusiness.googleapis.com/v4';

/**
 * Middleware pour valider le token d'authentification
 */
const validateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Token d\'authentification manquant ou invalide',
      message: 'Veuillez fournir un token Bearer dans le header Authorization'
    });
  }
  req.accessToken = authHeader.split(' ')[1];
  next();
};

/**
 * GET /api/accounts
 * Liste tous les comptes GMB de l'utilisateur authentifié
 */
app.get('/api/accounts', validateToken, async (req, res) => {
  try {
    const response = await axios.get(`${GMB_API_BASE_URL}/accounts`, {
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      accounts: response.data.accounts || []
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

/**
 * GET /api/accounts/:accountId/locations
 * Liste toutes les locations d'un compte GMB
 */
app.get('/api/accounts/:accountId/locations', validateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const response = await axios.get(
      `${GMB_API_BASE_URL}/accounts/${accountId}/locations`,
      {
        headers: {
          'Authorization': `Bearer ${req.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      locations: response.data.locations || []
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

/**
 * GET /api/accounts/:accountId/locations/:locationId/reviews-stats
 * Récupère le nombre total d'avis et la note moyenne pour une location spécifique
 */
app.get('/api/accounts/:accountId/locations/:locationId/reviews-stats', 
  validateToken, 
  async (req, res) => {
    try {
      const { accountId, locationId } = req.params;
      const locationPath = `accounts/${accountId}/locations/${locationId}`;
      
      const response = await axios.get(
        `${GMB_API_BASE_URL}/${locationPath}/reviews`,
        {
          headers: {
            'Authorization': `Bearer ${req.accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            pageSize: 1
          }
        }
      );

      res.json({
        success: true,
        locationId: locationId,
        stats: {
          totalReviewCount: response.data.totalReviewCount || 0,
          averageRating: response.data.averageRating || 0
        }
      });
    } catch (error) {
      res.status(error.response?.status || 500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
});

/**
 * GET /api/accounts/:accountId/all-reviews-stats
 * Récupère le nombre total d'avis et la note moyenne pour TOUTES les locations d'un compte
 */
app.get('/api/accounts/:accountId/all-reviews-stats', 
  validateToken, 
  async (req, res) => {
    try {
      const { accountId } = req.params;
      
      // 1. Récupérer toutes les locations du compte
      const locationsResponse = await axios.get(
        `${GMB_API_BASE_URL}/accounts/${accountId}/locations`,
        {
          headers: {
            'Authorization': `Bearer ${req.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const locations = locationsResponse.data.locations || [];
      
      // 2. Pour chaque location, récupérer les statistiques des avis
      const statsPromises = locations.map(async (location) => {
        try {
          const reviewsResponse = await axios.get(
            `${GMB_API_BASE_URL}/${location.name}/reviews`,
            {
              headers: {
                'Authorization': `Bearer ${req.accessToken}`,
                'Content-Type': 'application/json'
              },
              params: {
                pageSize: 1
              }
            }
          );

          return {
            locationId: location.name.split('/').pop(),
            locationName: location.locationName || 'N/A',
            address: location.address?.addressLines?.join(', ') || 'N/A',
            totalReviewCount: reviewsResponse.data.totalReviewCount || 0,
            averageRating: reviewsResponse.data.averageRating || 0
          };
        } catch (error) {
          return {
            locationId: location.name.split('/').pop(),
            locationName: location.locationName || 'N/A',
            address: location.address?.addressLines?.join(', ') || 'N/A',
            totalReviewCount: 0,
            averageRating: 0,
            error: error.response?.data?.error?.message || 'Impossible de récupérer les avis'
          };
        }
      });

      const allStats = await Promise.all(statsPromises);

      // 3. Calculer les statistiques globales
      const globalStats = {
        totalLocations: locations.length,
        totalReviews: allStats.reduce((sum, stat) => sum + stat.totalReviewCount, 0),
        averageRatingAcrossAllLocations: allStats.length > 0 
          ? (allStats.reduce((sum, stat) => sum + stat.averageRating, 0) / allStats.length).toFixed(2)
          : 0
      };

      res.json({
        success: true,
        accountId: accountId,
        globalStats,
        locationStats: allStats
      });
    } catch (error) {
      res.status(error.response?.status || 500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
});

/**
 * Route de santé
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API Google My Business - Avis et Notes',
    timestamp: new Date().toISOString()
  });
});

// Documentation de l'API
app.get('/', (req, res) => {
  res.json({
    name: 'API Google My Business - Statistiques des Avis',
    version: '1.0.0',
    endpoints: {
      'GET /health': 'Vérifier la santé de l\'API',
      'GET /api/accounts': 'Lister tous les comptes GMB',
      'GET /api/accounts/:accountId/locations': 'Lister toutes les locations d\'un compte',
      'GET /api/accounts/:accountId/locations/:locationId/reviews-stats': 'Stats d\'une location spécifique',
      'GET /api/accounts/:accountId/all-reviews-stats': 'Stats de toutes les locations d\'un compte'
    },
    authentication: 'Bearer token requis dans le header Authorization'
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
  console.log(`📍 Documentation disponible sur http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;