# Search for Kids 🔍

Un moteur de recherche sécurisé et éducatif conçu pour les enfants, utilisant Google Custom Search Engine avec des résultats filtrés.

## Fonctionnalités

- 🎯 **Résultats filtrés** : Seuls les sites éducatifs approuvés apparaissent
- 🔍 **Autocomplétion personnalisée** : Plus de 200 suggestions éducatives
- 📚 **Sites recommandés** : Sélection de ressources pédagogiques de qualité
- 📱 **Design responsive** : Fonctionne sur ordinateur, tablette et mobile
- 🎨 **Interface enfant** : Design coloré et convivial

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

3. **Éditez `config.js`** avec votre ID Google Custom Search Engine :
   ```javascript
   const CONFIG = {
       GOOGLE_CSE_ID: 'votre_id_cse_ici'
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
4. Récupérez votre ID CSE (format : `xxx:yyyyy`)
5. Collez-le dans `config.js`

## Structure des fichiers

```
search-for-kids/
├── index.html          # Page d'accueil
├── results.html        # Page de résultats  
├── suggestions.json    # Base de données des suggestions
├── config.js          # Configuration (non commitée)
├── config.example.js  # Exemple de configuration
├── logo.png          # Logo du moteur de recherche
├── favicon.png       # Icône du site
└── README.md         # Ce fichier
```

## Personnalisation

### Ajouter des suggestions
Éditez `suggestions.json` pour ajouter vos propres termes de recherche :

```json
{
  "suggestions": [
    "nouveau terme",
    "autre suggestion",
    "..."
  ]
}
```

### Modifier les sites recommandés
Dans `index.html`, section `.recommended-sites`, ajoutez vos propres sites éducatifs.

## Technologies utilisées

- HTML5/CSS3
- JavaScript (ES6+)
- Google Custom Search Engine API
- Design responsive (CSS Grid/Flexbox)

## Sécurité

- Tous les résultats sont filtrés par Google CSE
- Seuls les sites pré-approuvés apparaissent
- Pas de collecte de données personnelles
- Interface dédiée aux enfants

## Contribution

1. Fork le projet
2. Créez une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit vos changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrez une Pull Request

## License

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

**Créé avec ❤️ pour l'éducation des enfants**