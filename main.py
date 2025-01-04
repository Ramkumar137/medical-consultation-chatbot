from flask import Flask, request, jsonify, send_from_directory, render_template
from werkzeug.utils import secure_filename
import google.generativeai as genai
import os
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

# Ensure required directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('templates', exist_ok=True)
os.makedirs('static', exist_ok=True)

# Configure Gemini API
GEMINI_API_KEY =  os.getenv("API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-pro')


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


class MedicalContext:
    def __init__(self):
        self.conversation_history = []

    def add_message(self, role, content):
        self.conversation_history.append({
            'role': role,
            'content': content,
            'timestamp': datetime.now().isoformat()
        })

    def get_context(self):
        return ' '.join([msg['content'] for msg in self.conversation_history[-5:]])


medical_contexts = {}


@app.route('/')
def index():
    """Serve the main HTML file"""
    return render_template('index.html')


@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_message = data.get('message')
        patient_data = data.get('patientData', {})
        session_id = request.headers.get('X-Session-ID', 'default')

        if not user_message:
            return jsonify({'error': 'No message provided'}), 400

        if session_id not in medical_contexts:
            medical_contexts[session_id] = MedicalContext()
        context = medical_contexts[session_id]

        context.add_message('user', user_message)

        prompt = f"""
        Patient Information:
        - Name: {patient_data.get('name')}
        - Age: {patient_data.get('age')}
        - Gender: {patient_data.get('gender')}
        - Medical History: {patient_data.get('medicalHistory')}

        Previous Conversation Context:
        {context.get_context()}

        Current Patient Query:
        {user_message}

        Please provide your response in a clear bullet-point format. Structure your response as follows:

        Start with a brief one-line greeting/acknowledgment, then provide information in these categories:

        • Understanding of the concern
        • Possible causes/factors
        • Recommended actions
        • Warning signs (if applicable)
        • Follow-up questions (if needed)

        Format each point with a bullet point (•) and make sure each point is clear and concise.
        Ensure medical terms are explained in simple language.
        If suggesting medical attention is needed, make it a clear separate point.

        Remember to:
        - Be empathetic and professional
        - Keep each point brief and clear
        - Use simple, understandable language
        - Include relevant disclaimers when needed
        """

        response = model.generate_content(prompt)
        bot_response = response.text.replace('•', '\n•')  # Ensure proper line breaks for bullets

        context.add_message('bot', bot_response)

        return jsonify({
            'response': bot_response,
            'sessionId': session_id
        })
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/upload-prescription', methods=['POST'])
def upload_prescription():
    try:
        if 'prescription' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['prescription']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)

            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                vision_model = genai.GenerativeModel('gemini-pro-vision')

                with open(filepath, 'rb') as img_file:
                    image_data = img_file.read()

                image_parts = [
                    {
                        "mime_type": "image/jpeg",
                        "data": image_data
                    }
                ]

                prompt = """
                Please analyze this prescription and provide:
                1. List of medications
                2. Dosage instructions
                3. Any special instructions or warnings
                Please note that this is for informational purposes only.
                """

                response = vision_model.generate_content([prompt, image_parts[0]])
                analysis = response.text
            else:
                analysis = "PDF analysis is not supported at this time."

            return jsonify({
                'message': 'File uploaded successfully',
                'filename': filename,
                'analysis': analysis
            })

        return jsonify({'error': 'Invalid file type'}), 400
    except Exception as e:
        logger.error(f"Error in upload_prescription endpoint: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/clear-context', methods=['POST'])
def clear_context():
    try:
        session_id = request.headers.get('X-Session-ID', 'default')
        if session_id in medical_contexts:
            del medical_contexts[session_id]
        return jsonify({'message': 'Context cleared successfully'})
    except Exception as e:
        logger.error(f"Error in clear_context endpoint: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
