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
        voiceSearchButton.textContent = '🎧';
        searchInput.classList.add('listening');
    };

    const stopListening = () => {
        isRecognizing = false;
        voiceSearchButton.classList.remove('recording');
        voiceSearchButton.textContent = '🎤';
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

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        searchInput.value = transcript;

        // Trigger de recherche
        const searchFn = window.performSearch || window.doSearch || (() => {});
        searchFn(transcript);
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
