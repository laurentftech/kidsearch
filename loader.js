// loader.js
// Ce script charge dynamiquement config.js ou config.demo.js en fallback.
// Il doit être appelé avant tout script qui dépend de l'objet CONFIG.

(function() {
    // Utilise une requête synchrone pour s'assurer que la configuration est chargée
    // avant que les autres scripts ne s'exécutent.
    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', 'config.js', false); // false = synchrone

    try {
        xhr.send();
        if (xhr.status === 200) {
            document.write('<script src="config.js"><\/script>');
        } else {
            document.write('<script src="config.demo.js"><\/script>');
        }
    } catch (e) {
        console.warn("Erreur réseau ou exécution en local (file://). Chargement de config.demo.js.");
        document.write('<script src="config.demo.js"><\/script>');
    }
}());