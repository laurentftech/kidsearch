document.addEventListener('DOMContentLoaded', () => {
    const voiceSearchButton = document.getElementById('voiceSearchButton');
    const searchInput = document.getElementById('searchInput');

    if (!voiceSearchButton || !searchInput) return;

    // Désactiver si spécifié dans la config
    if (typeof CONFIG !== 'undefined' && CONFIG.VOICE_SEARCH_ENABLED === false) {
        voiceSearchButton.style.display = 'none';
        return;
    }

    // Compatibilité API Web Speech
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceSearchButton.style.display = 'none';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = navigator.language || 'fr-FR'; // langue automatique
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let isRecognizing = false;

    // Effets visuels doux
    const startListening = () => {
        isRecognizing = true;
        voiceSearchButton.classList.add('recording');
        searchInput.classList.add('listening');
    };

    const stopListening = () => {
        isRecognizing = false;
        voiceSearchButton.classList.remove('recording');
        searchInput.classList.remove('listening');
    };

    voiceSearchButton.addEventListener('click', () => {
        if (isRecognizing) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    recognition.onstart = startListening;
    recognition.onend = stopListening;

    // Arrête la reconnaissance dès que l'utilisateur a fini de parler.
    recognition.onspeechend = () => {
        recognition.stop();
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        searchInput.value = transcript;

        // Déclenche la recherche en soumettant le formulaire pour une intégration robuste.
        if (searchInput.form) {
            // Simule un événement de soumission pour déclencher les handlers existants.
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            searchInput.form.dispatchEvent(submitEvent);
        }
    };

    recognition.onerror = (event) => {
        console.error('Voice recognition error:', event.error);
        stopListening();

        // Feedback visible et doux
        switch(event.error) {
            case 'no-speech':
                voiceSearchButton.title = 'Aucune voix détectée. Réessaie !';
                break;
            case 'not-allowed':
                voiceSearchButton.title = 'Micro non autorisé.';
                break;
            default:
                voiceSearchButton.title = 'Erreur de reconnaissance. Réessaie !';
        }
    };
});
