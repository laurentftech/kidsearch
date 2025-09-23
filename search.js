
class SearchCache {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 300; // Cache plus important pour usage familial
        this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 jours au lieu de 1
        this.loadFromStorage();
    }

    // Créer une clé unique pour la requête
    createKey(query, page, searchType) {
        return `${searchType}:${query.toLowerCase().trim()}:${page}`;
    }

    // Sauvegarder dans localStorage
    saveToStorage() {
        try {
            const serialized = JSON.stringify([...this.cache]);
            localStorage.setItem('search_cache', serialized);
        } catch (e) {
            console.warn('Impossible de sauvegarder le cache:', e);
        }
    }

    // Charger depuis localStorage
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('search_cache');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.cache = new Map(parsed);
                this.cleanExpiredEntries();
            }
        } catch (e) {
            console.warn('Impossible de charger le cache:', e);
            this.cache = new Map();
        }
    }

    // Nettoyer les entrées expirées
    cleanExpiredEntries() {
        const now = Date.now();
        for (const [key, value] of this.cache) {
            if (now - value.timestamp > this.cacheExpiry) {
                this.cache.delete(key);
            }
        }
    }

    // Obtenir depuis le cache
    get(query, page, searchType) {
        const key = this.createKey(query, page, searchType);
        const entry = this.cache.get(key);

        if (!entry) return null;

        // Vérifier l'expiration
        if (Date.now() - entry.timestamp > this.cacheExpiry) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    // Stocker dans le cache
    set(query, page, searchType, data) {
        // Nettoyer le cache si trop plein
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        const key = this.createKey(query, page, searchType);
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });

        this.saveToStorage();
    }

    // Statistiques du cache
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize
        };
    }

    // Vider le cache
    clear() {
        this.cache.clear();
        localStorage.removeItem('search_cache');
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

// search.js — version complète, autonome
document.addEventListener('DOMContentLoaded', () => {
    // ========== Config & état ==========
    const RESULTS_PER_PAGE = 10;
    let currentSearchType = 'web'; // 'web' ou 'images'
    let currentQuery = '';
    let currentSort = ''; // '' (pertinence) ou 'date'
    let currentPage = 1;
    const searchCache = new SearchCache();
    const quotaManager = new ApiQuotaManager();

    // ========== DOM refs ==========
    const searchInput = document.getElementById('searchInput');
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

    function isFrenchQuery(query) {
        // Contient des caractères accentués français ou des mots courants
        const frenchChars = /[àâçéèêëîïôûùüÿœæ]/i;
        const commonFrenchWords = /\b(le|la|les|un|une|des|de|du|et|ou|est|pour|que|qui)\b/i;
        return frenchChars.test(query) || commonFrenchWords.test(query);
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

        // Priorise les résultats en français si la requête semble être en français
        if (isFrenchQuery(query)) {
            console.log("🇫🇷 Requête détectée en français, application du filtre de langue 'lang_fr'.");
            url.searchParams.set('lr', 'lang_fr');
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
            window.location.href = `results.html?q=${encodeURIComponent(q)}`;
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
        if (!query) return;
        showLoading();
        resultsContainer.innerHTML = ''; // Vider le conteneur unique
        statsEl.innerHTML = '';
        paginationEl.innerHTML = '';

        // Affiche le panneau de connaissances (uniquement pour la première page web)
        if (typeof tryDisplayKnowledgePanel === 'function' && type === 'web' && page === 1) {
            tryDisplayKnowledgePanel(query);
        }

        const apiUrl = buildApiUrl(query, type, page, currentSort);
        const cachedData = searchCache.get(query, page, type);
        if (cachedData) {
            hideLoading();
            displayResults(cachedData, type, query, page);
            updateQuotaDisplay(); // Mettre à jour l'affichage du quota même si on utilise le cache
            return;
        }

        try {
            const res = await fetch(apiUrl);
            const data = await res.json();
            hideLoading();

            searchCache.set(query, page, type, data);
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

    // ========== Création d'une vignette image ==========
    function createImageResult(item) {
        const div = document.createElement('div');
        div.className = 'image-result';
        div.onclick = () => openImageModal(item);

        // item.link is usually the direct image URL in CSE image results
        const imgUrl = item.link || (item.image && item.image.thumbnailLink) || '';

        div.innerHTML = `
      <img src="${imgUrl}" alt="${item.title || ''}" loading="lazy" onerror="this.parentElement.style.display='none'">
      <div class="image-info">
        <div class="image-title">${item.title || ''}</div>
        <div class="image-source">${item.displayLink || ''}</div>
      </div>
    `;
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
        currentSearchType = type;
        if (webTab) webTab.classList.toggle('active', type === 'web');
        if (imagesTab) imagesTab.classList.toggle('active', type === 'images');

        if (currentQuery) {
            currentPage = 1;
            // Le tri par date n'est pas utile pour les images, on le réinitialise
            if (type === 'images') {
                currentSort = '';
            }
            performSearch(currentQuery, currentSearchType, currentPage, currentSort);
            updateUrl(currentQuery, currentSearchType, currentPage, currentSort);
        }
    }

    // Ensure onclick attributes (if present in HTML) still work:
    if (webTab) webTab.addEventListener('click', (e) => { e.preventDefault(); switchTab('web'); });
    if (imagesTab) imagesTab.addEventListener('click', (e) => { e.preventDefault(); switchTab('images'); });
    
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
            if (typeParam === 'images') currentSearchType = 'images';
            if (qParam) {
                currentSort = sortParam || '';
                searchInput.value = qParam;
                currentQuery = qParam;
                currentPage = pageParam;
                // ensure tab UI matches
                if (currentSearchType === 'images') {
                    switchTab('images'); // Utiliser switchTab pour assurer la cohérence
                }
                performSearch(currentQuery, currentSearchType, currentPage, currentSort);
            }
        } else if (document.getElementById('logo')) { // Heuristique pour la page d'accueil
            document.body.classList.add('is-homepage');
        }
    } catch (e) {
        // ignore URL parsing errors
    }

    // Initialisation
    if (document.getElementById('sortPanel')) setupSortOptions();

    // Mettre à jour l'affichage du quota
    function updateQuotaDisplay() {
        const usage = quotaManager.getUsage();
        const cacheStats = searchCache.getStats();

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
            z-index: 1000;
        `;
            document.body.appendChild(quotaEl);
        }

        const quotaColor = usage.remaining > 20 ? '#34a853' : usage.remaining > 5 ? '#fbbc04' : '#ea4335';
        quotaEl.innerHTML = `
        📊 API: <span style="color: ${quotaColor}">${usage.remaining}</span>/${usage.limit} | 
        📋 Cache: ${cacheStats.size}/${cacheStats.maxSize}
    `;
    }
});
