// search.js — version complète, autonome avec caches séparés
// IMPORTANT: Assurez-vous que votre fichier config.js (ou config.demo.js)
// contient les configurations pour Vikidia, Wikipedia et Wikimedia Commons.

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
        this.enabled = true;
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
        if (!this.enabled) return null;

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
        if (!this.enabled) return;

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

async function fetchVikidiaResults(query, lang = 'fr') {
    if (typeof CONFIG === 'undefined' || !CONFIG.VIKIDIA_SEARCH_CONFIG?.ENABLED) {
        return [];
    }
    const { API_URL, BASE_URL, SOURCE_NAME, WEIGHT, THUMBNAIL_SIZE } = CONFIG.VIKIDIA_SEARCH_CONFIG;
    const apiUrl = API_URL.replace('fr.vikidia.org', `${lang}.vikidia.org`);
    const baseUrl = BASE_URL.replace('fr.vikidia.org', `${lang}.vikidia.org`);
    const searchParams = { action: 'query', format: 'json', list: 'search', srsearch: query, srprop: 'snippet|titlesnippet', srlimit: 5, origin: '*' };
    const searchUrl = new URL(apiUrl);
    Object.keys(searchParams).forEach(key => searchUrl.searchParams.append(key, searchParams[key]));

    try {
        const searchRes = await fetch(searchUrl.toString());
        const searchData = await searchRes.json();
        if (!searchData.query?.search?.length) return [];

        const searchResults = searchData.query.search;
        const titles = searchResults.map(item => item.title).join('|');

        const thumbParams = { action: 'query', format: 'json', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: THUMBNAIL_SIZE, titles: titles, origin: '*' };
        const thumbUrl = new URL(apiUrl);
        Object.keys(thumbParams).forEach(key => thumbUrl.searchParams.append(key, thumbParams[key]));

        const thumbRes = await fetch(thumbUrl.toString());
        const thumbData = await thumbRes.json();
        const thumbMap = {};
        if (thumbData.query?.pages) {
            Object.values(thumbData.query.pages).forEach(page => {
                if (page.thumbnail) thumbMap[page.title] = page.thumbnail.source;
            });
        }

        return searchResults.map(item => {
            const result = {
                title: item.title,
                link: `${baseUrl}${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
                displayLink: new URL(baseUrl).hostname,
                snippet: item.snippet.replace(/<span class="searchmatch">/g, '').replace(/<\/span>/g, ''),
                htmlSnippet: item.snippet,
                source: SOURCE_NAME,
                weight: WEIGHT || 0.5
            };
            if (thumbMap[item.title]) {
                result.pagemap = { cse_thumbnail: [{ src: thumbMap[item.title] }] };
            }
            return result;
        });
    } catch (error) { console.error('Error fetching Vikidia results:', error); }
    return [];
}

async function fetchWikipediaResults(query, lang = 'fr') {
    if (typeof CONFIG === 'undefined' || !CONFIG.WIKIPEDIA_SEARCH_CONFIG?.ENABLED) {
        return [];
    }
    const { API_URL, BASE_URL, SOURCE_NAME, WEIGHT, THUMBNAIL_SIZE } = CONFIG.WIKIPEDIA_SEARCH_CONFIG;
    const apiUrl = API_URL.replace('fr.wikipedia.org', `${lang}.wikipedia.org`);
    const baseUrl = BASE_URL.replace('fr.wikipedia.org', `${lang}.wikipedia.org`);
    const searchParams = { action: 'query', format: 'json', list: 'search', srsearch: query, srprop: 'snippet|titlesnippet', srlimit: 5, origin: '*' };
    const searchUrl = new URL(apiUrl);
    Object.keys(searchParams).forEach(key => searchUrl.searchParams.append(key, searchParams[key]));

    try {
        const searchRes = await fetch(searchUrl.toString());
        const searchData = await searchRes.json();
        if (!searchData.query?.search?.length) return [];

        const searchResults = searchData.query.search;
        const titles = searchResults.map(item => item.title).join('|');

        const thumbParams = { action: 'query', format: 'json', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: THUMBNAIL_SIZE, titles: titles, origin: '*' };
        const thumbUrl = new URL(apiUrl);
        Object.keys(thumbParams).forEach(key => thumbUrl.searchParams.append(key, thumbParams[key]));

        const thumbRes = await fetch(thumbUrl.toString());
        const thumbData = await thumbRes.json();
        const thumbMap = {};
        if (thumbData.query?.pages) {
            Object.values(thumbData.query.pages).forEach(page => {
                if (page.thumbnail) thumbMap[page.title] = page.thumbnail.source;
            });
        }

        return searchResults.map(item => {
            const result = {
                title: item.title,
                link: `${baseUrl}${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
                displayLink: new URL(baseUrl).hostname,
                snippet: item.snippet.replace(/<span class="searchmatch">/g, '').replace(/<\/span>/g, ''),
                htmlSnippet: item.snippet,
                source: SOURCE_NAME,
                weight: WEIGHT || 0.5
            };
            if (thumbMap[item.title]) {
                result.pagemap = { cse_thumbnail: [{ src: thumbMap[item.title] }] };
            }
            return result;
        });
    } catch (error) { console.error('Error fetching Wikipedia results:', error); }
    return [];
}

async function fetchWikimediaCommonsResults(query) {
    if (typeof CONFIG === 'undefined' || !CONFIG.COMMONS_IMAGE_SEARCH_CONFIG?.ENABLED) {
        return [];
    }
    const { API_URL, BASE_URL, SOURCE_NAME, WEIGHT, THUMBNAIL_SIZE } = CONFIG.COMMONS_IMAGE_SEARCH_CONFIG;

    // Catégories à exclure pour un public jeune.
    // Le préfixe `-incategory:` exclut les fichiers de ces catégories.
    const excludedCategories = [
        "Nudity in art", "Erotic art", "Sexual activity", "Violence", "Deaths", "Human corpses"
    ];
    const exclusionQuery = excludedCategories.map(cat => `-incategory:"${cat}"`).join(' ');
    const finalQuery = `${query} ${exclusionQuery}`;

    const searchParams = {
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: finalQuery, // Utilise la requête avec exclusions
        srnamespace: 6,       // Espace de nom "File"
        srlimit: 10,          // Limite de résultats
        srwhat: 'text',       // Rechercher dans le texte pour de meilleurs résultats
        origin: '*'
    };
    const searchUrl = new URL(API_URL);
    Object.keys(searchParams).forEach(key => searchUrl.searchParams.append(key, searchParams[key]));

    try {
        const searchRes = await fetch(searchUrl.toString());
        const searchData = await searchRes.json();
        if (!searchData.query?.search?.length) return [];

        const titles = searchData.query.search.map(item => item.title).join('|');
        const infoParams = { action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: THUMBNAIL_SIZE, titles: titles, origin: '*' };
        const infoUrl = new URL(API_URL);
        Object.keys(infoParams).forEach(key => infoUrl.searchParams.append(key, infoParams[key]));

        const infoRes = await fetch(infoUrl.toString());
        const infoData = await infoRes.json();
        if (!infoData.query?.pages) return [];

        return Object.values(infoData.query.pages).map(page => {
            if (!page.imageinfo?.[0]) return null;
            const img = page.imageinfo[0];
            const title = page.title.replace('File:', '').replace(/\.[^/.]+$/, "");

            return {
                title: title,
                link: img.url, // Utiliser l'URL de l'image originale pour le clic
                displayLink: new URL(BASE_URL).hostname,
                source: SOURCE_NAME,
                weight: WEIGHT || 0.7,
                image: {
                    contextLink: img.descriptionurl,
                    thumbnailLink: img.thumburl,
                    width: img.thumbwidth,
                    height: img.thumbheight
                }
            };
        }).filter(item => item !== null);
    } catch (error) { console.error('Error fetching Wikimedia Commons results:', error); }
    return [];
}

function mergeAndWeightResults(googleResults, vikidiaResults, wikipediaResults) {
    let allResults = [];
    const googleWeight = 1.0;
    allResults = allResults.concat(googleResults.map((item, index) => ({ ...item, source: 'Google', originalIndex: index, calculatedWeight: googleWeight * (1 - (index / googleResults.length / 2)) })));
    vikidiaResults.forEach((item, index) => { allResults.push({ ...item, originalIndex: index, calculatedWeight: item.weight * (1 - (index / vikidiaResults.length / 2)) }); });
    wikipediaResults.forEach((item, index) => { allResults.push({ ...item, originalIndex: index, calculatedWeight: item.weight * (1 - (index / wikipediaResults.length / 2)) }); });
    allResults.sort((a, b) => b.calculatedWeight - a.calculatedWeight || a.originalIndex - b.originalIndex);
    const uniqueResults = [];
    const seenLinks = new Set();
    for (const result of allResults) {
        if (!seenLinks.has(result.link)) {
            uniqueResults.push(result);
            seenLinks.add(result.link);
        }
    }
    return uniqueResults;
}

function mergeAndWeightImageResults(googleResults, commonsResults) {
    let allResults = [];
    const googleWeight = 1.0;
    allResults = allResults.concat(googleResults.map((item, index) => ({ ...item, source: 'Google', originalIndex: index, calculatedWeight: googleWeight * (1 - (index / googleResults.length / 2)) })));
    commonsResults.forEach((item, index) => { allResults.push({ ...item, originalIndex: index, calculatedWeight: item.weight * (1 - (index / commonsResults.length / 2)) }); });
    allResults.sort((a, b) => b.calculatedWeight - a.calculatedWeight || a.originalIndex - b.originalIndex);
    const uniqueResults = [];
    const seenLinks = new Set();
    for (const result of allResults) {
        if (!seenLinks.has(result.link)) {
            uniqueResults.push(result);
            seenLinks.add(result.link);
        }
    }
    return uniqueResults;
}

document.addEventListener('DOMContentLoaded', () => {
    const RESULTS_PER_PAGE = 10;
    let currentSearchType = 'web';
    let currentQuery = '';
    let currentSort = '';
    let currentPage = 1;
    const webCache = new WebSearchCache();
    const imageCache = new ImageSearchCache();
    const quotaManager = new ApiQuotaManager();

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

    if (!searchInput) { console.error('search.js: #searchInput introuvable dans le DOM'); return; }

    let suggestions = [];
    let selectedIndex = -1;
    let inputDebounceTimer = null;
    let currentSuggestionsLang = navigator.language.startsWith('en') ? 'en' : 'fr';

    function loadSuggestions() {
        const lang = i18n.getLang();
        if (currentSuggestionsLang === lang && suggestions.length > 0) return;
        currentSuggestionsLang = lang;
        const suggestionsFile = lang === 'en' ? 'suggestions-en.json' : 'suggestions.json';
        fetch(suggestionsFile)
            .then(r => r.json())
            .then(j => { suggestions = j.suggestions || []; })
            .catch((err) => {
                console.warn(`Impossible de charger ${suggestionsFile}, utilisation des suggestions de secours.`, err);
                suggestions = lang === 'en' ? ["animals", "dinosaurs", "planets", "science", "history"] : ["animaux", "planètes", "dinosaures", "sciences", "histoire"];
            });
    }
    loadSuggestions();

    function updateUrl(query, type = currentSearchType, page = 1, sort = currentSort) {
        try {
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('q', query);
            newUrl.searchParams.set('type', type);
            if (page > 1) newUrl.searchParams.set('p', page); else newUrl.searchParams.delete('p');
            if (sort) newUrl.searchParams.set('sort', sort); else newUrl.searchParams.delete('sort');
            window.history.pushState({}, '', newUrl);
        } catch (e) { /* ignore */ }
    }

    function detectQueryLanguage(query) {
        const lowerQuery = query.toLowerCase();
        if (/[àâçéèêëîïôûùüÿœæ]/i.test(lowerQuery) || /\b(le|la|les|un|une|des|de|du|et|ou|est|pour|que|qui)\b/i.test(lowerQuery)) return 'fr';
        if (/\b(the|and|for|what|who|are|of|in|to|it|is)\b/i.test(lowerQuery)) return 'en';
        return null;
    }

    function buildGoogleCseApiUrl(query, type, page, sort) {
        const startIndex = (page - 1) * RESULTS_PER_PAGE + 1;
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        let finalQuery = query;

        if (type === 'web') {
            // Toujours exclure commons.wikimedia.org des résultats web, car ce sont des pages de fichiers.
            let exclusions = ' -site:commons.wikimedia.org';

            // Exclure les autres sources web si elles sont activées pour éviter les doublons.
            if (CONFIG.VIKIDIA_SEARCH_CONFIG?.ENABLED) {
                exclusions += ' -site:vikidia.org';
            }
            if (CONFIG.WIKIPEDIA_SEARCH_CONFIG?.ENABLED) {
                exclusions += ' -site:wikipedia.org';
            }
            finalQuery += exclusions;

        } else if (type === 'images') {
            // Pour les images, exclure tout le domaine wikimedia.org si on cherche directement sur Commons.
            if (CONFIG.COMMONS_IMAGE_SEARCH_CONFIG?.ENABLED) {
                finalQuery += ' -site:wikimedia.org';
            }
        }

        url.searchParams.set('q', finalQuery);
        url.searchParams.set('key', CONFIG.GOOGLE_API_KEY);
        url.searchParams.set('cx', CONFIG.GOOGLE_CSE_ID);
        url.searchParams.set('start', String(startIndex));
        url.searchParams.set('num', String(RESULTS_PER_PAGE));
        url.searchParams.set('safe', 'active');
        url.searchParams.set('filter', '1');
        if (sort) url.searchParams.set('sort', sort);

        if (type === 'images') {
            url.searchParams.set('searchType', 'image');
        } else if (type === 'web') {
            const lang = detectQueryLanguage(query);
            if (lang) url.searchParams.set('lr', `lang_${lang}`);
        }
        return url.toString();
    }

    function showLoading() { if (loadingEl) loadingEl.style.display = 'flex'; }
    function hideLoading() { if (loadingEl) loadingEl.style.display = 'none'; }

    function doSearch(e) {
        if (e) e.preventDefault();
        const q = searchInput.value.trim();
        if (!q) return;
        if (document.body.classList.contains('is-homepage')) {
            let newUrl = `results.html?q=${encodeURIComponent(q)}`;
            if (new URLSearchParams(window.location.search).has('dev')) newUrl += '&dev=1';
            window.location.href = newUrl;
            return;
        }
        if (document.body.classList.contains('is-resultspage')) {
            currentQuery = q;
            currentPage = 1;
            currentSort = '';
            performSearch(currentQuery, currentSearchType, currentPage, currentSort);
            document.title = `${currentQuery} - Search for Kids`;
            updateUrl(currentQuery, currentSearchType, currentPage, currentSort);
        }
    }

    async function performSearch(query, type = 'web', page = 1) {
        if (!query) return;
        showLoading();
        resultsContainer.innerHTML = '';
        statsEl.innerHTML = '';
        paginationEl.innerHTML = '';

        if (typeof tryDisplayKnowledgePanel === 'function' && type === 'web' && page === 1) {
            tryDisplayKnowledgePanel(query);
        }

        let cachedData = (type === 'web') ? webCache.get(query, page, currentSort) : imageCache.get(query, page);
        if (cachedData) {
            hideLoading();
            displayResults(cachedData, type, query, page);
            updateQuotaDisplay();
            return;
        }

        try {
            let combinedData;
            if (type === 'web') {
                // Détecte la langue, sinon utilise la langue de l'interface comme secours.
                const lang = detectQueryLanguage(query) || i18n.getLang();
                const [googleResponse, vikidiaResults, wikipediaResults] = await Promise.all([
                    fetch(buildGoogleCseApiUrl(query, type, page, currentSort)).then(res => res.json()),
                    fetchVikidiaResults(query, lang),
                    fetchWikipediaResults(query, lang)
                ]);
                if (googleResponse.error) throw new Error(googleResponse.error.message);
                const mergedResults = mergeAndWeightResults(googleResponse.items || [], vikidiaResults, wikipediaResults);
                combinedData = { items: mergedResults, searchInformation: googleResponse.searchInformation || { totalResults: mergedResults.length.toString() } };
                webCache.set(query, page, combinedData, currentSort);
            } else { // Images
                const [googleResponse, commonsResults] = await Promise.all([
                    fetch(buildGoogleCseApiUrl(query, type, page, currentSort)).then(res => res.json()),
                    fetchWikimediaCommonsResults(query)
                ]);
                if (googleResponse.error) throw new Error(googleResponse.error.message);
                const mergedResults = mergeAndWeightImageResults(googleResponse.items || [], commonsResults);
                combinedData = { items: mergedResults, searchInformation: googleResponse.searchInformation || { totalResults: mergedResults.length.toString() } };
                imageCache.set(query, page, combinedData);
            }

            hideLoading();
            quotaManager.recordRequest();
            updateQuotaDisplay();
            displayResults(combinedData, type, query, page);
        } catch (err) {
            hideLoading();
            resultsContainer.innerHTML = `<div style="padding:2rem; text-align:center; color:#d93025;"><p>Une erreur s'est produite.</p><p style="font-size:14px; color:#70757a;">${err.message || err}</p></div>`;
            console.error('performSearch error', err);
        }
    }

    function displayResults(data, type, query, page) {
        statsEl.textContent = '';
        const totalResults = data.items?.length || 0;
        if (toolsContainer) toolsContainer.style.display = (type === 'web' && totalResults > 0) ? 'flex' : 'none';

        if (!data.items || data.items.length === 0) {
            const noResultsMsg = i18n.get(type === 'images' ? 'noImages' : 'noResults') + ` "${query}"`;
            const suggestionsMsg = i18n.get('noResultsSuggestions');
            resultsContainer.innerHTML = `<div style="padding:2rem; text-align:center; color:#70757a;"><p style="font-size:1.2em; margin-bottom:16px;">${noResultsMsg}</p><ul style="list-style:none; padding:0; font-size:0.9em; color:#5f6368;">${suggestionsMsg.map(s => `<li>${s}</li>`).join('')}</ul></div>`;
            createPagination(totalResults, page, data);
            return;
        }

        resultsContainer.classList.toggle('grid', type === 'images');
        data.items.forEach(item => {
            resultsContainer.appendChild(type === 'web' ? createSearchResult(item) : createImageResult(item));
        });
        createPagination(totalResults, page, data);
    }

    function createSearchResult(item) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'search-result';
        const thumbnail = (item.pagemap?.cse_thumbnail?.[0]) ? `<img src="${item.pagemap.cse_thumbnail[0].src}" alt="">` : '';
        resultDiv.innerHTML = `
          <div class="result-thumbnail">${thumbnail}</div>
          <div class="result-content">
            <div class="result-url">${item.displayLink || ''}</div>
            <div class="result-title"><a href="${item.link || '#'}" target="_blank" rel="noopener noreferrer">${item.title || ''}</a></div>
            <div class="result-snippet">${DOMPurify.sanitize(item.htmlSnippet || item.snippet || '')}</div>
            ${item.source ? `<div class="result-source" style="font-size:0.8em; color:#888; margin-top:5px;">Source: ${item.source}</div>` : ''}
          </div>`;
        return resultDiv;
    }

    function createImageResult(item) {
        const div = document.createElement('div');
        div.className = 'image-result';
        div.onclick = () => openImageModal(item);

        const imgUrl = item.link || item.image?.thumbnailLink || '';
        const width = item.image?.width || 0;
        const height = item.image?.height || 0;
        const aspectRatio = width && height ? width / height : 1;
        let gridSpan = 1, aspectRatioCSS = '1 / 1';
        if (aspectRatio > 1.5) { gridSpan = 2; aspectRatioCSS = '2 / 1'; } 
        else if (aspectRatio > 1.2) { aspectRatioCSS = '4 / 3'; } 
        else if (aspectRatio < 0.7) { aspectRatioCSS = '3 / 4'; }

        div.style.gridColumn = `span ${gridSpan}`;

        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = item.title || '';
        img.loading = 'lazy';
        img.style.cssText = `width:100%; height:100%; object-fit:cover; display:block; border-radius:8px;`;
        img.onerror = () => { div.style.display = 'none'; };

        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `position:relative; width:100%; aspect-ratio:${aspectRatioCSS}; overflow:hidden; border-radius:8px; margin-bottom:8px; background-color:#f8f9fa;`;
        imageContainer.appendChild(img);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'image-info';
        infoDiv.innerHTML = `
            <div class="image-title" style="font-size:12px; line-height:1.3; color:#202124; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; margin-bottom:2px;">${item.title || ''}</div>
            <div class="image-source" style="font-size:11px; color:#70757a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.displayLink || ''}</div>`;

        div.style.cssText = `cursor:pointer; border-radius:8px; transition:all 0.2s ease; background-color:white; overflow:hidden; grid-column:span ${gridSpan};`;
        div.addEventListener('mouseenter', () => { div.style.transform = 'scale(1.02)'; div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; });
        div.addEventListener('mouseleave', () => { div.style.transform = 'scale(1)'; div.style.boxShadow = 'none'; });

        if (item.source) {
            const sourceBadge = document.createElement('div');
            sourceBadge.textContent = item.source;
            sourceBadge.style.cssText = `position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:white; padding:2px 5px; font-size:10px; border-radius:3px; z-index:1;`;
            imageContainer.appendChild(sourceBadge);
        }

        div.appendChild(imageContainer);
        div.appendChild(infoDiv);
        return div;
    }

    function createPagination(totalResults = 0, page = 1, data = null) {
        paginationEl.innerHTML = '';
        const maxPages = 10;
        const receivedItems = data?.items?.length || 0;
        if (page > 1) {
            const prev = document.createElement('button');
            prev.textContent = i18n.get('previousButton');
            prev.onclick = () => { currentPage--; performSearch(currentQuery, currentSearchType, currentPage, currentSort); updateUrl(currentQuery, currentSearchType, currentPage, currentSort); };
            paginationEl.appendChild(prev);
        }
        if (page < maxPages && receivedItems >= RESULTS_PER_PAGE) {
            const next = document.createElement('button');
            next.textContent = i18n.get('nextButton');
            next.onclick = () => { currentPage++; performSearch(currentQuery, currentSearchType, currentPage, currentSort); updateUrl(currentQuery, currentSearchType, currentPage, currentSort); };
            paginationEl.appendChild(next);
        }
    }

    function switchTab(type) {
        currentSearchType = type;
        webTab.classList.toggle('active', type === 'web');
        imagesTab.classList.toggle('active', type === 'images');
        if (currentQuery) {
            currentPage = 1;
            if (type === 'images') currentSort = '';
            performSearch(currentQuery, currentSearchType, currentPage, currentSort);
            updateUrl(currentQuery, currentSearchType, currentPage, currentSort);
        }
    }

    if (webTab) webTab.addEventListener('click', (e) => { e.preventDefault(); switchTab('web'); });
    if (imagesTab) imagesTab.addEventListener('click', (e) => { e.preventDefault(); switchTab('images'); });

    function setupSortOptions() {
        const sortPanel = document.getElementById('sortPanel');
        if (!sortPanel || !toolsButton) return;
        const sortOptions = sortPanel.querySelectorAll('.sort-option');
        sortOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const newSort = e.target.getAttribute('data-sort');
                if (newSort === currentSort) { sortPanel.style.display = 'none'; return; }
                currentSort = newSort;
                sortPanel.style.display = 'none';
                performSearch(currentQuery, currentSearchType, 1, currentSort);
                updateUrl(currentQuery, currentSearchType, 1, currentSort);
            });
        });
        toolsButton.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            sortPanel.style.display = sortPanel.style.display === 'block' ? 'none' : 'block';
            if (sortPanel.style.display === 'block') {
                sortOptions.forEach(opt => opt.classList.toggle('active', opt.getAttribute('data-sort') === currentSort));
            }
        });
    }

    function openImageModal(item) {
        modalImage.src = item.link || item.image?.contextLink || '';
        modalTitle.textContent = item.title || '';
        modalSource.innerHTML = item.image?.contextLink ? `<a href="${item.image.contextLink}" target="_blank" rel="noopener noreferrer">${item.displayLink || item.image.contextLink}</a>` : (item.displayLink || '');
        modalDimensions.textContent = item.image ? `${item.image.width} × ${item.image.height} pixels` : '';
        imageModal.style.display = 'flex';
    }
    function closeImageModal() { modalImage.src = ''; imageModal.style.display = 'none'; }
    if (imageModal) imageModal.addEventListener('click', (e) => { if (e.target === imageModal) closeImageModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeImageModal(); });

    searchInput.addEventListener('input', () => {
        if (clearButton) clearButton.style.display = searchInput.value.length > 0 ? 'block' : 'none';
        const value = searchInput.value.toLowerCase().trim();
        clearTimeout(inputDebounceTimer);
        inputDebounceTimer = setTimeout(() => {
            autocompleteDropdown.innerHTML = '';
            selectedIndex = -1;
            if (!value || !suggestions.length) { autocompleteDropdown.style.display = 'none'; return; }
            loadSuggestions();
            const matches = suggestions.filter(s => s.toLowerCase().includes(value)).slice(0, 8);
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.textContent = match;
                div.addEventListener('click', () => { searchInput.value = match; autocompleteDropdown.style.display = 'none'; doSearch(); });
                autocompleteDropdown.appendChild(div);
            });
            autocompleteDropdown.style.display = matches.length ? 'block' : 'none';
        }, 150);
    });

    searchInput.addEventListener('keydown', (e) => {
        const items = Array.from(autocompleteDropdown.getElementsByClassName('autocomplete-item'));
        if (!items.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(items.length - 1, selectedIndex + 1); updateSelection(items); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(-1, selectedIndex - 1); updateSelection(items); }
        else if (e.key === 'Enter') { if (selectedIndex >= 0 && items[selectedIndex]) { e.preventDefault(); items[selectedIndex].click(); autocompleteDropdown.style.display = 'none'; } }
        else if (e.key === 'Escape') { autocompleteDropdown.style.display = 'none'; }
    });

    function updateSelection(items) {
        items.forEach((it, idx) => it.classList.toggle('selected', idx === selectedIndex));
        if (selectedIndex >= 0 && items[selectedIndex]) items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }

    document.addEventListener('click', (e) => {
        if (!autocompleteDropdown.contains(e.target) && e.target !== searchInput) autocompleteDropdown.style.display = 'none';
        const sortPanel = document.getElementById('sortPanel');
        if (sortPanel?.style.display === 'block' && !sortPanel.contains(e.target) && e.target !== toolsButton) sortPanel.style.display = 'none';
    });

    if (clearButton) clearButton.addEventListener('click', () => { searchInput.value = ''; clearButton.style.display = 'none'; autocompleteDropdown.style.display = 'none'; searchInput.focus(); });

    const form = document.querySelector('.search-bar form') || document.querySelector('form');
    if (form) form.addEventListener('submit', doSearch);

    try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('q')) {
            document.body.classList.add('is-resultspage');
            currentQuery = params.get('q');
            currentSearchType = params.get('type') || 'web';
            currentSort = params.get('sort') || '';
            currentPage = parseInt(params.get('p') || '1', 10) || 1;
            searchInput.value = currentQuery;
            if (clearButton && currentQuery) clearButton.style.display = 'block';
            webTab.classList.toggle('active', currentSearchType === 'web');
            imagesTab.classList.toggle('active', currentSearchType === 'images');
            performSearch(currentQuery, currentSearchType, currentPage, currentSort);
        } else if (document.getElementById('logo')) {
            document.body.classList.add('is-homepage');
        }
    } catch (e) { /* ignore */ }

    if (document.getElementById('sortPanel')) setupSortOptions();

    const urlParams = new URLSearchParams(window.location.search);
    const isDevMode = urlParams.has('dev');

    function updateQuotaDisplay() {
        if (!isDevMode) {
            const quotaEl = document.getElementById('quotaIndicator');
            if (quotaEl) quotaEl.remove();
            return;
        }
        const usage = quotaManager.getUsage();
        const webStats = webCache.getStats();
        const imageStats = imageCache.getStats();
        let quotaEl = document.getElementById('quotaIndicator');
        if (!quotaEl) {
            quotaEl = document.createElement('div');
            quotaEl.id = 'quotaIndicator';
            quotaEl.style.cssText = `position:fixed; bottom:10px; right:10px; background:#f8f9fa; border:1px solid #e0e0e0; border-radius:8px; padding:8px 12px; font-size:12px; color:#70757a; box-shadow:0 2px 6px rgba(0,0,0,0.15); z-index:1000;`;
            document.body.appendChild(quotaEl);
        }
        const quotaColor = usage.remaining > 20 ? '#34a853' : usage.remaining > 5 ? '#fbbc04' : '#ea4335';
        quotaEl.innerHTML = `
        📊 API: <span style="color:${quotaColor}">${usage.remaining}</span>/${usage.limit} |
        📋 Web: ${webStats.size}/${webStats.maxSize} |
        🖼️ Images: ${imageStats.enabled ? `${imageStats.size}/${imageStats.maxSize}` : 'OFF'} |
        <button id="devClearBtn" style="margin-left:8px; background:#fff; border:1px solid #ccc; border-radius:4px; padding:2px 6px; cursor:pointer;">🗑️ Vider</button>`;
        const clearBtn = document.getElementById('devClearBtn');
        if (clearBtn && !clearBtn.dataset.listenerAttached) {
            clearBtn.onclick = () => {
                if (confirm("Effacer tous les caches et quotas ?")) {
                    try { webCache.clear(); imageCache.clear(); localStorage.removeItem('api_usage'); } catch (e) { console.warn("Erreur clear cache:", e); }
                    alert("Caches vidés. Rechargement...");
                    window.location.reload();
                }
            };
            clearBtn.dataset.listenerAttached = 'true';
        }
    }
    updateQuotaDisplay();
});
