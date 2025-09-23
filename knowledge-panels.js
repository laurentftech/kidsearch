// knowledge-panels.js - Encarts de connaissances basés sur Vikidia

// Fonction pour récupérer des informations depuis Vikidia
async function getKnowledgePanelData(query) {
    const cfg = CONFIG.KNOWLEDGE_PANEL_CONFIG;

    try {
        // API Action MediaWiki de Vikidia
        const apiUrl = cfg.API_URL;
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            titles: query,
            prop: 'extracts|pageimages',
            exintro: true,
            explaintext: true,
            exsectionformat: 'plain',
            piprop: 'thumbnail',
            pithumbsize: cfg.THUMBNAIL_SIZE,
            origin: '*'
        });

        const response = await fetch(`${apiUrl}?${params}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const pages = data.query.pages;
        const page = Object.values(pages)[0];

        if (page && !page.missing && page.extract) {
            let thumbnailUrl = page.thumbnail?.source || null;

            if (cfg.DISABLE_THUMBNAILS) {
                thumbnailUrl = null;
            }

            return {
                title: page.title,
                extract: page.extract.substring(0, cfg.EXTRACT_LENGTH) + (page.extract.length > cfg.EXTRACT_LENGTH ? '...' : ''),
                thumbnail: thumbnailUrl,
                url: `${cfg.BASE_URL}${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
                source: cfg.SOURCE_NAME
            };
        }
    } catch (error) {
        console.error(`Erreur API pour ${cfg.SOURCE_NAME}:`, error);
    }

    return null;
}

// Fonction pour essayer plusieurs variantes d'un terme de recherche
async function findBestKnowledgeMatch(query) {
    console.log("Recherche Vikidia pour:", query);

    // Liste des variantes à essayer
    const variants = [
        query, // Terme original
        query.charAt(0).toUpperCase() + query.slice(1), // Première lettre majuscule
        query.toLowerCase(), // Tout en minuscules
        query.replace(/s$/, ''), // Singulier (retire le 's' final)
        query + 's', // Pluriel (ajoute un 's')
        // Versions avec accents courants
        query.replace(/moyen age/i, 'Moyen Âge'),
        query.replace(/moyen age/i, 'moyen âge'),
        // Autres variantes communes
        query.replace(/\b\w/g, l => l.toUpperCase()), // Titre Case
    ];

    for (const variant of variants) {
        console.log("Essai variante:", variant);
        const result = await getKnowledgePanelData(variant);
        console.log("Résultat pour", variant, ":", result);
        if (result) {
            return result;
        }
    }

    console.log("Aucune variante trouvée");
    return null;
}

// Fonction pour afficher l'encart de connaissance
function displayKnowledgePanel(panelData) {
    console.log("displayKnowledgePanel appelé avec:", panelData);

    const existingPanel = document.getElementById('knowledgePanel');
    if (existingPanel) {
        existingPanel.remove();
    }

    if (!panelData) {
        console.log("Pas de données pour l'encart");
        return;
    }

    const panelHTML = `
        <div id="knowledgePanel" class="knowledge-panel">
            <div class="panel-header">
                <h3 class="panel-title">${panelData.title || 'Titre non disponible'}</h3>
                <span class="panel-source">${panelData.source || 'Source inconnue'}</span>
            </div>
            
            ${panelData.thumbnail ?
        `<div class="panel-image">
                    <img src="${panelData.thumbnail}" alt="${panelData.title}" 
                         onerror="this.parentElement.style.display='none'; console.log('Image Vikidia non accessible:', this.src)">
                </div>` : ''
    }
            
            <div class="panel-content">
                <p class="panel-extract">${panelData.extract || 'Contenu non disponible'}</p>
            </div>
            
            <div class="panel-footer">
                <a href="${panelData.url || '#'}" target="_blank" rel="noopener" class="panel-link">
                    En savoir plus sur ${panelData.source.split(' ')[0]} →
                </a>
            </div>
        </div>
    `;

    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer) {
        resultsContainer.insertAdjacentHTML('afterbegin', panelHTML);
        console.log("Panel ajouté au DOM");
    } else {
        console.error("Container resultsContainer non trouvé");
    }
}

// Fonction pour rechercher et afficher un encart si pertinent
async function tryDisplayKnowledgePanel(query) {
    // Supprimer l'encart existant d'abord
    const existingPanel = document.getElementById('knowledgePanel');
    if (existingPanel) {
        existingPanel.remove();
    }

    // Vérifier si la fonctionnalité est activée dans la config
    if (!CONFIG.KNOWLEDGE_PANEL_CONFIG || !CONFIG.KNOWLEDGE_PANEL_CONFIG.ENABLED) {
        return;
    }

    // Ne pas afficher d'encart pour des requêtes trop courtes ou trop complexes
    if (query.length < 3 || query.includes('"') || query.includes('site:')) {
        return;
    }

    // Mots-clés qui déclenchent souvent de bons résultats Vikidia
    const goodKeywords = [
        'animal', 'dinosaure', 'planète', 'pays', 'histoire', 'science',
        'géographie', 'biologie', 'chimie', 'physique', 'mathématiques',
        'littérature', 'art', 'musique', 'sport', 'nature', 'corps humain',
        'système solaire', 'océan', 'montagne', 'forêt', 'climat'
    ];

    // Vérifier si la requête contient des mots-clés pertinents
    const queryLower = query.toLowerCase();
    const hasGoodKeyword = goodKeywords.some(keyword =>
        queryLower.includes(keyword) || keyword.includes(queryLower)
    );

    if (!hasGoodKeyword && query.split(' ').length > 3) {
        // Éviter les requêtes trop spécifiques sans mots-clés pertinents
        return;
    }

    try {
        const panelData = await findBestKnowledgeMatch(query);
        if (panelData) {
            displayKnowledgePanel(panelData);
        }
    } catch (error) {
        console.error('Erreur lors de la création de l\'encart:', error);
    }
}