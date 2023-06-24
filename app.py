import os
import tempfile

import boto3
import openai

from dotenv import load_dotenv
from flask import Flask, render_template, request
from simpleaichat import AIChat

load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")
openai_model = "gpt-3.5-turbo-0613"

ALLOWED_EXTENSIONS = {"webm"}

prompt = f"""Please be aware that human input is being transcribed from audio and as such there may be some errors in the transcription. 
You will attempt to account for some words being swapped with similar-sounding words or phrases.
You must follow ALL these rules in all responses:
- You are the following character and should ALWAYS act as them: Claris, an insightful and entertaining conversationalist.
- Engage in a conversation with an user, ask relevant questions, and offer feedback based on the information they provide. 
- Remember to maintain the flow of a conversation, allowing the user to respond before proceeding with your next question or comment.
"""

user_role = "user"
ai_role = "Claris"

ai = AIChat(system=prompt, model=openai_model)

polly = boto3.client("polly")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1000 * 1000


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def speech_to_text(filename):
    text = None
    try:
        with open(filename, "rb") as speech:
            text = openai.Audio.transcribe("whisper-1", speech)["text"]
    except Exception as e:
        print("Error: speech to text - ", e)
    return text


def text_to_speech(text):
    speech = None
    try:
        speech = polly.synthesize_speech(
            Engine="standard",
            OutputFormat="mp3",
            Text=text,
            VoiceId="Joanna",
        )
    except Exception as e:
        print("Error: text to speech - ", e)
    return speech


def create_temp_file(file_extension, file_content):
    with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
        temp_file.write(file_content)
        temp_file_name = temp_file.name
        return temp_file_name


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/transcribe", methods=["POST"])
def transcribe():
    file = request.files["recording"]
    if file and allowed_file(file.filename):
        try:
            user_speech = create_temp_file(".webm", file.read())
            user_transcript = speech_to_text(user_speech)
            try:
                ai_response = ai(user_transcript)
            except Exception as e:
                if "context_length_exceeded" in str(e):
                    return "AI Memory Error", 500
                return "Internal Server ErŸror", 500
            messages = []
            messages.append({user_role: user_transcript})
            messages.append({ai_role: ai_response})
            os.remove(user_speech)
            return messages
        except Exception as e:
            print("Error: ", e)
            return "Internal Server Error", 500
    return "Bad Request", 400


@app.route("/synthesize", methods=["POST"])
def synthesize():
    text = request.form["ai_response"]
    if text and isinstance(text, str):
        try:
            ai_speech = text_to_speech(text)
            data_stream = ai_speech.get("AudioStream")
            return data_stream
        except Exception as e:
            print("Error: ", e)
            return "Internal Server Error", 500
    return "Bad Request", 400


@app.route("/reset", methods=["GET"])
def reset():
    ai.reset_session()
    return "Conversation Reset", 200
