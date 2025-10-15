// Configuration pour Search for Kids
// Copiez ce fichier vers config.js et remplissez vos vraies valeurs

const CONFIG = {
    // Remplacez par votre ID Google Custom Search Engine
    // Trouvable dans votre console Google CSE
    GOOGLE_CSE_ID: 'VOTRE_ID_CSE_ICI',

    // Clé API Google (nécessaire pour l'API JSON)
    // Obtenir sur : https://console.developers.google.com/
    GOOGLE_API_KEY: 'VOTRE_API_KEY_ICI',

    // Configuration pour les panneaux de connaissances (ex: Vikidia, Wikipedia)
    KNOWLEDGE_PANEL_CONFIG: {
        // --- Configuration pour Vikidia (par défaut) ---
        ENABLED: true,
        API_URL: 'https://fr.vikidia.org/w/api.php',
        BASE_URL: 'https://fr.vikidia.org/wiki/',
        SOURCE_NAME: "Vikidia - L'encyclopédie des 8-13 ans",
        EXTRACT_LENGTH: 400, // Nombre de caractères pour l'extrait
        THUMBNAIL_SIZE: 300, // Taille de l'image en pixels
        // Désactiver les images de Vikidia si elles causent des erreurs (CORS/HTTPS)
        DISABLE_THUMBNAILS: true

        /*
        // --- EXEMPLE DE CONFIGURATION POUR WIKIPEDIA ---
        // Pour utiliser Wikipedia, décommentez ce bloc et commentez celui de Vikidia.
        ENABLED: true,
        API_URL: 'https://fr.wikipedia.org/w/api.php',
        BASE_URL: 'https://fr.wikipedia.org/wiki/',
        SOURCE_NAME: "Wikipédia - L'encyclopédie libre",
        EXTRACT_LENGTH: 400,
        THUMBNAIL_SIZE: 300,
        DISABLE_THUMBNAILS: false
        */
    },

    // Configuration pour la recherche sur Wikipedia
    WIKIPEDIA_SEARCH_CONFIG: {
        ENABLED: true,
        API_URL: 'https://fr.wikipedia.org/w/api.php',
        BASE_URL: 'https://fr.wikipedia.org/wiki/',
        SOURCE_NAME: "Wikipedia",
        WEIGHT: 0.4,
        THUMBNAIL_SIZE: 300 // Taille des vignettes pour les résultats web
    },

    // Configuration pour la recherche sur Vikidia
    VIKIDIA_SEARCH_CONFIG: {
        ENABLED: true,
        API_URL: 'https://fr.vikidia.org/w/api.php',
        BASE_URL: 'https://fr.vikidia.org/wiki/',
        SOURCE_NAME: "Vikidia",
        WEIGHT: 1,
        THUMBNAIL_SIZE: 300 // Taille des vignettes pour les résultats web
    },

    // Configuration pour la recherche d'images sur Wikimedia Commons
    COMMONS_IMAGE_SEARCH_CONFIG: {
        ENABLED: true,
        API_URL: 'https://commons.wikimedia.org/w/api.php',
        BASE_URL: 'https://commons.wikimedia.org/wiki/',
        SOURCE_NAME: "Wikimedia Commons",
        WEIGHT: 1, // Poids élevé car c'est une source d'images de qualité
        THUMBNAIL_SIZE: 400 // Taille des vignettes demandées à l'API
    },

    // Optionnel : Ajoutez votre propre instance MeiliSearch pour des résultats personnalisés
    MEILISEARCH_CONFIG: {
        ENABLED: false, // Mettre à true pour activer
        API_URL: 'https://your-meili-instance.com',   // URL de votre instance MeiliSearch
        API_KEY: 'your_meili_search_api_key',         // Clé API de recherche (pas la clé maître)
        INDEX_NAME: 'your_index_name',                // Nom de votre index
        SOURCE_NAME: 'Ma Source Personnalisée',       // Nom qui s'affichera dans les résultats
        WEIGHT: 0.6,                                  // Poids pour prioriser les résultats (0.1 à 1.0)
        BASE_URLS: ['https://your-website.com'],       // Liste des URLs de base des sites indexés (pour les exclure de Google)
        semanticSearch: {
            enabled: true,
            semanticRatio: 0.75
        }
    }
};

// Export pour utilisation dans les autres scripts, uniquement côté client
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}