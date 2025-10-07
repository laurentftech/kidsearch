
document.addEventListener('DOMContentLoaded', () => {
    const voiceSearchButton = document.getElementById('voiceSearchButton');
    const searchInput = document.getElementById('searchInput');

    if (!voiceSearchButton || !searchInput) {
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceSearchButton.style.display = 'none';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = document.documentElement.lang === 'en' ? 'en-US' : 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let isRecognizing = false;

    voiceSearchButton.addEventListener('click', () => {
        if (isRecognizing) {
            recognition.stop();
            return;
        }
        recognition.start();
    });

    recognition.onstart = () => {
        isRecognizing = true;
        voiceSearchButton.classList.add('recording');
        voiceSearchButton.textContent = '🔴';
    };

    recognition.onend = () => {
        isRecognizing = false;
        voiceSearchButton.classList.remove('recording');
        voiceSearchButton.textContent = '🎤';
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        searchInput.value = transcript;
        // Automatically trigger search
        const form = searchInput.closest('form');
        if (form) {
            const submitEvent = new Event('submit', { cancelable: true });
            form.dispatchEvent(submitEvent);
             if (!submitEvent.defaultPrevented) {
                // The search.js logic should handle the form submission.
                // We just need to make sure the input has the value.
                const doSearchFunction = window.doSearch || document.querySelector('form').onsubmit;
                 if (typeof doSearchFunction === 'function') {
                    doSearchFunction();
                }
            }
        }
    };

    recognition.onerror = (event) => {
        console.error('Voice recognition error:', event.error);
    };
});
