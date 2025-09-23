// i18n.js - Gestion de l'internationalisation

const translations = {
    fr: {
        // Page d'accueil
        homeTitle: "Search for Kids",
        homeDescription: "Utilise ce moteur de recherche pour trouver des informations adaptées aux enfants et pour tes exposés. Tape un mot ou une question et clique sur la loupe pour voir les résultats filtrés.",
        recommendedTitle: "📚 Sites recommandés pour tes recherches",
        footerText: "Créé avec ❤️ pour l'éducation des enfants",
        sites: [
            { url: "https://fr.vikidia.org/", icon: "📖", title: "Vikidia", desc: "L'encyclopédie des 8-13 ans" },
            { url: "https://www.1jour1actu.com/", icon: "📰", title: "1jour1actu", desc: "L'actualité à la portée des enfants" },
            { url: "https://www.cite-sciences.fr/", icon: "🔬", title: "Cité des Sciences", desc: "Sciences et découvertes pour les curieux" },
            { url: "https://classes.bnf.fr/", icon: "📚", title: "BnF Classes", desc: "Ressources de la Bibliothèque nationale" },
            { url: "https://kids.nationalgeographic.com/", icon: "🌍", title: "Nat Geo Kids", desc: "Geography, science, and nature" },
            { url: "https://louvrekids.louvre.fr/", icon: "🎨", title: "Louvre Kids", desc: "Découvre l'art et les œuvres du Louvre" }
        ],

        // Page de résultats
        resultsTitle: "Search for Kids - Résultats",
        placeholder: "Tape ta recherche...",
        webTab: "Tous",
        imagesTab: "Images",
        toolsButton: "Outils",
        relevanceOption: "Pertinence",
        dateOption: "Date",
        loadingText: "Recherche en cours...",
        noResults: "Aucun résultat trouvé pour",
        noImages: "Aucune image trouvée pour",
        aboutResults: "Environ",
        results: "résultats",
        previousButton: "Précédent",
        nextButton: "Suivant",

        // Panneau de connaissances
        knowledgePanelSource: "Source inconnue",
        knowledgePanelTitle: "Titre non disponible",
        knowledgePanelContent: "Contenu non disponible",
        knowledgePanelReadMore: "En savoir plus sur"
    },
    en: {
        // Homepage
        homeTitle: "Search for Kids",
        homeDescription: "Use this search engine to find child-friendly information for your research and school projects. Type a word or question and click the magnifying glass to see filtered results.",
        recommendedTitle: "📚 Recommended sites for your research",
        footerText: "Created with ❤️ for children's education",
        sites: [
            { url: "https://kids.britannica.com/", icon: "🌍", title: "Britannica Kids", desc: "Reference encyclopedia for children" },
            { url: "https://www.natgeokids.com/", icon: "🌎", title: "Nat Geo Kids", desc: "Geography, science, and nature" },
            { url: "https://www.ducksters.com/", icon: "📖", title: "Ducksters", desc: "History, biography, and science" },
            { url: "https://www.nasa.gov/kidsclub/", icon: "🚀", title: "NASA Kids' Club", desc: "Space exploration and science from NASA" },
            { url: "https://www.funbrain.com/", icon: "🧠", title: "Funbrain", desc: "Educational games and books for kids" },
            { url: "https://www.coolmath4kids.com/", icon: "🔢", title: "Cool Math 4 Kids", desc: "Math games and activities made fun" }
        ],

        // Results page
        resultsTitle: "Search for Kids - Results",
        placeholder: "Type your search...",
        webTab: "All",
        imagesTab: "Images",
        toolsButton: "Tools",
        relevanceOption: "Relevance",
        dateOption: "Date",
        loadingText: "Searching...",
        noResults: "No results found for",
        noImages: "No images found for",
        aboutResults: "About",
        results: "results",
        previousButton: "Previous",
        nextButton: "Next",

        // Knowledge Panel
        knowledgePanelSource: "Unknown source",
        knowledgePanelTitle: "Title not available",
        knowledgePanelContent: "Content not available",
        knowledgePanelReadMore: "Read more on"
    }
};

class I18nManager {
    constructor() {
        const savedLang = localStorage.getItem('preferred_language');
        if (savedLang && translations[savedLang]) {
            this.currentLang = savedLang;
        } else {
            // Détection plus fiable : prioriser le français si le navigateur est en 'fr'
            this.currentLang = navigator.language.startsWith('fr') ? 'fr' : 'en';
        }
    }

    get(key, replacements = {}) {
        let text = translations[this.currentLang][key] || key;
        for (const placeholder in replacements) {
            text = text.replace(`{{${placeholder}}}`, replacements[placeholder]);
        }
        return text;
    }

    getLang() {
        return this.currentLang;
    }

    updateContent() {
        document.documentElement.lang = this.currentLang;
        this.updatePageSpecificContent();
        this.updateDataAttributes();
    }

    updateDataAttributes() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const attr = el.getAttribute('data-i18n-attr');
            if (attr) {
                el.setAttribute(attr, this.get(key));
            } else {
                el.textContent = this.get(key);
            }
        });
    }

    updatePageSpecificContent() {
        const t = translations[this.currentLang];

        // Page d'accueil
        if (document.getElementById('sitesGrid')) {
            document.title = this.get('homeTitle');
            document.getElementById('description').textContent = this.get('homeDescription');
            document.getElementById('recommendedTitle').textContent = this.get('recommendedTitle');
            const sitesGridEl = document.getElementById('sitesGrid');
            sitesGridEl.innerHTML = '';
            t.sites.forEach(site => {
                const siteCard = document.createElement('div');
                siteCard.className = 'site-card';
                siteCard.innerHTML = `<a href="${site.url}" target="_blank" rel="noopener"><div class="site-icon">${site.icon}</div><div class="site-title">${site.title}</div><div class="site-desc">${site.desc}</div></a>`;
                sitesGridEl.appendChild(siteCard);
            });
            // Mettre à jour le footer sur la page d'accueil
            const footerTextEl = document.getElementById('footerText');
            if (footerTextEl) footerTextEl.textContent = this.get('footerText');
        }

        // Page de résultats
        if (document.getElementById('resultsContainer')) {
            document.title = this.get('resultsTitle');
        }
    }
}

const i18n = new I18nManager();

document.addEventListener('DOMContentLoaded', () => {
    i18n.updateContent();
});