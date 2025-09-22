// search.js — version complète, autonome
document.addEventListener('DOMContentLoaded', () => {
    // ========== Config & état ==========
    const RESULTS_PER_PAGE = 10;
    let currentSearchType = 'web'; // 'web' ou 'images'
    let currentQuery = '';
    let currentSort = ''; // '' (pertinence) ou 'date'
    let currentPage = 1;

    // ========== DOM refs ==========
    const searchInput = document.getElementById('searchInput');
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');
    const loadingEl = document.getElementById('loadingIndicator');
    const webResultsEl = document.getElementById('searchResults');
    const imagesResultsEl = document.getElementById('imagesResults');
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

    fetch('suggestions.json')
        .then(r => r.json())
        .then(j => { suggestions = j.suggestions || []; })
        .catch(() => {
            // fallback
            suggestions = ["animaux", "planètes", "dinosaures", "sciences", "histoire"];
        });

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
        if (e) e.preventDefault();
        const q = searchInput.value.trim();
        if (!q) return;
        currentQuery = q;
        currentPage = 1;
        performSearch(currentQuery, currentSearchType, currentPage, currentSort);
        document.title = `${currentQuery} - Search for Kids`;
        updateUrl(currentQuery, currentSearchType, currentPage, currentSort);
    }

    async function performSearch(query, type = 'web', page = 1) {
        if (!query) return;
        showLoading();
        webResultsEl.innerHTML = '';
        imagesResultsEl.innerHTML = '';
        statsEl.innerHTML = '';
        paginationEl.innerHTML = '';

        const apiUrl = buildApiUrl(query, type, page, currentSort);
        try {
            const res = await fetch(apiUrl);
            const data = await res.json();
            hideLoading();

            if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
            displayResults(data, type, query, page);
        } catch (err) {
            hideLoading();
            const target = (type === 'images') ? imagesResultsEl : webResultsEl;
            target.innerHTML = `<div style="padding:2rem; text-align:center; color:#d93025;">
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
            statsEl.textContent = totalResults ? `Environ ${totalResults.toLocaleString('fr-FR')} résultats${time ? ' (' + parseFloat(time).toFixed(2) + 's)' : ''}` : '';
        } else {
            statsEl.textContent = '';
        }

        // Gérer la visibilité du bouton Outils
        if (toolsContainer) {
            toolsContainer.style.display = (type === 'web' && totalResults > 0) ? 'block' : 'none';
        }

        if (!data.items || data.items.length === 0) {
            const target = (type === 'images') ? imagesResultsEl : webResultsEl;
            target.innerHTML = `<div style="padding:2rem; text-align:center; color:#70757a;">
        <p>Aucun ${type === 'images' ? 'image' : 'résultat'} trouvé pour "${query}".</p>
      </div>`;
            createPagination(totalResults, page);
            return;
        }

        if (type === 'web') {
            // web results
            data.items.forEach(item => {
                webResultsEl.appendChild(createSearchResult(item));
            });
            webResultsEl.style.display = 'block';
            imagesResultsEl.style.display = 'none';
        } else {
            // image results
            data.items.forEach(item => {
                imagesResultsEl.appendChild(createImageResult(item));
            });
            imagesResultsEl.style.display = 'grid';
            webResultsEl.style.display = 'none';
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
      <img src="${imgUrl}" alt="${item.title || ''}" loading="lazy" onerror="this.style.display='none'">
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
        const maxPages = totalResults ? Math.min(Math.ceil(totalResults / RESULTS_PER_PAGE), 10) : (data && data.queries && data.queries.nextPage ? page + 1 : page);

        if (page > 1) {
            const prev = document.createElement('button');
            prev.textContent = 'Précédent';
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

        if ((data && data.queries && data.queries.nextPage) || (!totalResults && (data && data.queries && data.queries.nextPage))) {
            const next = document.createElement('button');
            next.textContent = 'Suivant';
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

        if (type === 'web') {
            webResultsEl.style.display = 'block';
            imagesResultsEl.style.display = 'none';
        } else {
            webResultsEl.style.display = 'none';
            imagesResultsEl.style.display = 'grid';
        }

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
    searchInput.addEventListener('input', (ev) => {
        const value = searchInput.value.toLowerCase().trim();
        clearTimeout(inputDebounceTimer);
        inputDebounceTimer = setTimeout(() => {
            autocompleteDropdown.innerHTML = '';
            selectedIndex = -1;
            if (!value || !suggestions.length) { autocompleteDropdown.style.display = 'none'; return; }
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
        }, 150); // small debounce
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
        const qParam = params.get('q') || params.get('q');
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
                if (imagesTab) imagesTab.classList.add('active');
                if (webTab) webTab.classList.remove('active');
                imagesResultsEl.style.display = 'grid';
                webResultsEl.style.display = 'none';
            } else {
                if (webTab) webTab.classList.add('active');
                if (imagesTab) imagesTab.classList.remove('active');
                webResultsEl.style.display = 'block';
                imagesResultsEl.style.display = 'none';
            }
            performSearch(currentQuery, currentSearchType, currentPage, currentSort);
        }
    } catch (e) {
        // ignore URL parsing errors
    }

    // Initialisation
    setupSortOptions();
});
