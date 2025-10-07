// search.js — version complète avec pagination optimisée
// Sources secondaires (Vikidia, Wikipedia, MeiliSearch, Commons) uniquement en page 1

class WebSearchCache {
    constructor() { this.cache = new Map(); this.maxCacheSize = 200; this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; this.loadFromStorage(); }
    createKey(query, page, sort = '', configSignature = 'default') { return `web:${query.toLowerCase().trim()}:${page}:${sort}:${configSignature}`; }
    saveToStorage() { try { localStorage.setItem('web_search_cache', JSON.stringify([...this.cache])); } catch (e) {} }
    loadFromStorage() { try { const stored = localStorage.getItem('web_search_cache'); if (stored) { this.cache = new Map(JSON.parse(stored)); this.cleanExpiredEntries(); } } catch (e) { this.cache = new Map(); } }
    cleanExpiredEntries() { const now = Date.now(); for (const [key, value] of this.cache) { if (now - value.timestamp > this.cacheExpiry) this.cache.delete(key); } }
    get(query, page, sort = '', configSignature) { const entry = this.cache.get(this.createKey(query, page, sort, configSignature)); if (!entry || Date.now() - entry.timestamp > this.cacheExpiry) return null; return entry.data; }
    set(query, page, data, sort = '', configSignature) { if (this.cache.size >= this.maxCacheSize) this.cache.delete(this.cache.keys().next().value); this.cache.set(this.createKey(query, page, sort, configSignature), { data, timestamp: Date.now() }); this.saveToStorage(); }
    getStats() { return { size: this.cache.size, maxSize: this.maxCacheSize }; }
    clear() { this.cache.clear(); localStorage.removeItem('web_search_cache'); }
}

class ImageSearchCache {
    constructor() { this.cache = new Map(); this.maxCacheSize = 100; this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; this.enabled = true; if (this.enabled) this.loadFromStorage(); }
    createKey(query, page, configSignature = 'default') { return `images:${query.toLowerCase().trim()}:${page}:${configSignature}`; }
    saveToStorage() { if (!this.enabled) return; try { localStorage.setItem('image_search_cache', JSON.stringify([...this.cache])); } catch (e) {} }
    loadFromStorage() { if (!this.enabled) return; try { const stored = localStorage.getItem('image_search_cache'); if (stored) { this.cache = new Map(JSON.parse(stored)); this.cleanExpiredEntries(); } } catch (e) { this.cache = new Map(); } }
    cleanExpiredEntries() { if (!this.enabled) return; const now = Date.now(); for (const [key, value] of this.cache) { if (now - value.timestamp > this.cacheExpiry) this.cache.delete(key); } }
    get(query, page, configSignature) { if (!this.enabled) return null; const entry = this.cache.get(this.createKey(query, page, configSignature)); if (!entry || Date.now() - entry.timestamp > this.cacheExpiry) return null; return entry.data; }
    set(query, page, data, configSignature) { if (!this.enabled) return; if (this.cache.size >= this.maxCacheSize) this.cache.delete(this.cache.keys().next().value); this.cache.set(this.createKey(query, page, configSignature), { data, timestamp: Date.now() }); this.saveToStorage(); }
    getStats() { return { size: this.enabled ? this.cache.size : 0, maxSize: this.maxCacheSize, enabled: this.enabled }; }
    clear() { this.cache.clear(); localStorage.removeItem('image_search_cache'); }
    enable() { this.enabled = true; this.loadFromStorage(); }
    disable() { this.enabled = false; this.clear(); }
}

class ApiQuotaManager {
    constructor() { this.dailyLimit = 90; this.loadUsage(); }
    loadUsage() { const stored = localStorage.getItem('api_usage'); if (stored) { const data = JSON.parse(stored); const today = new Date().toDateString(); this.todayUsage = data.date === today ? data.count : 0; if (data.date !== today) this.saveUsage(); } else { this.todayUsage = 0; } }
    saveUsage() { localStorage.setItem('api_usage', JSON.stringify({ date: new Date().toDateString(), count: this.todayUsage })); }
    recordRequest() { this.todayUsage++; this.saveUsage(); }
    getUsage() { return { used: this.todayUsage, limit: this.dailyLimit, remaining: this.dailyLimit - this.todayUsage }; }
}

