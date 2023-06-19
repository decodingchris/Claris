import os
import tempfile

import openai

from dotenv import load_dotenv
from flask import Flask, render_template, request

load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")

app = Flask(__name__)


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        file = request.files["recording"]

        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_file:
            temp_file_name = temp_file.name

        file.save(temp_file_name)

        with open(temp_file_name, "rb") as audio_file:
            transcript = openai.Audio.transcribe("whisper-1", audio_file)

        file.close()
        os.remove(temp_file_name)
        print(transcript["text"])
    return render_template("index.html")
