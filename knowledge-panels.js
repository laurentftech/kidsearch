// knowledge-panels.js - Encarts de connaissances basés sur Vikidia

// Fonction pour récupérer des informations depuis Vikidia
async function getVikidiaPanel(query) {
    try {
        // API Action MediaWiki de Vikidia
        const apiUrl = `https://fr.vikidia.org/w/api.php`;
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            titles: query,
            prop: 'extracts|pageimages',
            exintro: true,
            explaintext: true,
            exsectionformat: 'plain',
            piprop: 'thumbnail',
            pithumbsize: 300,
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

            // Désactiver les images pour éviter les erreurs HTTPS/CORS
            // Les serveurs Vikidia n'acceptent pas toujours les requêtes HTTPS pour les images
            thumbnailUrl = null;

            return {
                title: page.title,
                extract: page.extract.substring(0, 400) + (page.extract.length > 400 ? '...' : ''),
                thumbnail: thumbnailUrl,
                url: `https://fr.vikidia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
                source: "Vikidia - L'encyclopédie des 8-13 ans"
            };
        }
    } catch (error) {
        console.error('Erreur API Vikidia:', error);
    }

    return null;
}

// Fonction pour essayer plusieurs variantes d'un terme de recherche
async function findBestVikidiaMatch(query) {
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
        const result = await getVikidiaPanel(variant);
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
                    En savoir plus sur Vikidia →
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
        const panelData = await findBestVikidiaMatch(query);
        if (panelData) {
            displayKnowledgePanel(panelData);
        }
    } catch (error) {
        console.error('Erreur lors de la création de l\'encart:', error);
    }
}