async function fetchVikidiaResults(query, lang = 'fr') {
    if (typeof CONFIG === 'undefined' || !CONFIG.VIKIDIA_SEARCH_CONFIG?.ENABLED) return [];
    const { API_URL, BASE_URL, SOURCE_NAME, WEIGHT, THUMBNAIL_SIZE } = CONFIG.VIKIDIA_SEARCH_CONFIG;
    const apiUrl = API_URL.replace('fr.vikidia.org', `${lang}.vikidia.org`);
    const baseUrl = BASE_URL.replace('fr.vikidia.org', `${lang}.vikidia.org`);
    try {
        const searchUrl = new URL(apiUrl);
        Object.entries({ action: 'query', format: 'json', list: 'search', srsearch: query, srprop: 'snippet|titlesnippet', srlimit: 5, origin: '*' }).forEach(([k, v]) => searchUrl.searchParams.append(k, v));
        const searchData = await (await fetch(searchUrl)).json();
        if (!searchData.query?.search?.length) return [];
        const titles = searchData.query.search.map(i => i.title).join('|');
        const thumbUrl = new URL(apiUrl);
        Object.entries({ action: 'query', format: 'json', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: THUMBNAIL_SIZE, titles, origin: '*' }).forEach(([k, v]) => thumbUrl.searchParams.append(k, v));
        const thumbData = await (await fetch(thumbUrl)).json();
        const thumbMap = {};
        if (thumbData.query?.pages) Object.values(thumbData.query.pages).forEach(p => { if (p.thumbnail) thumbMap[p.title] = p.thumbnail.source; });
        return searchData.query.search.map(item => {
            const result = { title: item.title, link: `${baseUrl}${encodeURIComponent(item.title.replace(/ /g, '_'))}`, displayLink: new URL(baseUrl).hostname, snippet: item.snippet.replace(/<\/?span[^>]*>/g, ''), htmlSnippet: item.snippet, source: SOURCE_NAME, weight: WEIGHT || 0.5 };
            if (thumbMap[item.title]) result.pagemap = { cse_thumbnail: [{ src: thumbMap[item.title] }] };
            return result;
        });
    } catch (error) { console.error('Error Vikidia:', error); }
    return [];
}

async function fetchWikipediaResults(query, lang = 'fr') {
    if (typeof CONFIG === 'undefined' || !CONFIG.WIKIPEDIA_SEARCH_CONFIG?.ENABLED) return [];
    const { API_URL, BASE_URL, SOURCE_NAME, WEIGHT, THUMBNAIL_SIZE } = CONFIG.WIKIPEDIA_SEARCH_CONFIG;
    const apiUrl = API_URL.replace('fr.wikipedia.org', `${lang}.wikipedia.org`);
    const baseUrl = BASE_URL.replace('fr.wikipedia.org', `${lang}.wikipedia.org`);
    try {
        const searchUrl = new URL(apiUrl);
        Object.entries({ action: 'query', format: 'json', list: 'search', srsearch: query, srprop: 'snippet|titlesnippet', srlimit: 5, origin: '*' }).forEach(([k, v]) => searchUrl.searchParams.append(k, v));
        const searchData = await (await fetch(searchUrl)).json();
        if (!searchData.query?.search?.length) return [];
        const titles = searchData.query.search.map(i => i.title).join('|');
        const thumbUrl = new URL(apiUrl);
        Object.entries({ action: 'query', format: 'json', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: THUMBNAIL_SIZE, titles, origin: '*' }).forEach(([k, v]) => thumbUrl.searchParams.append(k, v));
        const thumbData = await (await fetch(thumbUrl)).json();
        const thumbMap = {};
        if (thumbData.query?.pages) Object.values(thumbData.query.pages).forEach(p => { if (p.thumbnail) thumbMap[p.title] = p.thumbnail.source; });
        return searchData.query.search.map(item => {
            const result = { title: item.title, link: `${baseUrl}${encodeURIComponent(item.title.replace(/ /g, '_'))}`, displayLink: new URL(baseUrl).hostname, snippet: item.snippet.replace(/<\/?span[^>]*>/g, ''), htmlSnippet: item.snippet, source: SOURCE_NAME, weight: WEIGHT || 0.5 };
            if (thumbMap[item.title]) result.pagemap = { cse_thumbnail: [{ src: thumbMap[item.title] }] };
            return result;
        });
    } catch (error) { console.error('Error Wikipedia:', error); }
    return [];
}

