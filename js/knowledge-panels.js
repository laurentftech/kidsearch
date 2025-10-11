// knowledge-panels.js - Version corrigée avec vérification CONFIG
// Affiche un panneau de connaissances pour certaines requêtes

async function tryDisplayKnowledgePanel(query) {
    // Vérification que CONFIG existe
    if (typeof CONFIG === 'undefined') {
        console.warn('⚠️ CONFIG non disponible pour knowledge panel');
        return;
    }

    // Vérifie si les panneaux de connaissances sont activés
    if (!CONFIG.KNOWLEDGE_PANEL_CONFIG?.ENABLED) {
        return;
    }

    const config = CONFIG.KNOWLEDGE_PANEL_CONFIG;

    // Détecte la langue de la requête
    const queryLang = detectQueryLanguage(query);
    const lang = queryLang || (typeof i18n !== 'undefined' ? i18n.getLang() : 'fr');

    // Remplace {lang} dans les URLs
    const apiUrl = config.API_URL.replace('{lang}', lang);
    const baseUrl = config.BASE_URL.replace('{lang}', lang);

    try {
        // Recherche la page correspondante
        const searchUrl = new URL(apiUrl);
        searchUrl.searchParams.set('action', 'query');
        searchUrl.searchParams.set('format', 'json');
        searchUrl.searchParams.set('list', 'search');
        searchUrl.searchParams.set('srsearch', query);
        searchUrl.searchParams.set('srlimit', '1');
        searchUrl.searchParams.set('origin', '*');

        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (!searchData.query?.search?.[0]) {
            return; // Aucun résultat
        }

        const pageTitle = searchData.query.search[0].title;

        // Récupère l'extrait et l'image
        const pageUrl = new URL(apiUrl);
        pageUrl.searchParams.set('action', 'query');
        pageUrl.searchParams.set('format', 'json');
        pageUrl.searchParams.set('prop', 'extracts|pageimages');
        pageUrl.searchParams.set('exintro', '1');
        pageUrl.searchParams.set('explaintext', '1');
        pageUrl.searchParams.set('exsentences', '3');
        pageUrl.searchParams.set('piprop', 'thumbnail');
        pageUrl.searchParams.set('pithumbsize', config.THUMBNAIL_SIZE || 300);
        pageUrl.searchParams.set('titles', pageTitle);
        pageUrl.searchParams.set('origin', '*');

        const pageResponse = await fetch(pageUrl);
        const pageData = await pageResponse.json();

        const page = Object.values(pageData.query.pages)[0];

        if (!page.extract) {
            return; // Pas d'extrait disponible
        }

        // Crée le panneau
        displayKnowledgePanel({
            title: pageTitle,
            extract: page.extract,
            thumbnail: config.DISABLE_THUMBNAILS ? null : page.thumbnail?.source,
            url: `${baseUrl}${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
            source: config.SOURCE_NAME || 'Vikidia'
        });

    } catch (error) {
        console.error('Erreur lors de la création du panneau de connaissances:', error);
    }
}

function displayKnowledgePanel(data) {
    const resultsContainer = document.getElementById('resultsContainer');
    if (!resultsContainer) return;

    // Vérifie si un panneau existe déjà
    let panel = document.getElementById('knowledgePanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'knowledgePanel';
        panel.className = 'knowledge-panel';
        resultsContainer.insertBefore(panel, resultsContainer.firstChild);
    }

    // Tronque l'extrait si trop long
    const maxLength = CONFIG.KNOWLEDGE_PANEL_CONFIG?.EXTRACT_LENGTH || 400;
    let extract = data.extract;
    if (extract.length > maxLength) {
        extract = extract.substring(0, maxLength) + '...';
    }

    // Construction du HTML
    const thumbnailHTML = data.thumbnail
        ? `<div class="panel-thumbnail"><img src="${data.thumbnail}" alt="${data.title}"></div>`
        : '';

    panel.innerHTML = `
        ${thumbnailHTML}
        <div class="panel-content">
            <h3 class="panel-title">${data.title}</h3>
            <p class="panel-extract">${extract}</p>
            <div class="panel-footer">
                <a href="${data.url}" target="_blank" rel="noopener noreferrer" class="panel-link">
                    ${typeof i18n !== 'undefined' ? i18n.get('readMore') : 'En savoir plus'} →
                </a>
                <span class="panel-source">${data.source}</span>
            </div>
        </div>
    `;

    // Animation d'apparition
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(-10px)';
    setTimeout(() => {
        panel.style.transition = 'all 0.3s ease';
        panel.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
    }, 100);
}

function detectQueryLanguage(query) {
    const lq = query.toLowerCase();
    if (/[àâçéèêëîïôûùüÿœæ]/i.test(lq) || /\b(le|la|les|un|une|des)\b/i.test(lq)) {
        return 'fr';
    }
    if (/\b(the|and|for|what|who|are)\b/i.test(lq)) {
        return 'en';
    }
    return null;
}

// Styles CSS pour le panneau (injecté dynamiquement)
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        .knowledge-panel {
            background: #fff;
            border: 1px solid #dfe1e5;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
            display: flex;
            gap: 16px;
            box-shadow: 0 1px 6px rgba(32,33,36,.28);
        }

        .panel-thumbnail {
            flex-shrink: 0;
        }

        .panel-thumbnail img {
            width: 150px;
            height: 150px;
            object-fit: cover;
            border-radius: 8px;
        }

        .panel-content {
            flex: 1;
            min-width: 0;
        }

        .panel-title {
            font-size: 20px;
            font-weight: 500;
            color: #202124;
            margin: 0 0 8px 0;
        }

        .panel-extract {
            font-size: 14px;
            line-height: 1.6;
            color: #4d5156;
            margin: 0 0 12px 0;
        }

        .panel-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .panel-link {
            color: #1a73e8;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
        }

        .panel-link:hover {
            text-decoration: underline;
        }

        .panel-source {
            font-size: 12px;
            color: #70757a;
        }

        @media (max-width: 768px) {
            .knowledge-panel {
                flex-direction: column;
            }

            .panel-thumbnail img {
                width: 100%;
                height: auto;
                max-height: 200px;
            }
        }
    `;
    document.head.appendChild(style);
}