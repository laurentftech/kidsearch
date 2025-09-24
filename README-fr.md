[![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=000000)](https://www.buymeacoffee.com/laurentftech)

# KidSearch 🔍

Un moteur de recherche sécurisé et éducatif conçu pour les enfants, utilisant Google Custom Search Engine avec des résultats filtrés et des encarts de connaissances basés sur Vikidia.

## Fonctionnalités

- 🎯 **Résultats filtrés** : Seuls les sites éducatifs approuvés apparaissent
- 🔍 **Autocomplétion personnalisée** : Plus de 200 suggestions éducatives avec navigation clavier
- 📚 **Sites recommandés** : Sélection de ressources pédagogiques de qualité
- 🖼️ **Recherche d'images** : Mode de recherche d'images avec prévisualisation
- 📖 **Encarts de connaissances** : Informations contextuelles depuis Vikidia pour enrichir les résultats
- 🔄 **Cache intelligent** : Système de mise en cache pour optimiser les performances et économiser le quota API
- 📊 **Gestion du quota** : Surveillance automatique de l'utilisation de l'API Google
- 🇫🇷🇬🇧 **Priorisation de la langue** : Détection automatique des requêtes en français ou en anglais pour de meilleurs résultats
- 🔧 **Options de tri** : Tri par pertinence ou par date (pour les résultats web)
- 📱 **Design responsive** : Fonctionne sur ordinateur, tablette et mobile
- 🎨 **Interface enfant** : Design coloré et convivial avec icônes expressives

## Installation

1. **Clonez le repository** :
   ```bash
   git clone [votre-repo]
   cd search-for-kids
   ```

2. **Configuration** :
   ```bash
   cp config.example.js config.js
   ```

3. **Éditez `config.js`** avec votre ID Google Custom Search Engine, votre API key Google et la configuration des encarts :
   ```javascript
   const CONFIG = {
       GOOGLE_CSE_ID: 'votre_id_cse_ici',
       GOOGLE_API_KEY: 'VOTRE_API_KEY_ICI',
       KNOWLEDGE_PANEL_CONFIG: {
           ENABLED: true,
           API_URL: 'https://fr.vikidia.org/w/api.php',
           BASE_URL: 'https://fr.vikidia.org/wiki/',
           SOURCE_NAME: 'Vikidia (Encyclopédie des 8-13 ans)',
           EXTRACT_LENGTH: 300,
           THUMBNAIL_SIZE: 150,
           DISABLE_THUMBNAILS: false
       }
   };
   ```

4. **Lancez un serveur local** :
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Ou utilisez Live Server dans VS Code
   ```

5. **Accédez à** : `http://localhost:8000`

## Configuration Google CSE

1. Allez sur [Google Custom Search Engine](https://cse.google.com/)
2. Créez un nouveau moteur de recherche
3. Ajoutez vos sites approuvés dans les "Sites à rechercher"
4. Activez la recherche d'images dans les paramètres
5. Récupérez votre ID CSE (format : `xxx:yyyyy`)
6. Obtenez une clé API Google depuis [Google Cloud Console](https://console.cloud.google.com)
7. Collez les identifiants dans `config.js`

## Structure des fichiers

```
search-for-kids/
├── index.html              # Page d'accueil avec sites recommandés
├── results.html            # Page de résultats avec onglets web/images
├── search.js              # Moteur de recherche principal avec cache et quota
├── knowledge-panels.js    # Encarts de connaissances Vikidia
├── suggestions.json       # Base de données des suggestions d'autocomplétion
├── config.js             # Configuration (non commitée)
├── config.example.js     # Exemple de configuration
├── logo.png             # Logo du moteur de recherche
├── favicon.png          # Icône du site
└── README.md            # Ce fichier
```

## Fonctionnalités avancées

### Système de cache
- **Cache persistant** : Les résultats sont mis en cache dans localStorage pour 7 jours
- **Limite intelligente** : Maximum 300 requêtes en cache pour optimiser les performances
- **Nettoyage automatique** : Suppression automatique des entrées expirées

### Gestion du quota API
- **Surveillance quotidienne** : Suivi de l'utilisation de l'API avec limite de 90 requêtes/jour
- **Indicateur visuel** : Affichage en temps réel du quota restant et de l'état du cache
- **Protection** : Évite le dépassement accidentel des limites Google

### Encarts de connaissances
- **Source éducative** : Intégration avec l'API de Vikidia pour des informations adaptées aux enfants
- **Recherche intelligente** : Essai de plusieurs variantes (singulier/pluriel, casse, accents)
- **Filtrage pertinent** : Affichage uniquement pour les requêtes éducatives appropriées

### Détection de langue
- **Priorisation française** : Détection automatique des requêtes en français
- **Meilleurs résultats** : Application du filtre `lang_fr` pour des résultats plus pertinents

## Personnalisation

### Ajouter des suggestions
Éditez `suggestions.json` pour ajouter vos propres termes de recherche :

```json
{
  "suggestions": [
    "nouveau terme",
    "autre suggestion",
    "dinosaures",
    "système solaire"
  ]
}
```

### Modifier les sites recommandés
Dans `index.html`, section `.recommended-sites`, ajoutez vos propres sites éducatifs avec icônes.

### Configuration des encarts
Personnalisez les encarts de connaissances dans `config.js` :
- `ENABLED` : Activer/désactiver la fonctionnalité
- `EXTRACT_LENGTH` : Longueur des extraits (défaut: 300 caractères)
- `DISABLE_THUMBNAILS` : Désactiver les images si nécessaire

## Technologies utilisées

- **Frontend** : HTML5/CSS3, JavaScript ES6+
- **APIs** : Google Custom Search Engine API, MediaWiki API (Vikidia)
- **Stockage** : localStorage pour le cache et la gestion du quota
- **Design** : CSS Grid/Flexbox, design responsive
- **Fonctionnalités** : Autocomplétion, modal d'images, pagination, tri

## Sécurité et confidentialité

- ✅ Tous les résultats sont filtrés par Google CSE
- ✅ Seuls les sites pré-approuvés apparaissent
- ✅ Pas de collecte de données personnelles
- ✅ Cache local uniquement (pas de serveur tiers)
- ✅ Interface dédiée aux enfants
- ✅ Sources éducatives vérifiées (Vikidia)

## Utilisation

### Recherche de base
1. Tapez votre recherche dans la barre
2. Utilisez l'autocomplétion avec les flèches ↑↓ et Entrée
3. Cliquez sur 🔍 ou appuyez sur Entrée

### Recherche d'images
1. Effectuez une recherche
2. Cliquez sur l'onglet "Images"
3. Cliquez sur une image pour l'agrandir

### Options de tri (résultats web)
1. Cliquez sur "Outils" sous la barre de recherche
2. Choisissez "Trier par date" pour les résultats récents
3. Ou gardez "Pertinence" pour les meilleurs résultats

## Contribution

1. Fork le projet
2. Créez une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit vos changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrez une Pull Request

## Dépannage

### Problèmes courants
- **Pas de résultats** : Vérifiez votre configuration Google CSE et API key
- **Quota dépassé** : Attendez le lendemain ou vérifiez l'indicateur de quota
- **Images non chargées** : Vérifiez que la recherche d'images est activée dans Google CSE
- **Encarts manquants** : Vérifiez que `KNOWLEDGE_PANEL_CONFIG.ENABLED` est `true`

### Cache et performance
- Le cache se vide automatiquement après 7 jours
- Pour vider manuellement : ouvrez la console et tapez `localStorage.clear()`
- L'indicateur de quota apparaît en bas à droite de la page de résultats

## License

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

**Créé avec ❤️ pour l'éducation des enfants**