async function fetchMeiliSearchResults(query, lang = 'fr') {
    if (typeof CONFIG === 'undefined' || !CONFIG.MEILISEARCH_CONFIG?.ENABLED) return [];
    const { API_URL, API_KEY, INDEX_NAME, SOURCE_NAME, WEIGHT } = CONFIG.MEILISEARCH_CONFIG;
    try {
        const payload = {
            q: query,
            limit: 5,
            attributesToRetrieve: ['*', '_formatted'],
            attributesToHighlight: ['title', 'content'],
            attributesToCrop: ['content'],
            cropLength: 30,
            cropMarker: '...',
            highlightPreTag: '<span class="searchmatch">',
            highlightPostTag: '</span>',
            matchingStrategy: 'last',
            filter: `lang = ${lang}` // Utilisation du paramètre lang pour le filtre
        };
        const res = await fetch(`${API_URL}/indexes/${INDEX_NAME}/search`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.hits?.length) return [];
        return data.hits.map(hit => {
            const content = hit._formatted?.content || hit._formatted?.excerpt || hit.content || '';
            const result = { title: hit._formatted?.title || hit.title, link: hit.url, displayLink: new URL(hit.url).hostname, snippet: content.replace(/<\/?span[^>]*>/g, ''), htmlSnippet: content, source: SOURCE_NAME, weight: WEIGHT || 0.6 };
            if (hit.images?.[0]?.url) result.pagemap = { cse_thumbnail: [{ src: hit.images[0].url }] };
            return result;
        });
    } catch (error) { console.error('Error MeiliSearch:', error); }
    return [];
}

async function fetchMeiliSearchImageResults(query) {
    if (typeof CONFIG === 'undefined' || !CONFIG.MEILISEARCH_CONFIG?.ENABLED) return [];
    const { API_URL, API_KEY, INDEX_NAME, SOURCE_NAME, WEIGHT } = CONFIG.MEILISEARCH_CONFIG;
    try {
        const res = await fetch(`${API_URL}/indexes/${INDEX_NAME}/search`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, limit: 10 })
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.hits || []).filter(h => h.images?.length > 0).map(h => {
            const img = h.images[0];
            return { title: h.title, link: img.url, displayLink: new URL(h.url).hostname, source: SOURCE_NAME, weight: WEIGHT || 0.6, image: { contextLink: h.url, thumbnailLink: img.url, width: img.width || 400, height: img.height || 300 } };
        });
    } catch (error) { console.error('Error MeiliSearch images:', error); }
    return [];
}

async function fetchWikimediaCommonsResults(query) {
    if (typeof CONFIG === 'undefined' || !CONFIG.COMMONS_IMAGE_SEARCH_CONFIG?.ENABLED) return [];
    const { API_URL, BASE_URL, SOURCE_NAME, WEIGHT, THUMBNAIL_SIZE } = CONFIG.COMMONS_IMAGE_SEARCH_CONFIG;
    const finalQuery = `${query} ${["Nudity in art", "Erotic art", "Sexual activity", "Violence", "Deaths", "Human corpses"].map(c => `-incategory:"${c}"`).join(' ')}`;
    try {
        const searchUrl = new URL(API_URL);
        Object.entries({ action: 'query', format: 'json', list: 'search', srsearch: finalQuery, srnamespace: 6, srlimit: 10, srwhat: 'text', origin: '*' }).forEach(([k, v]) => searchUrl.searchParams.append(k, v));
        const searchData = await (await fetch(searchUrl)).json();
        if (!searchData.query?.search?.length) return [];
        const titles = searchData.query.search.map(i => i.title).join('|');
        const infoUrl = new URL(API_URL);
        Object.entries({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: THUMBNAIL_SIZE, titles, origin: '*' }).forEach(([k, v]) => infoUrl.searchParams.append(k, v));
        const infoData = await (await fetch(infoUrl)).json();
        if (!infoData.query?.pages) return [];
        return Object.values(infoData.query.pages).filter(p => p.imageinfo?.[0]).map(p => {
            const img = p.imageinfo[0];
            return { title: p.title.replace('File:', '').replace(/\.[^/.]+$/, ""), link: img.url, displayLink: new URL(BASE_URL).hostname, source: SOURCE_NAME, weight: WEIGHT || 0.7, image: { contextLink: img.descriptionurl, thumbnailLink: img.thumburl, width: img.thumbwidth, height: img.thumbheight } };
        });
    } catch (error) { console.error('Error Commons:', error); }
    return [];
}

