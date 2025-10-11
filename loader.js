// loader.js - Version mise à jour
// 1. Charge config.js ou config.demo.js (synchrone)
// 2. Charge config-api-sources.json (asynchrone)

(function() {
    'use strict';

    // ========== PARTIE 1 : Chargement de config.js (ORIGINAL) ==========
    // Utilise une requête synchrone pour s'assurer que la configuration est chargée
    // avant que les autres scripts ne s'exécutent.
    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', 'config.js', false); // false = synchrone

    try {
        xhr.send();
        if (xhr.status === 200) {
            console.log(`✅ Using config.js for configuration.`);
            document.write('<script src="config.js"><\/script>');
        } else {
            console.log(`⚠️ Warning: config.js not found. Using config.demo.js for configuration.`);
            document.write('<script src="config.demo.js"><\/script>');
        }
    } catch (e) {
        console.warn("Erreur réseau ou exécution en local (file://). Chargement de config.demo.js.");
        document.write('<script src="config.demo.js"><\/script>');
    }

    // ========== PARTIE 2 : Chargement de config-api-sources.json (NOUVEAU) ==========

    /**
     * Charge la configuration des sources API depuis config-api-sources.json
     * Cette fonction s'exécute après que config.js/config.demo.js soit chargé
     */
    async function loadApiConfiguration() {
        console.log("loader.js: ⏳ Début du chargement de la configuration API...");
        try {
            // Attend que CONFIG soit défini (peut prendre quelques ms)
            let retries = 0;
            while (typeof window.CONFIG === 'undefined' && retries < 50) {
                await new Promise(resolve => setTimeout(resolve, 10));
                retries++;
            }

            if (typeof window.CONFIG === 'undefined') {
                console.warn('⚠️ CONFIG non défini après 500ms, initialisation...');
                window.CONFIG = {};
            }

            // Tente de charger config-api-sources.json, sinon config-api-sources-example.json
            let configUrl = 'config-api-sources.json';
            let response = await fetch(configUrl);
            if (!response.ok) {
                console.warn(`⚠️ ${configUrl} introuvable (status: ${response.status}). Tentative avec le fichier d'exemple.`);
                configUrl = 'config-api-sources-example.json';
                response = await fetch(configUrl);
            }

            if (!response.ok) {
                throw new Error(`Impossible de charger la configuration des API depuis ${configUrl} (status: ${response.status}).`);
            }

            const config = await response.json();
            console.log(`✅ Configuration des API chargée depuis : ${configUrl}`);
            // Ajoute les sources API à CONFIG
            window.CONFIG.API_SOURCES = config.apiSources || [];

            console.log(`✅ Configuration API chargée : ${window.CONFIG.API_SOURCES.length} sources disponibles depuis config-api-sources.json.`);

            // Affiche les sources actives en mode dev
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('dev')) {
                const activeSources = window.CONFIG.API_SOURCES.filter(s => s.enabled);
                console.log(`🔌 Sources actives (${activeSources.length}/${window.CONFIG.API_SOURCES.length}) : ${activeSources.map(s => s.name).join(', ')}`);
            }

            console.log("loader.js: 🚀 Dispatch de l'événement 'apiConfigLoaded'.");
            // Dispatch un événement personnalisé pour signaler que la config est prête
            window.dispatchEvent(new CustomEvent('apiConfigLoaded', {
                detail: { sources: window.CONFIG.API_SOURCES }
            }));
            window.apiConfigLoaded = true; // Ajout d'un drapeau global

            return true;
        } catch (error) {
            console.log("loader.js: ⚠️ Utilisation de la configuration de secours (fallback).");
            console.error('❌ Erreur lors du chargement de config-api-sources.json:', error);

            // Configuration de secours minimale basée sur l'ancien système
            window.CONFIG.API_SOURCES = [];

            // Migre automatiquement l'ancienne configuration si elle existe
            if (window.CONFIG.VIKIDIA_SEARCH_CONFIG?.ENABLED) {
                window.CONFIG.API_SOURCES.push({
                    id: 'vikidia',
                    name: 'Vikidia',
                    type: 'mediawiki',
                    enabled: true,
                    weight: window.CONFIG.VIKIDIA_SEARCH_CONFIG.WEIGHT || 0.5,
                    apiUrl: window.CONFIG.VIKIDIA_SEARCH_CONFIG.API_URL,
                    baseUrl: 'https://{lang}.vikidia.org',
                    articlePath: '/wiki/', // Assure que le chemin est correct
                    fetchThumbnails: true,
                    thumbnailSize: window.CONFIG.VIKIDIA_SEARCH_CONFIG.THUMBNAIL_SIZE || 200,
                    resultsLimit: 5,
                    excludeFromGoogle: true,
                    excludeDomains: ['vikidia.org'],
                    supportsImages: false
                });
                console.log('✅ Vikidia migré depuis ancienne config');
            }

            if (window.CONFIG.WIKIPEDIA_SEARCH_CONFIG?.ENABLED) {
                window.CONFIG.API_SOURCES.push({
                    id: 'wikipedia',
                    name: 'Wikipedia',
                    type: 'mediawiki',
                    enabled: true,
                    weight: window.CONFIG.WIKIPEDIA_SEARCH_CONFIG.WEIGHT || 0.5,
                    apiUrl: window.CONFIG.WIKIPEDIA_SEARCH_CONFIG.API_URL,
                    baseUrl: 'https://{lang}.wikipedia.org',
                    articlePath: '/wiki/', // Assure que le chemin est correct
                    fetchThumbnails: true,
                    thumbnailSize: window.CONFIG.WIKIPEDIA_SEARCH_CONFIG.THUMBNAIL_SIZE || 200,
                    resultsLimit: 5,
                    excludeFromGoogle: true,
                    excludeDomains: ['wikipedia.org'],
                    supportsImages: false
                });
                console.log('✅ Wikipedia migré depuis ancienne config');
            }

            if (window.CONFIG.COMMONS_IMAGE_SEARCH_CONFIG?.ENABLED) {
                window.CONFIG.API_SOURCES.push({
                    id: 'wikimedia-commons',
                    name: 'Wikimedia Commons',
                    type: 'mediawiki',
                    enabled: true,
                    weight: window.CONFIG.COMMONS_IMAGE_SEARCH_CONFIG.WEIGHT || 0.7,
                    apiUrl: window.CONFIG.COMMONS_IMAGE_SEARCH_CONFIG.API_URL,
                    baseUrl: 'https://commons.wikimedia.org',
                    thumbnailSize: window.CONFIG.COMMONS_IMAGE_SEARCH_CONFIG.THUMBNAIL_SIZE || 200,
                    resultsLimit: 10,
                    excludeFromGoogle: true,
                    excludeDomains: ['wikimedia.org', 'commons.wikimedia.org'],
                    supportsImages: true,
                    imageSearch: {
                        enabled: true,
                        excludeCategories: [
                            "Nudity in art",
                            "Erotic art",
                            "Sexual activity",
                            "Violence",
                            "Deaths",
                            "Human corpses"
                        ]
                    }
                });
                console.log('✅ Wikimedia Commons migré depuis ancienne config');
            }

            if (window.CONFIG.MEILISEARCH_CONFIG?.ENABLED) {
                window.CONFIG.API_SOURCES.push({
                    id: 'meilisearch-main',
                    name: window.CONFIG.MEILISEARCH_CONFIG.SOURCE_NAME || 'MeiliSearch',
                    type: 'meilisearch',
                    enabled: true,
                    weight: window.CONFIG.MEILISEARCH_CONFIG.WEIGHT || 0.6,
                    apiUrl: window.CONFIG.MEILISEARCH_CONFIG.API_URL,
                    apiKey: window.CONFIG.MEILISEARCH_CONFIG.API_KEY,
                    indexName: window.CONFIG.MEILISEARCH_CONFIG.INDEX_NAME,
                    resultsLimit: 5,
                    attributesToRetrieve: ['*', '_formatted'],
                    attributesToHighlight: ['title', 'content'],
                    attributesToCrop: ['content'],
                    cropLength: 30,
                    matchingStrategy: 'last',
                    filter: 'lang = {lang}',
                    excludeFromGoogle: true,
                    excludeDomains: window.CONFIG.MEILISEARCH_CONFIG.BASE_URLS || [],
                    supportsImages: true,
                    imageSearch: { enabled: true }
                });
                console.log('✅ MeiliSearch migré depuis ancienne config');
            }

            if (window.CONFIG.API_SOURCES.length === 0) {
                // Fallback ultime : Vikidia + Wikipedia par défaut
                window.CONFIG.API_SOURCES = [
                    {
                        id: 'vikidia',
                        name: 'Vikidia',
                        type: 'mediawiki',
                        enabled: true,
                        weight: 0.5,
                        apiUrl: 'https://{lang}.vikidia.org/w/api.php',
                        baseUrl: 'https://{lang}.vikidia.org',
                        articlePath: '/wiki/', // Chemin correct
                        fetchThumbnails: true,
                        thumbnailSize: 200,
                        resultsLimit: 5,
                        excludeFromGoogle: true,
                        excludeDomains: ['vikidia.org'],
                        supportsImages: false
                    },
                    {
                        id: 'wikipedia',
                        name: 'Wikipedia',
                        type: 'mediawiki',
                        enabled: true,
                        weight: 0.5,
                        apiUrl: 'https://{lang}.wikipedia.org/w/api.php',
                        baseUrl: 'https://{lang}.wikipedia.org',
                        articlePath: '/wiki/', // Chemin correct
                        fetchThumbnails: true,
                        thumbnailSize: 200,
                        resultsLimit: 5,
                        excludeFromGoogle: true,
                        excludeDomains: ['wikipedia.org'],
                        supportsImages: false
                    }
                ];
                console.warn('⚠️ Configuration de secours ultime chargée (Vikidia + Wikipedia)');
            } else {
                console.warn(`⚠️ Configuration migrée depuis ancien format (${window.CONFIG.API_SOURCES.length} sources)`);
            }

            console.log("loader.js: 🚀 Dispatch de l'événement 'apiConfigLoaded' (depuis fallback).");
            // Dispatch l'événement même en cas d'erreur
            window.dispatchEvent(new CustomEvent('apiConfigLoaded', {
                detail: { sources: window.CONFIG.API_SOURCES, fallback: true }
            }));
            window.apiConfigLoaded = true; // Ajout d'un drapeau global même en cas d'erreur

            return false;
        }
    }

    // Charge la configuration API dès que le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadApiConfiguration);
    } else {
        // Le DOM est déjà prêt, charge immédiatement
        loadApiConfiguration();
    }

    // Expose la fonction pour un rechargement manuel si nécessaire
    window.reloadApiConfiguration = loadApiConfiguration;

})();