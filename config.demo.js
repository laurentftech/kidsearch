// Fichier de configuration pour la DÉMONSTRATION GitHub Pages
// Ce fichier utilise des clés factices. La recherche ne fonctionnera pas.
// Pour une utilisation locale, copiez ceci dans config.js et ajoutez vos vraies clés.

const CONFIG = {
    // Remplacez par votre ID Google Custom Search Engine
    GOOGLE_CSE_ID: 'a6720f2d052674a01', // La recherche ne fonctionnera pas sans un vrai ID

    // Clé API Google (nécessaire pour l'API JSON)
    GOOGLE_API_KEY: 'AIzaSyCmFZ1NVQJo4H-Dv0mFAggAu5PO76TrfwA', // La recherche ne fonctionnera pas sans une vraie clé

    // Configuration pour les panneaux de connaissances
    KNOWLEDGE_PANEL_CONFIG: {
        ENABLED: true,
        API_URL: 'https://fr.vikidia.org/w/api.php',
        BASE_URL: 'https://fr.vikidia.org/wiki/',
        SOURCE_NAME: "Vikidia - L'encyclopédie des 8-13 ans",
        EXTRACT_LENGTH: 400,
        THUMBNAIL_SIZE: 300,
        DISABLE_THUMBNAILS: true
    }
};

// Export pour utilisation dans les autres scripts
window.CONFIG = CONFIG;