function calculateLexicalScore(item, query) {
    const title = (item.title || '').toLowerCase();
    const snippet = (item.snippet || '').toLowerCase();
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return 0;
    const queryWords = lowerQuery.split(/[\s,.:;!?]+/).filter(w => w.length > 1);
    let score = 0;
    if (title.includes(lowerQuery)) score += 1.0;
    else if (queryWords.length > 1 && queryWords.every(w => title.includes(w))) score += 0.5;
    if (title.startsWith(lowerQuery)) score += 0.4;
    if (snippet && queryWords.length > 1 && queryWords.every(w => snippet.includes(w))) score += 0.2;
    return score;
}

function mergeAndWeightResults(googleResults, vikidiaResults, wikipediaResults, meiliResults, query) {
    let allResults = googleResults.map((item, idx) => ({ ...item, source: item.source || 'Google', originalIndex: idx, calculatedWeight: 1.0 * (1 - idx / googleResults.length / 2) + calculateLexicalScore(item, query) }));
    [vikidiaResults, wikipediaResults, meiliResults].forEach(results => results.forEach((item, idx) => allResults.push({ ...item, originalIndex: idx, calculatedWeight: item.weight * (1 - idx / results.length / 2) + calculateLexicalScore(item, query) })));
    allResults.sort((a, b) => b.calculatedWeight - a.calculatedWeight || a.originalIndex - b.originalIndex);
    const seen = new Set();
    return allResults.filter(r => !seen.has(r.link) && seen.add(r.link));
}

function mergeAndWeightImageResults(googleResults, commonsResults, meiliResults, query) {
    let allResults = googleResults.map((item, idx) => ({ ...item, source: 'Google', originalIndex: idx, calculatedWeight: 1.0 * (1 - idx / googleResults.length / 2) + calculateLexicalScore(item, query) }));
    [commonsResults, meiliResults].forEach(results => results.forEach((item, idx) => allResults.push({ ...item, originalIndex: idx, calculatedWeight: item.weight * (1 - idx / results.length / 2) + calculateLexicalScore(item, query) })));
    allResults.sort((a, b) => b.calculatedWeight - a.calculatedWeight || a.originalIndex - b.originalIndex);
    const seen = new Set();
    return allResults.filter(r => !seen.has(r.link) && seen.add(r.link));
}

function getWebConfigSignature() {
    const parts = [];
    if (CONFIG.VIKIDIA_SEARCH_CONFIG?.ENABLED) parts.push('v1');
    if (CONFIG.WIKIPEDIA_SEARCH_CONFIG?.ENABLED) parts.push('w1');
    if (CONFIG.MEILISEARCH_CONFIG?.ENABLED) parts.push('m1');
    return parts.join('-');
}

function getImageConfigSignature() {
    const parts = [];
    if (CONFIG.COMMONS_IMAGE_SEARCH_CONFIG?.ENABLED) parts.push('c1');
    if (CONFIG.MEILISEARCH_CONFIG?.ENABLED) parts.push('m1');
    return parts.join('-');
}

