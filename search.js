// Classes de cache séparées
class WebSearchCache {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 200;
        this.cacheExpiry = 7 * 24 * 60 * 60 * 1000;
        this.loadFromStorage();
    }

    createKey(query, page, sort = '') {
        return `web:${query.toLowerCase().trim()}:${page}:${sort}`;
    }

    saveToStorage() {
        try {
            const serialized = JSON.stringify([...this.cache]);
            localStorage.setItem('web_search_cache', serialized);
        } catch (e) {
            console.warn('Impossible de sauvegarder le cache web:', e);
        }
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('web_search_cache');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.cache = new Map(parsed);
                this.cleanExpiredEntries();
            }
        } catch (e) {
            console.warn('Impossible de charger le cache web:', e);
            this.cache = new Map();
        }
    }

    cleanExpiredEntries() {
        const now = Date.now();
        for (const [key, value] of this.cache) {
            if (now - value.timestamp > this.cacheExpiry) {
                this.cache.delete(key);
            }
        }
    }

    get(query, page, sort = '') {
        const key = this.createKey(query, page, sort);
        const entry = this.cache.get(key);

        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.cacheExpiry) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    set(query, page, data, sort = '') {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        const key = this.createKey(query, page, sort);
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });

        this.saveToStorage();
    }

    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize
        };
    }

    clear() {
        this.cache.clear();
        localStorage.removeItem('web_search_cache');
    }
}

class ImageSearchCache {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 100;
        this.cacheExpiry = 7 * 24 * 60 * 60 * 1000;
        this.enabled = true; // DÉSACTIVÉ pour l'instant
        if (this.enabled) {
            this.loadFromStorage();
        }
    }

    createKey(query, page) {
        return `images:${query.toLowerCase().trim()}:${page}`;
    }

    saveToStorage() {
        if (!this.enabled) return;
        try {
            const serialized = JSON.stringify([...this.cache]);
            localStorage.setItem('image_search_cache', serialized);
        } catch (e) {
            console.warn('Impossible de sauvegarder le cache images:', e);
        }
    }

    loadFromStorage() {
        if (!this.enabled) return;
        try {
            const stored = localStorage.getItem('image_search_cache');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.cache = new Map(parsed);
                this.cleanExpiredEntries();
            }
        } catch (e) {
            console.warn('Impossible de charger le cache images:', e);
            this.cache = new Map();
        }
    }

    cleanExpiredEntries() {
        if (!this.enabled) return;
        const now = Date.now();
        for (const [key, value] of this.cache) {
            if (now - value.timestamp > this.cacheExpiry) {
                this.cache.delete(key);
            }
        }
    }

    get(query, page) {
        if (!this.enabled) return null; // Cache désactivé

        const key = this.createKey(query, page);
        const entry = this.cache.get(key);

        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.cacheExpiry) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    set(query, page, data) {
        if (!this.enabled) return; // Cache désactivé

        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        const key = this.createKey(query, page);
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });

        this.saveToStorage();
    }

    getStats() {
        return {
            size: this.enabled ? this.cache.size : 0,
            maxSize: this.maxCacheSize,
            enabled: this.enabled
        };
    }

    clear() {
        this.cache.clear();
        localStorage.removeItem('image_search_cache');
    }

    enable() {
        this.enabled = true;
        this.loadFromStorage();
    }

    disable() {
        this.enabled = false;
        this.clear();
    }
}

// Gestionnaire de quota API
class ApiQuotaManager {
    constructor() {
        this.dailyLimit = 90; // Limite conservative (100 - marge de sécurité)
        this.loadUsage();
    }

    loadUsage() {
        const stored = localStorage.getItem('api_usage');
        if (stored) {
            const data = JSON.parse(stored);
            const today = new Date().toDateString();

            if (data.date === today) {
                this.todayUsage = data.count;
            } else {
                this.todayUsage = 0;
                this.saveUsage();
            }
        } else {
            this.todayUsage = 0;
        }
    }

    saveUsage() {
        const data = {
            date: new Date().toDateString(),
            count: this.todayUsage
        };
        localStorage.setItem('api_usage', JSON.stringify(data));
    }

    canMakeRequest() {
        return this.todayUsage < this.dailyLimit;
    }

