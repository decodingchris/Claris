import os
import tempfile

import boto3
import openai

from dotenv import load_dotenv
from flask import Flask, render_template, request, Response
from simpleaichat import AIChat

load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")
openai_model = "gpt-3.5-turbo-0613"

ALLOWED_EXTENSIONS = {"webm"}

prompt = f"""Please be aware that human input is being transcribed from audio and as such there may be some errors in the transcription. 
You will attempt to account for some words being swapped with similar-sounding words or phrases.
You must follow ALL these rules in all responses:
- You are the following character and should ALWAYS act as them: An investor attending a startup pitch event. 
- The entrepreneur will present their startup idea, and you will ask them questions and provide feedback as an investor. 
- Please imagine yourself as an investor and provide realistic responses throughout the pitch. 
- Engage in a conversation with the entrepreneur, ask relevant questions, and offer feedback based on the information they provide. 
- Remember to maintain the flow of a pitch event, allowing the entrepreneur to respond before proceeding with your next question or comment.
"""
feedback_prompt = f"""Please be aware that human input is being transcribed from audio and as such there may be some errors in the transcription. 
You will attempt to account for some words being swapped with similar-sounding words or phrases.
Give the entrepreneur detailed feedback on their communication skills with the investor.
"""

ai = AIChat(system=prompt, model=openai_model)
ai_feedback = AIChat(system=feedback_prompt, model=openai_model)

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


def generate_ai_response(text):
    response = None
    try:
        response = ai(text)
    except Exception as e:
        print("Error: generate ai response - ", e)
    return response


def generate_ai_feedback(text):
    response = None
    try:
        response = ai_feedback(text)
    except Exception as e:
        print("Error: generate ai feedback - ", e)
    return response


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


# Todo: Store the files in s3
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
    response = []
    if file and allowed_file(file.filename):
        try:
            user_speech = create_temp_file(".webm", file.read())
            user_transcript = speech_to_text(user_speech)
            ai_response = generate_ai_response(user_transcript)
            response.append({"user": user_transcript})
            response.append({"ai": ai_response})
            os.remove(user_speech)
        except Exception as e:
            print("Error: ", e)
    return response


@app.route("/synthesize", methods=["POST"])
def synthesize():
    text = request.form["ai_response"]
    try:
        ai_speech = text_to_speech(text)
        data_stream = ai_speech.get("AudioStream")
        return data_stream
    except Exception as e:
        print("Error: ", e)


@app.route("/feedback", methods=["POST"])
def feedback():
    convo_array = request.form["conversation"]
    response = []
    if convo_array:
        try:
            response = generate_ai_feedback(
                f"Give feedback on the following: {convo_array}"
            )
        except Exception as e:
            print("Error: ", e)
    return response