document.addEventListener('DOMContentLoaded', () => {
    const RESULTS_PER_PAGE = 10;
    let currentSearchType = 'web', currentQuery = '', currentSort = '', currentPage = 1;
    const webCache = new WebSearchCache(), imageCache = new ImageSearchCache(), quotaManager = new ApiQuotaManager();

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

    if (!searchInput) { console.error('search.js: #searchInput introuvable'); return; }

    let suggestions = [], selectedIndex = -1, inputDebounceTimer = null, currentSuggestionsLang = navigator.language.startsWith('en') ? 'en' : 'fr';

    function loadSuggestions() {
        const lang = i18n.getLang();
        if (currentSuggestionsLang === lang && suggestions.length > 0) return;
        currentSuggestionsLang = lang;
        fetch(lang === 'en' ? 'suggestions-en.json' : 'suggestions.json')
            .then(r => r.json())
            .then(j => { suggestions = j.suggestions || []; })
            .catch(() => { suggestions = lang === 'en' ? ["animals", "dinosaurs", "planets"] : ["animaux", "planètes", "dinosaures"]; });
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
        } catch (e) {}
    }

    function detectQueryLanguage(query) {
        const lq = query.toLowerCase();
        if (/[àâçéèêëîïôûùüÿœæ]/i.test(lq) || /\b(le|la|les|un|une|des)\b/i.test(lq)) return 'fr';
        if (/\b(the|and|for|what|who|are)\b/i.test(lq)) return 'en';
        return null;
    }

    function buildGoogleCseApiUrl(query, type, page, sort) {
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        let finalQuery = query;
        if (type === 'web') {
            let exclusions = ' -site:commons.wikimedia.org';
            if (CONFIG.VIKIDIA_SEARCH_CONFIG?.ENABLED) exclusions += ' -site:vikidia.org';
            if (CONFIG.WIKIPEDIA_SEARCH_CONFIG?.ENABLED) exclusions += ' -site:wikipedia.org';
            if (CONFIG.MEILISEARCH_CONFIG?.ENABLED && CONFIG.MEILISEARCH_CONFIG.BASE_URLS) {
                const urls = Array.isArray(CONFIG.MEILISEARCH_CONFIG.BASE_URLS) ? CONFIG.MEILISEARCH_CONFIG.BASE_URLS : [CONFIG.MEILISEARCH_CONFIG.BASE_URLS];
                urls.forEach(u => { if (u) exclusions += ` -site:${u.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0]}`; });
            }
            finalQuery += exclusions;
        } else if (type === 'images' && CONFIG.COMMONS_IMAGE_SEARCH_CONFIG?.ENABLED) {
            finalQuery += ' -site:wikimedia.org';
        }
        url.searchParams.set('q', finalQuery);
        url.searchParams.set('key', CONFIG.GOOGLE_API_KEY);
        url.searchParams.set('cx', CONFIG.GOOGLE_CSE_ID);
        url.searchParams.set('start', String((page - 1) * RESULTS_PER_PAGE + 1));
        url.searchParams.set('num', String(RESULTS_PER_PAGE));
        url.searchParams.set('safe', 'active');
        url.searchParams.set('filter', '1');
        if (sort) url.searchParams.set('sort', sort);
        if (type === 'images') url.searchParams.set('searchType', 'image');
        else { const lang = detectQueryLanguage(query); if (lang) url.searchParams.set('lr', `lang_${lang}`); }
        return url.toString();
    }

    function showLoading() { if (loadingEl) loadingEl.style.display = 'flex'; }
    function hideLoading() { if (loadingEl) loadingEl.style.display = 'none'; }

    function doSearch(e) {
        if (e) e.preventDefault();
        const q = searchInput.value.trim();
        if (!q) return;
        if (document.body.classList.contains('is-homepage')) {
            window.location.href = `results.html?q=${encodeURIComponent(q)}${new URLSearchParams(window.location.search).has('dev') ? '&dev=1' : ''}`;
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
        const cleanedQuery = query.split('?')[0].trim();
        if (!cleanedQuery) return;

        showLoading();
        resultsContainer.innerHTML = '';
        statsEl.innerHTML = '';
        paginationEl.innerHTML = '';

        if (typeof tryDisplayKnowledgePanel === 'function' && type === 'web' && page === 1) {
            tryDisplayKnowledgePanel(cleanedQuery);
        }

        const configSignature = type === 'web' ? getWebConfigSignature() : getImageConfigSignature();
        let cachedData = type === 'web' ? webCache.get(cleanedQuery, page, currentSort, configSignature) : imageCache.get(cleanedQuery, page, configSignature);

        if (cachedData) {
            hideLoading();
            displayResults(cachedData, type, cleanedQuery, page);
            updateQuotaDisplay();
            return;
        }

        try {
            let combinedData;
            const lang = detectQueryLanguage(cleanedQuery) || i18n.getLang();

            if (type === 'web') {
                const googlePromise = fetch(buildGoogleCseApiUrl(cleanedQuery, type, page, currentSort))
                    .then(res => res.json())
                    .catch(err => { console.warn("Erreur API Google", err); return { items: [], searchInformation: {} }; });

                // Sources secondaires UNIQUEMENT en page 1
                const [googleResponse, vikidiaResults, wikipediaResults, meiliResults] = page === 1
                    ? await Promise.all([googlePromise, fetchVikidiaResults(cleanedQuery, lang), fetchWikipediaResults(cleanedQuery, lang), fetchMeiliSearchResults(cleanedQuery, lang)])
                    : [await googlePromise, [], [], []];

                if (googleResponse.error) console.error("Erreur Google:", googleResponse.error.message);

                const mergedResults = mergeAndWeightResults(googleResponse.items || [], vikidiaResults, wikipediaResults, meiliResults, cleanedQuery);
                combinedData = {
                    items: mergedResults,
                    searchInformation: googleResponse.searchInformation || { totalResults: mergedResults.length.toString() },
                    googleItemsCount: (googleResponse.items || []).length,
                    hasMorePages: (googleResponse.items || []).length >= RESULTS_PER_PAGE
                };
                webCache.set(cleanedQuery, page, combinedData, currentSort, configSignature);
            } else {
                // Images : sources secondaires UNIQUEMENT en page 1
                const [googleResponse, commonsResults, meiliResults] = page === 1
                    ? await Promise.all([
                        fetch(buildGoogleCseApiUrl(cleanedQuery, type, page, currentSort)).then(res => res.json()).catch(err => { console.warn("Erreur Google Images", err); return { items: [], searchInformation: {} }; }),
                        fetchWikimediaCommonsResults(cleanedQuery),
                        fetchMeiliSearchImageResults(cleanedQuery)
                    ])
                    : [
                        await fetch(buildGoogleCseApiUrl(cleanedQuery, type, page, currentSort)).then(res => res.json()).catch(err => { console.warn("Erreur Google Images", err); return { items: [], searchInformation: {} }; }),
                        [],
                        []
                    ];

                if (googleResponse.error) console.error("Erreur Google Images:", googleResponse.error.message);

                const mergedResults = mergeAndWeightImageResults(googleResponse.items || [], commonsResults, meiliResults, cleanedQuery);
                combinedData = {
                    items: mergedResults,
                    searchInformation: googleResponse.searchInformation || { totalResults: mergedResults.length.toString() },
                    googleItemsCount: (googleResponse.items || []).length,
                    hasMorePages: (googleResponse.items || []).length >= RESULTS_PER_PAGE
                };
                imageCache.set(cleanedQuery, page, combinedData, configSignature);
            }

            hideLoading();
            quotaManager.recordRequest();
            updateQuotaDisplay();
            displayResults(combinedData, type, cleanedQuery, page);
        } catch (err) {
            hideLoading();
            resultsContainer.innerHTML = `<div style="padding:2rem;text-align:center;color:#d93025;"><p>Une erreur s'est produite.</p><p style="font-size:14px;color:#70757a;">${err.message || err}</p></div>`;
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
            resultsContainer.innerHTML = `<div style="padding:2rem;text-align:center;color:#70757a;"><p style="font-size:1.2em;margin-bottom:16px;">${noResultsMsg}</p><ul style="list-style:none;padding:0;font-size:0.9em;color:#5f6368;">${suggestionsMsg.map(s => `<li>${s}</li>`).join('')}</ul></div>`;
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
        const thumbnailSrc = item.pagemap?.cse_thumbnail?.[0]?.src;
        const thumbnail = thumbnailSrc ? `<img src="${thumbnailSrc}" alt="">` : '';

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