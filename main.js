var settings = {};
var currTrivia = null;
var fiVoice = null;


window.speak = async function(text) {
    // Wait for fiVoice to be loaded
    if (!fiVoice) {
        await new Promise((resolve) => {
            const interval = setInterval(() => {
                if (fiVoice) {
                    clearInterval(interval);
                    setInterval(() => {resolve()}, 100)
                }
            }
            , 100);
        }
        );
    }
    console.log('Speaking', text)
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = fiVoice;
    window.speechSynthesis.speak(utterance);
}


class Trivia {
    openAIToken = '';
    data = [];
    currentQuestion = 0;
    aiTextInterval = null;
    aiLoadingInterval = null;
    handleKeyDownFunc = null;
    chatHistory = null;

    constructor(openAIToken, data) {
        this.openAIToken = openAIToken;
        this.data = data;
        this.aiTextElement = document.querySelector('#ai-text');
        this.userTextElement = document.querySelector('#user-text');
        this.handleKeyDownFunc = this.handleKeyDown.bind(this);
    }

    start() {
        this.currentQuestion = 0;
        this.showQuestion();
        this.listenToUserInput();
    }

    destroy() {
        // Do nothing
        document.removeEventListener('keydown', this.handleKeyDownFunc);
    }

    handleKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.enterPressed();
            return;
        }
        // Letters and numbers
        if (e.key.length === 1) {
            this.addUserText(e.key);
        }
        // Backspace
        if (e.key === 'Backspace') {
            this.removeUserText();
        }
    }

    listenToUserInput() {
        // Listen to user input
        document.addEventListener('keydown', this.handleKeyDownFunc);
    }

    async enterPressed() {
        const userText = this.userTextElement.textContent;
        if (!userText || userText.trim() === '') {
            return;
        }
        this.userTextElement.textContent = '';
        this.setAiLoading(true);
        let aiText = await this.getAIText(userText);
        this.setAiLoading(false);
        // Remove answer from AI text
        if (aiText.toLowerCase().includes(this.data[this.currentQuestion].answer.toLowerCase())) {
            aiText = aiText.replace(new RegExp(this.data[this.currentQuestion].answer, 'gi'), '_____');
        }
        if (aiText.includes("YES")) {
            await this.setAiText('Oikein!');
            await new Promise((resolve) => {
                setTimeout(resolve, 1000);
            });
            this.chatHistory = null;
            this.currentQuestion++;
            if (this.currentQuestion >= this.data.length) {
                this.setAiText('Kiitos pelaamisesta! Voit aloittaa alusta painamalla tästä');
                document.addEventListener('click', () => {
                    window.location.reload();
                }, {once: true});
                this.destroy();
                return;
            }
            this.showQuestion();
            return;
        } else {
            // remove trailing dot
            if (aiText.endsWith('.')) {
                aiText = aiText.slice(0, -1);
            }
            this.setAiText(aiText + '. ' + this.data[this.currentQuestion].question);
        }
    }

    setAiLoading(loading) {
        if (this.aiTextInterval) {
            clearInterval(this.aiTextInterval);
        }
        if (loading) {
            this.aiLoadingInterval = setInterval(() => {
                this.aiTextElement.textContent += '.';
                if (this.aiTextElement.textContent.length > 3) {
                    this.aiTextElement.textContent = '';
                }
            }, 500);
        } else {
            clearInterval(this.aiLoadingInterval);
            this.aiTextElement.textContent = '';
        }
    }

    getAIText(userText) {
        return new Promise((resolve, reject) => {
            const question = this.data[this.currentQuestion];
            const headers = {
                'Authorization': `Bearer ${this.openAIToken}`,
                'Content-Type': 'application/json'
            };
            if (!this.chatHistory) {
                this.chatHistory = [
                    {
                        role: 'user',
                        content: 'Olet trivia-botti. Minulta on kysytty kysymys "' + question.question + '", jonko vastaus on "' + question.answer + '". Minä yritän vastata oikein (Huom, saatan kirjoittaa vastauksen hieman eri tavalla, se ei haittaa). Jos vastaus on oikein, vastaa täsmälleen "YES", muussa tapauksessa vastaa vapaalla tekstillä jotain. Älä koskaan paljasta vastausta minulle. Jatketaan kunnes vastaus menee oikein. Vastaa "OK" Jos ymmärsit.'
                    },
                    {
                        role: 'assistant',
                        content: 'OK'
                    },
                    {
                        role: 'user',
                        content: userText
                    }
                ]
            } else {
                this.chatHistory.push({
                    role: 'user',
                    content: userText
                });
            }
            const body = {
                model: 'gpt-3.5-turbo',
                messages: this.chatHistory,
            };
            fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            })
                .then(response => response.json())
                .then(data => {
                    const resp = data.choices[0].message.content;
                    this.chatHistory.push({
                        role: 'assistant',
                        content: resp
                    });
                    resolve(resp);
                })
                .catch(err => {
                    console.error('Failed to get AI text', err);
                    reject(err);
                });
        });
    }

    addUserText(text) {
        this.userTextElement.textContent += text;
    }

    removeUserText() {
        this.userTextElement.textContent = this.userTextElement.textContent.slice(0, -1);
    }

    showTTSButton(show) {
        const ttsButton = document.querySelector('#tts-button');
        if (show) {
            if (settings.autoSpeak) {
                window.speak(this.aiTextElement.textContent);
            }
            setTimeout(() => {
                ttsButton.style.visibility = 'visible';
            }, 500);
        } else {
            ttsButton.style.visibility = 'hidden';
        }
    }

    async setAiText(text) {
        return new Promise((resolve, reject) => {
            // Set text one character at a time
            let i = 0;
            if (this.aiTextInterval) {
                clearInterval(this.aiTextInterval);
            }
            this.showTTSButton(false);
            this.aiTextElement.textContent = '';
            this.aiTextInterval = setInterval(() => {
                this.aiTextElement.textContent += text[i];
                i++;
                if (this.aiTextInterval) {
                    if (i >= text.length) {
                        clearInterval(this.aiTextInterval);
                        this.showTTSButton(true);
                        resolve();
                    }
                } else {
                    resolve();
                }
            }, 100);
        });
    }

    showQuestion() {
        const question = this.data[this.currentQuestion];
        this.setAiText(question.question);
    }
}

