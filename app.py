import os
import tempfile

import boto3
import openai

from dotenv import load_dotenv
from flask import Flask, render_template, request, send_file
from simpleaichat import AIChat

load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")
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
ai = AIChat(system=prompt, model="gpt-3.5-turbo-0613")
ai_feedback = AIChat(system=feedback_prompt, model="gpt-3.5-turbo-0613")
client = boto3.client("polly")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1000 * 1000


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def text_to_ai(text):
    response = "Please repeat."
    try:
        response = ai(text)
    except:
        print("Could not get response from OpenAI.")
    return response


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/transcribe", methods=["POST"])
def transcribe():
    file = request.files["recording"]
    if file and allowed_file(file.filename):
        with tempfile.NamedTemporaryFile(
            suffix=".webm", delete=False
        ) as temp_record_file:
            temp_record_file_name = temp_record_file.name

        file.save(temp_record_file_name)

        with open(temp_record_file_name, "rb") as audio_file:
            transcript = openai.Audio.transcribe("whisper-1", audio_file)

        os.remove(temp_record_file_name)

        ai_response = text_to_ai(transcript["text"])

        response = client.synthesize_speech(
            Engine="standard",
            OutputFormat="mp3",
            Text=ai_response,
            VoiceId="Joanna",
        )

        try:
            with tempfile.NamedTemporaryFile(
                suffix=".mp3", delete=False
            ) as temp_audio_file:
                temp_audio_file.write(response["AudioStream"].read())
                temp_audio_file_path = temp_audio_file.name

            return send_file(
                temp_audio_file_path, mimetype="audio/mpeg", as_attachment=True
            )
        finally:
            os.remove(temp_audio_file_path)