    recordRequest() {
        this.todayUsage++;
        this.saveUsage();
    }

    getUsage() {
        return {
            used: this.todayUsage,
            limit: this.dailyLimit,
            remaining: this.dailyLimit - this.todayUsage
        };
    }

    getRemainingRequests() {
        return Math.max(0, this.dailyLimit - this.todayUsage);
    }
}

// search.js — version complète, autonome avec caches séparés
document.addEventListener('DOMContentLoaded', () => {
    // ========== Config & état ==========
    const RESULTS_PER_PAGE = 10;
    let currentSearchType = 'web'; // 'web' ou 'images'
    let currentQuery = '';
    let currentSort = ''; // '' (pertinence) ou 'date'
    let currentPage = 1;
    const webCache = new WebSearchCache();
    const imageCache = new ImageSearchCache(); // Cache images désactivé par défaut
    const quotaManager = new ApiQuotaManager();

    // ========== DOM refs ==========
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearButton');
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');
    const loadingEl = document.getElementById('loadingIndicator');
    const resultsContainer = document.getElementById('resultsContainer');
    const statsEl = document.getElementById('searchStats');
    const paginationEl = document.getElementById('pagination');
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalSource = document.getElementById('modalSource');
    const modalDimensions = document.getElementById('modalDimensions');
    const webTab = document.getElementById('webTab');
    const imagesTab = document.getElementById('imagesTab');
    const toolsContainer = document.getElementById('toolsContainer');
    const toolsButton = document.getElementById('toolsButton');

    if (!searchInput) {
        console.error('search.js: #searchInput introuvable dans le DOM');
        return;
    }

    // ========== Suggestions/autocomplete ==========
    let suggestions = [];
    let selectedIndex = -1;
    let inputDebounceTimer = null;
    let currentSuggestionsLang = navigator.language.startsWith('en') ? 'en' : 'fr';

    function loadSuggestions() {
        const lang = i18n.getLang();

        // Éviter de recharger si c'est déjà la bonne langue
        if (currentSuggestionsLang === lang && suggestions.length > 0) {
            return;
        }

        currentSuggestionsLang = lang;
        const suggestionsFile = lang === 'en' ? 'suggestions-en.json' : 'suggestions.json';

        fetch(suggestionsFile)
            .then(r => r.json())
            .then(j => { suggestions = j.suggestions || []; })
            .catch((err) => {
                console.warn(`Impossible de charger ${suggestionsFile}, utilisation des suggestions de secours.`, err);
                suggestions = lang === 'en'
                    ? ["animals", "dinosaurs", "planets", "science", "history"]
                    : ["animaux", "planètes", "dinosaures", "sciences", "histoire"];
            });
    }

    loadSuggestions();

    // ========== Helpers ==========
    function updateUrl(query, type = currentSearchType, page = 1, sort = currentSort) {
        try {
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('q', query);
            newUrl.searchParams.set('type', type);
            if (page && page > 1) newUrl.searchParams.set('p', page);
            else newUrl.searchParams.delete('p');
            if (sort) newUrl.searchParams.set('sort', sort);
            else newUrl.searchParams.delete('sort');
            window.history.pushState({}, '', newUrl);
        } catch (e) {
            // ignore if URL API unavailable
        }
    }

    /**
     * Détecte la langue d'une requête (français ou anglais).
     * @param {string} query La chaîne de recherche.
     * @returns {('fr'|'en'|null)} Le code de langue détecté ou null.
     */
    function detectQueryLanguage(query) {
        const lowerQuery = query.toLowerCase();

        // Le français est prioritaire à cause des accents qui sont un indicateur fort.
        const frenchChars = /[àâçéèêëîïôûùüÿœæ]/i;
        const commonFrenchWords = /\b(le|la|les|un|une|des|de|du|et|ou|est|pour|que|qui)\b/i;
        if (frenchChars.test(lowerQuery) || commonFrenchWords.test(lowerQuery)) {
            return 'fr';
        }

        // Détection de l'anglais avec des mots courants peu probables en français.
        const commonEnglishWords = /\b(the|and|for|what|who|are|of|in|to|it|is)\b/i;
        if (commonEnglishWords.test(lowerQuery)) {
            return 'en';
        }

        return null; // Langue non détectée
    }

    function buildApiUrl(query, type, page, sort) {
        const startIndex = (page - 1) * RESULTS_PER_PAGE + 1;
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        url.searchParams.set('q', query);
        url.searchParams.set('key', CONFIG.GOOGLE_API_KEY);
        url.searchParams.set('cx', CONFIG.GOOGLE_CSE_ID);
        url.searchParams.set('start', String(startIndex));
        url.searchParams.set('num', String(RESULTS_PER_PAGE));
        url.searchParams.set('safe', 'active');
        url.searchParams.set('filter', '1');
        if (type === 'images') url.searchParams.set('searchType', 'image');
        if (sort) url.searchParams.set('sort', sort);

        // Priorise les résultats en fonction de la langue détectée pour la recherche web
        if (type === 'web') {
            const lang = detectQueryLanguage(query);
            if (lang === 'fr') {
                console.log("🇫🇷 Requête en français détectée, application du filtre 'lang_fr'.");
                url.searchParams.set('lr', 'lang_fr');
            } else if (lang === 'en') {
                console.log("🇬🇧 Requête en anglais détectée, application du filtre 'lang_en'.");
                url.searchParams.set('lr', 'lang_en');
            }
        }

        return url.toString();
    }

    function showLoading() {
        if (loadingEl) loadingEl.style.display = 'flex';
    }
    function hideLoading() {
        if (loadingEl) loadingEl.style.display = 'none';
    }

    // ========== Recherche principale ==========
    function doSearch(e) {
        if (e) e.preventDefault(); // Empêche la soumission du formulaire

        const q = searchInput.value.trim();
        if (!q) return;

        // Si on est sur la page d'accueil, on redirige vers la page de résultats
        if (document.body.classList.contains('is-homepage')) {
            // Donne le focus au bouton pour indiquer l'action et fermer le clavier sur mobile
            const searchButton = document.getElementById('searchButton');
            if (searchButton) searchButton.focus();

            // Construit la nouvelle URL en préservant le mode développeur
            let newUrl = `results.html?q=${encodeURIComponent(q)}`;
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('dev')) {
                newUrl += '&dev=1';
            }
            window.location.href = newUrl;
            return;
        }

        // Si on est déjà sur la page de résultats, on lance une nouvelle recherche
        if (document.body.classList.contains('is-resultspage')) {
            currentQuery = q;
            currentPage = 1;
            currentSort = ''; // Réinitialiser le tri pour une nouvelle recherche
            performSearch(currentQuery, currentSearchType, currentPage, currentSort);
            document.title = `${currentQuery} - Search for Kids`;
            updateUrl(currentQuery, currentSearchType, currentPage, currentSort);
        }
    }

    async function performSearch(query, type = 'web', page = 1) {
        console.log('🚀 performSearch DÉBUT avec:', query, type, page);

        if (!query) {
            console.log('❌ performSearch STOP: query vide');
            return;
        }

        console.log('✅ Query OK, showLoading()');
        showLoading();

        console.log('✅ Vidage conteneurs');
        resultsContainer.innerHTML = '';
        statsEl.innerHTML = '';
        paginationEl.innerHTML = '';

        // Affiche le panneau de connaissances (uniquement pour la première page web)
        if (typeof tryDisplayKnowledgePanel === 'function' && type === 'web' && page === 1) {
            console.log('✅ Appel knowledge panel');
            tryDisplayKnowledgePanel(query);
        }

        console.log('✅ Construction URL API');
        const apiUrl = buildApiUrl(query, type, page, currentSort);
        console.log('🔗 URL construite:', apiUrl);

        // Utilisation des caches séparés
        let cachedData = null;
        if (type === 'web') {
            console.log('✅ Vérification cache WEB');
            cachedData = webCache.get(query, page, currentSort);
        } else if (type === 'images') {
            console.log('✅ Vérification cache IMAGES (désactivé)');
            cachedData = imageCache.get(query, page); // Retournera null car désactivé
        }

        if (cachedData) {
            console.log('📦 Cache trouvé, affichage résultats');
            hideLoading();
            displayResults(cachedData, type, query, page);
            updateQuotaDisplay();
            return;
        }

        console.log('✅ Pas de cache, appel API pour type:', type);

        try {
            const res = await fetch(apiUrl);
            const data = await res.json();

            console.log('🔗 URL API utilisée:', apiUrl);
            console.log('📊 Réponse complète API:', data);
            console.log('🔢 Nombre items:', data.items?.length);
            data.items?.forEach((item, i) => {
                console.log(`${i+1}. ${item.displayLink} - ${item.title}`);
            });
            hideLoading();

            // Sauvegarde dans le cache approprié
            if (type === 'web') {
                webCache.set(query, page, data, currentSort);
                console.log('💾 Données sauvées dans cache WEB');
            } else if (type === 'images') {
                imageCache.set(query, page, data);
                console.log('💾 Données PAS sauvées dans cache IMAGES (désactivé)');
            }

            quotaManager.recordRequest();
            updateQuotaDisplay();

            if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
            displayResults(data, type, query, page);
        } catch (err) {
            hideLoading();
            resultsContainer.innerHTML = `<div style="padding:2rem; text-align:center; color:#d93025;">
        <p>Une erreur s'est produite lors de la recherche.</p>
        <p style="font-size:14px; color:#70757a;">${err.message || err}</p>
      </div>`;
            console.error('performSearch error', err);
        }
    }

    // ========== Affichage résultats ==========
    function displayResults(data, type, query, page) {
        // Stats
        let totalResults = 0;
        if (data.searchInformation) {
            totalResults = parseInt(data.searchInformation.totalResults || data.searchInformation.formattedTotalResults || '0', 10) || 0;
            const time = data.searchInformation.searchTime || data.searchInformation.formattedSearchTime || '';
            const formattedResults = totalResults.toLocaleString(i18n.getLang() === 'fr' ? 'fr-FR' : 'en-US');
            let statsText = totalResults ? `${i18n.get('aboutResults')} ${formattedResults} ${i18n.get('results')}` : '';
            if (time) {
                statsText += ` (${parseFloat(time).toFixed(2)}s)`;
            }
            statsEl.textContent = statsText;
        } else {
            statsEl.textContent = '';
        }

        // Gérer la visibilité du bouton Outils
        if (toolsContainer) {
            toolsContainer.style.display = (type === 'web' && totalResults > 0) ? 'flex' : 'none';
        }

        if (!data.items || data.items.length === 0) {
            const noResultsMsg = i18n.get(type === 'images' ? 'noImages' : 'noResults') + ` "${query}"`;
            resultsContainer.innerHTML = `<div style="padding:2rem; text-align:center; color:#70757a;">
    <p>${noResultsMsg}</p>
</div>`;
            createPagination(totalResults, page);
            return;
        }

        if (type === 'web') {
            resultsContainer.classList.remove('grid');
            data.items.forEach(item => {
                resultsContainer.appendChild(createSearchResult(item));
            });
        } else {
            resultsContainer.classList.add('grid');
            data.items.forEach(item => {
                resultsContainer.appendChild(createImageResult(item));
            });
        }

        createPagination(totalResults, page, data);
    }

    // ========== Création d'un résultat web ==========
    function createSearchResult(item) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'search-result';

        const thumbnail = (item.pagemap && item.pagemap.cse_thumbnail && item.pagemap.cse_thumbnail[0]) ? `<img src="${item.pagemap.cse_thumbnail[0].src}" alt="">` : '';
        resultDiv.innerHTML = `
      <div class="result-thumbnail">${thumbnail}</div>
      <div class="result-content">
        <div class="result-url">${item.displayLink || ''}</div>
        <div class="result-title"><a href="${item.link || '#'}" target="_blank" rel="noopener noreferrer">${item.title || ''}</a></div>
        <div class="result-snippet">${item.htmlSnippet || item.snippet || ''}</div>
      </div>
    `;
        return resultDiv;
    }

    // ========== Création d'une vignette image OPTIMISÉE ==========
    function createImageResult(item) {
        const div = document.createElement('div');
        div.className = 'image-result';
        div.onclick = () => openImageModal(item);

        // Récupération de l'URL de l'image avec fallback
        const imgUrl = item.link || (item.image && item.image.thumbnailLink) || '';

        // Création de l'image avec gestion de l'erreur de chargement
        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = item.title || '';
        img.loading = 'lazy';

        // Styles CSS intégrés pour forcer un affichage carré responsive
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            display: block;
            border-radius: 8px;
        `;

        // Gestion de l'erreur de chargement
        img.onerror = function() {
            this.parentElement.style.display = 'none';
        };

        // Conteneur de l'image avec dimensions fixes et responsive
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
            position: relative;
            width: 100%;
            aspect-ratio: 1 / 1;
            overflow: hidden;
            border-radius: 8px;
            margin-bottom: 8px;
            background-color: #f8f9fa;
        `;

        imageContainer.appendChild(img);

        // Informations de l'image
        const infoDiv = document.createElement('div');
        infoDiv.className = 'image-info';
        infoDiv.style.cssText = `
            padding: 4px 0;
        `;

        const titleDiv = document.createElement('div');
        titleDiv.className = 'image-title';
        titleDiv.textContent = item.title || '';
        titleDiv.style.cssText = `
            font-size: 12px;
            line-height: 1.3;
            color: #202124;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            margin-bottom: 2px;
        `;

        const sourceDiv = document.createElement('div');
        sourceDiv.className = 'image-source';
        sourceDiv.textContent = item.displayLink || '';
        sourceDiv.style.cssText = `
            font-size: 11px;
            color: #70757a;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;

        infoDiv.appendChild(titleDiv);
        infoDiv.appendChild(sourceDiv);

        // Styles pour le conteneur principal
        div.style.cssText = `
            cursor: pointer;
            border-radius: 8px;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            background-color: white;
            overflow: hidden;
        `;

        // Effet au survol/touch
        div.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.02)';
            this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        });

        div.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = 'none';
        });

        div.appendChild(imageContainer);
        div.appendChild(infoDiv);

        return div;
    }

    // ========== Pagination ==========
    function createPagination(totalResults = 0, page = 1, data = null) {
        paginationEl.innerHTML = '';
        const maxPages = totalResults ? Math.min(Math.ceil(totalResults / RESULTS_PER_PAGE), 10) : page;

        if (page > 1) {
            const prev = document.createElement('button');
            prev.textContent = i18n.get('previousButton');
            prev.onclick = () => {
                currentPage = Math.max(1, page - 1);
                performSearch(currentQuery, currentSearchType, currentPage, currentSort);
                updateUrl(currentQuery, currentSearchType, currentPage, currentSort);
            };
            paginationEl.appendChild(prev);
        }

        // pages around current page (simple)
        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(maxPages, startPage + 4);
        for (let i = startPage; i <= endPage; i++) {
            const pbtn = document.createElement('button');
            pbtn.textContent = i;
            if (i === page) pbtn.className = 'current';
            pbtn.onclick = () => {
                if (i !== page) {
                    currentPage = i;
                    performSearch(currentQuery, currentSearchType, currentPage, currentSort);
                    updateUrl(currentQuery, currentSearchType, currentPage, currentSort);
                }
            };
            paginationEl.appendChild(pbtn);
        }

        if (data && data.queries && data.queries.nextPage) {
            const next = document.createElement('button');
            next.textContent = i18n.get('nextButton');
            next.onclick = () => {
                currentPage = page + 1;
                performSearch(currentQuery, currentSearchType, currentPage, currentSort);
                updateUrl(currentQuery, currentSearchType, currentPage, currentSort);
            };
            paginationEl.appendChild(next);
        }
    }

    // ========== Onglets ==========
    function switchTab(type) {
        console.log('🔄 switchTab appelé avec:', type);
        console.log('🔄 currentQuery avant:', currentQuery);

        currentSearchType = type;
        if (webTab) webTab.classList.toggle('active', type === 'web');
        if (imagesTab) imagesTab.classList.toggle('active', type === 'images');

        if (currentQuery) {
            console.log('🔍 Lancement performSearch avec:', currentQuery, currentSearchType);
            currentPage = 1;
            if (type === 'images') {
                currentSort = '';
            }
            performSearch(currentQuery, currentSearchType, currentPage, currentSort);
            updateUrl(currentQuery, currentSearchType, currentPage, currentSort);
        } else {
            console.log('❌ currentQuery vide, pas de recherche');
        }
    }

    // Ensure onclick attributes (if present in HTML) still work:
    console.log('Vérification des éléments onglets:');
    console.log('webTab trouvé:', !!webTab);
    console.log('imagesTab trouvé:', !!imagesTab);

    if (webTab) {
        webTab.addEventListener('click', (e) => {
            console.log('Clic webTab détecté');
            e.preventDefault();
            switchTab('web');
        });
    } else {
        console.error('webTab introuvable !');
    }

    if (imagesTab) {
        imagesTab.addEventListener('click', (e) => {
            console.log('Clic imagesTab détecté');
            e.preventDefault();
            switchTab('images');
        });
    } else {
        console.error('imagesTab introuvable !');
    }

    // ========== Tri ==========
    function setupSortOptions() {
        const sortPanel = document.getElementById('sortPanel');
        if (!sortPanel || !toolsButton) return;

        const sortOptions = sortPanel.querySelectorAll('.sort-option');

        sortOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const newSort = e.target.getAttribute('data-sort');
                if (newSort === currentSort) {
                    sortPanel.style.display = 'none'; // Ferme si on reclique sur la même option
                    return;
                }
                currentSort = newSort;
                sortPanel.style.display = 'none'; // Ferme le panneau après sélection

                performSearch(currentQuery, currentSearchType, 1, currentSort); // Relance à la page 1
                updateUrl(currentQuery, currentSearchType, 1, currentSort);
            });
        });

        toolsButton.addEventListener('click', (e) => {
            e.preventDefault(); // Empêche le lien de suivre l'URL href="#"
            e.stopPropagation(); // Empêche le clic de se propager au document
            const sortPanel = document.getElementById('sortPanel');
            sortPanel.style.display = sortPanel.style.display === 'block' ? 'none' : 'block';

            // Met à jour l'état "actif" du menu
            if (sortPanel.style.display === 'block') {
                sortOptions.forEach(opt => opt.classList.toggle('active', opt.getAttribute('data-sort') === currentSort));
            }
        });
    }

    // ========== Modal images ==========
    function openImageModal(item) {
        const imgUrl = item.link || (item.image && item.image.contextLink) || '';
        modalImage.src = imgUrl;
        modalTitle.textContent = item.title || '';
        modalSource.innerHTML = item.image && item.image.contextLink ? `<a href="${item.image.contextLink}" target="_blank" rel="noopener noreferrer">${item.displayLink || item.image.contextLink}</a>` : (item.displayLink || '');
        modalDimensions.textContent = item.image ? `${item.image.width} × ${item.image.height} pixels` : '';
        imageModal.style.display = 'flex';
    }
    function closeImageModal() {
        modalImage.src = '';
        imageModal.style.display = 'none';
    }
    if (imageModal) {
        imageModal.addEventListener('click', (e) => { if (e.target === imageModal) closeImageModal(); });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeImageModal();
    });

    // ========== Autocomplete UI & keyboard ==========
    // Dans l'event listener 'input', remplacer le filtrage par :
    searchInput.addEventListener('input', (ev) => {
        // Gère la visibilité du bouton pour effacer
        if (clearButton) {
            clearButton.style.display = searchInput.value.length > 0 ? 'block' : 'none';
        }


        const value = searchInput.value.toLowerCase().trim();
        clearTimeout(inputDebounceTimer);
        inputDebounceTimer = setTimeout(() => {
            autocompleteDropdown.innerHTML = '';
            selectedIndex = -1;
            if (!value || !suggestions.length) {
                autocompleteDropdown.style.display = 'none';
                return;
            }

            loadSuggestions(); // S'assure que les suggestions sont chargées

            const matches = suggestions.filter(s => s.toLowerCase().includes(value)).slice(0, 8);
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.textContent = match;
                div.addEventListener('click', () => {
                    searchInput.value = match;
                    autocompleteDropdown.style.display = 'none';
                    doSearch();
                });
                autocompleteDropdown.appendChild(div);
            });
            autocompleteDropdown.style.display = matches.length ? 'block' : 'none';
        }, 150);
    });

    searchInput.addEventListener('keydown', (e) => {
        const items = Array.from(autocompleteDropdown.getElementsByClassName('autocomplete-item'));
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(items.length - 1, selectedIndex + 1);
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(-1, selectedIndex - 1);
            updateSelection(items);
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0 && items[selectedIndex]) {
                e.preventDefault();
                items[selectedIndex].click();
                autocompleteDropdown.style.display = 'none'; // Fermer le dropdown
            } else {
                // allow form submit normally -> we intercept via doSearch on submit
            }
        } else if (e.key === 'Escape') {
            autocompleteDropdown.style.display = 'none';
        }
    });

    function updateSelection(items) {
        items.forEach((it, idx) => it.classList.toggle('selected', idx === selectedIndex));
        if (selectedIndex >= 0 && items[selectedIndex]) items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }

    document.addEventListener('click', (e) => {
        if (!autocompleteDropdown.contains(e.target) && e.target !== searchInput) {
            autocompleteDropdown.style.display = 'none';
            selectedIndex = -1;
        }
        // Ferme le panneau de tri si on clique en dehors
        const sortPanel = document.getElementById('sortPanel');
        const toolsBtn = document.getElementById('toolsButton');
        if (sortPanel && sortPanel.style.display === 'block') {
            if (!sortPanel.contains(e.target) && e.target !== toolsBtn) {
                sortPanel.style.display = 'none';
            }
        }
    });

    // Gère le clic sur le bouton pour effacer
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            clearButton.style.display = 'none';
            autocompleteDropdown.style.display = 'none';
            selectedIndex = -1;
            searchInput.focus();
        });
    }

    // ========== Form submit binding ==========
    const form = document.querySelector('.search-bar form') || document.querySelector('form');
    if (form) form.addEventListener('submit', doSearch);

    // ========== Auto-run if q in URL ==========
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('q')) {
            document.body.classList.add('is-resultspage');
            const qParam = params.get('q');
            const typeParam = params.get('type');
            const sortParam = params.get('sort');
            const pageParam = parseInt(params.get('p') || '1', 10) || 1;

            // CORRECTION : Déterminer le type initial basé sur l'URL OU l'état visuel des onglets
            if (typeParam === 'images') {
                currentSearchType = 'images';
            } else if (imagesTab && imagesTab.classList.contains('active') && !webTab.classList.contains('active')) {
                // Si l'onglet Images est visuellement actif mais pas dans l'URL, on synchronise
                currentSearchType = 'images';
            }

            if (qParam) {
                currentSort = sortParam || '';
                searchInput.value = qParam;
                currentQuery = qParam;
                currentPage = pageParam;

                // AFFICHE LA CROIX si le champ est pré-rempli
                if (clearButton && searchInput.value.length > 0) {
                    clearButton.style.display = 'block';
                }

                // S'assurer que l'UI des onglets correspond à currentSearchType
                if (currentSearchType === 'images') {
                    if (webTab) webTab.classList.remove('active');
                    if (imagesTab) imagesTab.classList.add('active');
                } else {
                    if (webTab) webTab.classList.add('active');
                    if (imagesTab) imagesTab.classList.remove('active');
                }

                performSearch(currentQuery, currentSearchType, currentPage, currentSort);
            }
        } else if (document.getElementById('logo')) {
            document.body.classList.add('is-homepage');
        }
    } catch (e) {
        // ignore URL parsing errors
    }

    // Initialisation
    if (document.getElementById('sortPanel')) setupSortOptions();

// =========================================================================
// QUOTA DISPLAY (avec mode développeur activé via ?dev=1)
// =========================================================================

// Détection du mode développeur
    // =========================================================================
// QUOTA DISPLAY (avec mode développeur activé via ?dev=1)
    const urlParams = new URLSearchParams(window.location.search);
    const isDevMode = urlParams.has('dev');

    function updateQuotaDisplay() {
        if (!isDevMode) {
            const quotaEl = document.getElementById('quotaIndicator');
            if (quotaEl) quotaEl.remove(); // supprime si déjà affiché
            return;
        }

        const usage = quotaManager.getUsage();
        const webStats = webCache.getStats();
        const imageStats = imageCache.getStats();

        let quotaEl = document.getElementById('quotaIndicator');
        if (!quotaEl) {
            quotaEl = document.createElement('div');
            quotaEl.id = 'quotaIndicator';
            quotaEl.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: #f8f9fa;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 12px;
            color: #70757a;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            z-index: 1000;
        `;
            document.body.appendChild(quotaEl);
        }

        const quotaColor = usage.remaining > 20 ? '#34a853' : usage.remaining > 5 ? '#fbbc04' : '#ea4335';
        quotaEl.innerHTML = `
        📊 API: <span style="color:${quotaColor}">${usage.remaining}</span>/${usage.limit} |
        📋 Web: ${webStats.size}/${webStats.maxSize} |
        🖼️ Images: ${imageStats.enabled ? imageStats.size + '/' + imageStats.maxSize : 'OFF'} |
        <button id="devClearBtn" style="
            margin-left:8px;
            background:#fff;
            border:1px solid #ccc;
            border-radius:4px;
            padding:2px 6px;
            cursor:pointer;
        ">🗑️ Vider les caches</button>
    `;

        // Ajout du bouton effacer cache
        const clearBtn = document.getElementById('devClearBtn');
        if (clearBtn && !clearBtn.dataset.listenerAttached) {
            clearBtn.onclick = () => {
                if (confirm("Effacer cache et quotas ?")) {
                    try {
                        webCache.clear();
                        imageCache.clear();
                        localStorage.removeItem('api_usage');
                    } catch (e) {
                        console.warn("Erreur lors du clear cache:", e);
                    }
                    alert("Caches vidés. Rechargement...");
                    window.location.reload();
                }
            };
            clearBtn.dataset.listenerAttached = 'true';
        }
    }


    // Mise à jour initiale de l'affichage du quota
    updateQuotaDisplay();

    // ========== CSS dynamique pour grille d'images responsive ==========
    function injectResponsiveImageGridCSS() {
        if (document.getElementById('responsive-image-grid-styles')) return; // Évite les doublons

        const style = document.createElement('style');
        style.id = 'responsive-image-grid-styles';
        style.textContent = `
            /* Grille responsive pour les images optimisée mobile */
            #resultsContainer.grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 12px;
                padding: 16px 12px;
            }

            /* Adaptations pour différentes tailles d'écran */
            @media (max-width: 480px) {
                #resultsContainer.grid {
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                    padding: 12px 8px;
                }
            }

            @media (min-width: 481px) and (max-width: 768px) {
                #resultsContainer.grid {
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                }
            }

            @media (min-width: 769px) and (max-width: 1024px) {
                #resultsContainer.grid {
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                }
            }

            @media (min-width: 1025px) {
                #resultsContainer.grid {
                    grid-template-columns: repeat(5, 1fr);
                    gap: 14px;
                }
            }

            /* Styles pour les résultats d'images */
            .image-result {
                background: white;
                border-radius: 8px;
                overflow: hidden;
                transition: all 0.2s ease;
                cursor: pointer;
            }

            .image-result:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }

            .image-result:active {
                transform: translateY(0);
                transition: transform 0.1s ease;
            }

            /* Conteneur d'image avec aspect ratio fixe */
            .image-result .image-container {
                position: relative;
                width: 100%;
                aspect-ratio: 1 / 1;
                overflow: hidden;
                background-color: #f8f9fa;
            }

            /* Image responsive et centrée */
            .image-result img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                object-position: center;
                display: block;
                transition: transform 0.3s ease;
            }

            .image-result:hover img {
                transform: scale(1.05);
            }

            /* Informations de l'image */
            .image-result .image-info {
                padding: 8px;
            }

            .image-result .image-title {
                font-size: 12px;
                line-height: 1.3;
                color: #202124;
                overflow: hidden;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                margin-bottom: 4px;
                word-break: break-word;
            }

            .image-result .image-source {
                font-size: 11px;
                color: #70757a;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* Optimisations tactiles pour mobile */
            @media (hover: none) and (pointer: coarse) {
                .image-result {
                    transition: none;
                }
                
                .image-result:hover {
                    transform: none;
                    box-shadow: none;
                }
                
                .image-result:hover img {
                    transform: none;
                }
                
                .image-result:active {
                    background-color: #f8f9fa;
                    transform: scale(0.98);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Injecter les styles CSS au chargement
    injectResponsiveImageGridCSS();
});