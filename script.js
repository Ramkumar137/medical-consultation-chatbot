        // Utility functions
const utils = {
    createElement(type, className, content) {
    const element = document.createElement(type);
    if (className) element.className = className;
    if (content) element.textContent = content;
    return element;
    },

    showElement(element) {
        element.classList.remove('hidden');
    },

    hideElement(element) {
        element.classList.add('hidden');
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

        // Chat Interface Class
       // Chat Interface Class
class ChatInterface {
    constructor() {
        this.messagesContainer = document.getElementById('chat-messages');
        this.chatForm = document.getElementById('chat-form');
        this.messageInput = document.getElementById('message-input');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.patientInfo = document.getElementById('patient-info');
    }

    initialize(patientData) {
        this.patientData = patientData;
        this.updatePatientInfo();
        this.initializeListeners();
        this.sendWelcomeMessage();
    }

    updatePatientInfo() {
        this.patientInfo.textContent = `Patient: ${this.patientData.name} | Age: ${this.patientData.age} | Gender: ${this.patientData.gender}`;
    }

    initializeListeners() {
        this.chatForm.addEventListener('submit', this.handleSubmit.bind(this));
    }

    async sendWelcomeMessage() {
        await this.showTypingIndicator();
        const hasPrescription = this.patientData.prescriptionFile ? "provided your previous prescription. I'll review it shortly." : "not provided any previous prescriptions.";
        this.addMessage(`Hello ${this.patientData.name}! I see you've ${hasPrescription} How can I help you today?`, 'bot');
        this.hideTypingIndicator();
    }

    async handleSubmit(e) {
        e.preventDefault();
        const message = this.messageInput.value.trim();
        if (!message) return;

        this.messageInput.value = '';
        this.addMessage(message, 'user');
        
        // Show typing indicator while waiting for response
        await this.showTypingIndicator();

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    patientData: this.patientData
                })
            });

            const data = await response.json();
            
            if (data.error) {
                this.addMessage('Sorry, there was an error processing your request.', 'bot');
            } else {
                this.addMessage(data.response, 'bot');
            }
        } catch (error) {
            console.error('Error:', error);
            this.addMessage('Sorry, there was an error connecting to the server.', 'bot');
        } finally {
            this.hideTypingIndicator();
        }
    }

    addMessage(text, sender) {
        const message = document.createElement('div');
        message.className = `message ${sender}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = sender === 'bot' ? 
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0"></path></svg>' :
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';

        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = text;

        message.appendChild(avatar);
        message.appendChild(content);
        this.messagesContainer.appendChild(message);
        this.scrollToBottom();
    }

    async showTypingIndicator() {
        this.typingIndicator.classList.remove('hidden');
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.typingIndicator.classList.add('hidden');
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
}

// Registration Form Class
class RegistrationForm {
    constructor() {
        this.form = document.getElementById('patient-form');
        this.uploadArea = document.getElementById('prescription-upload-area');
        this.fileInput = document.getElementById('prescription-file');
        this.initializeListeners();
    }

    initializeListeners() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.fileInput.addEventListener('change', this.handleFileChange.bind(this));
    }

    handleFileChange(e) {
        const file = e.target.files[0];
        if (file) {
            const placeholder = this.uploadArea.querySelector('.upload-placeholder');
            placeholder.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>${file.name}</span>
            `;
            this.uploadArea.style.borderColor = '#3b82f6';
            this.uploadArea.style.backgroundColor = '#f0f9ff';
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const formData = {
            name: document.getElementById('name').value,
            age: document.getElementById('age').value,
            gender: document.getElementById('gender').value,
            medicalHistory: document.getElementById('medical-history').value,
            prescriptionFile: this.fileInput.files[0]
        };

        // If there's a prescription file, upload it first
        if (formData.prescriptionFile) {
            const uploadFormData = new FormData();
            uploadFormData.append('prescription', formData.prescriptionFile);
            
            try {
                const response = await fetch('/upload-prescription', {
                    method: 'POST',
                    body: uploadFormData
                });
                const data = await response.json();
                formData.prescriptionAnalysis = data.analysis;
            } catch (error) {
                console.error('Error uploading prescription:', error);
            }
        }

        document.getElementById('registration-form').classList.add('hidden');
        document.getElementById('chat-interface').classList.remove('hidden');
        
        chatInterface.initialize(formData);
    }
}
const registrationForm = new RegistrationForm();
const chatInterface = new ChatInterface();
// Allow sending message with Enter key
document.getElementById('user-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});