function stopTrivia() {
    if (currTrivia) {
        console.log('Destroying trivia');
        currTrivia.destroy();
    }
}

function startTrivia() {
    const openAIToken = settings.openAIToken;
    const dataJSON = settings.dataJSON;
    if (!openAIToken || !dataJSON) {
        return;
    }
    let data;
    try {
        data = JSON.parse(dataJSON);
    } catch (err) {
        console.error('Failed to parse dataJSON', err);
        data = []
    }
    if (currTrivia) {
        // Destroy current trivia
        currTrivia.destroy();
    }
    const trivia = new Trivia(openAIToken, data);
    trivia.start();
    currTrivia = trivia;
}


Object.defineProperties(settings, {
    'openAIToken': {
        get: function() {
            // Get local storage
            return localStorage.getItem('openAIToken') || '';
        },
        set: function(value) {
            // Set local storage also
            localStorage.setItem('openAIToken', value);
            document.querySelector('input[name="openAIToken"]').value = value;
        }
    },
    'dataJSON': {
        get: function() {
            return localStorage.getItem('dataJSON') || '';
        },
        set: function(value) {
            localStorage.setItem('dataJSON', value);
            document.querySelector('textarea[name="dataJSON"]').value = value;
        }
    },
    'autoSpeak': {
        get: function() {
            return localStorage.getItem('autoSpeak') === 'true';
        },
        set: function(value) {
            localStorage.setItem('autoSpeak', value);
            document.querySelector('input[name="autoSpeak"]').checked = value;
        }
    },
});
document.querySelector('input[name="openAIToken"]').addEventListener('change', (e) => {
    settings.openAIToken = e.target.value;
});
document.querySelector('textarea[name="dataJSON"]').addEventListener('input', (e) => {
    settings.dataJSON = e.target.value;
});
document.querySelector('input[name="autoSpeak"]').addEventListener('change', (e) => {
    settings.autoSpeak = e.target.checked;
});

// Get initial values from local storage
settings.openAIToken = localStorage.getItem('openAIToken') || '';
settings.dataJSON = localStorage.getItem('dataJSON') || '';
settings.autoSpeak = localStorage.getItem('autoSpeak') === 'true';

// If initial settings are empty, show settings modal now
if (!settings.openAIToken || !settings.dataJSON) {
    const settingsModal = document.querySelector('#settings-modal');
    settingsModal.style.display = 'block';
} else {
    startTrivia();
}

const settingsBtn = document.querySelector('#settings-button');
settingsBtn.addEventListener('click', () => {
    const settingsModal = document.querySelector('#settings-modal');
    stopTrivia();
    settingsModal.style.display = 'block';
    settingsModal.addEventListener('mousedown', (e) => {
        if (e.target.id === 'settings-modal') {
            settingsModal.style.display = 'none';
            startTrivia();
        }
    });
});

const ttsButton = document.querySelector('#tts-button');
window.speechSynthesis.onvoiceschanged = () => {
    const voices = window.speechSynthesis.getVoices();
    // Find fi-FI voice
    for (let i = 0; i < voices.length; i++) {
        if (voices[i].lang === 'fi-FI') {
            fiVoice = voices[i];
            console.log('Found fiVoice', fiVoice);
            if (fiVoice.name.includes("Satu")) {
                break;
            }
        }
    }
    console.log('fiVoice', fiVoice);
}

ttsButton.addEventListener('click', () => {
    const aiText = document.querySelector('#ai-text').textContent;
    window.speak(aiText);
});