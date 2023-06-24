const recordButton = document.getElementById("recordButton");
const resetButton = document.getElementById("resetButton");
const stopButton = document.getElementById("stopButton");

const errorPlaceholder = document.getElementById("errorPlaceholder");
const progressPlaceholder = document.getElementById("progressPlaceholder");
const downloadPlaceholder = document.getElementById("downloadPlaceholder");

const audio = document.getElementById("clarisResponse");
const downloadAnchor = document.getElementById("downloadAnchor");
const errorMessage = "Oops! Something went wrong. Please try again.";

let conversation = JSON.parse(localStorage.getItem("conversation")) || [];

function download() {
  const convoMapped = conversation.map((convo) => {
    const key = Object.keys(convo)[0];
    const value = convo[key];
    return `${key}: ${value}`;
  });
  const convoJoined = convoMapped.join("\n");
  const downloadBlob = new Blob([convoJoined], {
    type: "text/plain",
  });
  downloadAnchor.href = URL.createObjectURL(downloadBlob);
  downloadAnchor.innerText = "conversation.txt";
  downloadAnchor.download = "conversation.txt";
  downloadPlaceholder.innerText = "";
}

if (Array.isArray(conversation) && conversation.length === 0) {
  resetButton.disabled = true;
  downloadAnchor.innerText = "";
  downloadPlaceholder.innerText = "No previous conversation.";
} else {
  download();
}

async function reset() {
  try {
    const resetResponse = await fetch("/reset", {
      method: "GET",
    });
    if (resetResponse.ok) {
      localStorage.removeItem("conversation");
      conversation = [];
      resetButton.disabled = true;
      downloadAnchor.innerText = "";
      downloadPlaceholder.innerText = "No previous conversation.";
    } else {
      errorPlaceholder.innerHTML = errorMessage;
    }
  } catch (err) {
    errorPlaceholder.innerHTML = errorMessage;
  }
}

async function record() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = async (e) => {
      recordButton.disabled = false;
      let data = [];
      progressPlaceholder.innerText = "Getting response...";

      // transcribe
      const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" });
      const formData = new FormData();
      formData.append("recording", blob, `recording.webm`);
      try {
        const response = await fetch("/transcribe", {
          method: "POST",
          body: formData,
        });
        if (response.ok) {
          data = await response.json();
          conversation.push(data[0]);
          conversation.push(data[1]);
          localStorage.setItem("conversation", JSON.stringify(conversation));
          download();
          resetButton.disabled = false;
        } else {
          const transcribeError = (await response.text()).toLowerCase();
          if (transcribeError.includes("memory")) {
            errorPlaceholder.innerHTML =
              "Oops! The AI's memory is full, reset the conversation to clear its memory.";
          } else {
            errorPlaceholder.innerHTML = errorMessage;
          }
        }
      } catch (error) {
        errorPlaceholder.innerHTML = errorMessage;
      }

      // synthesize
      if (data.length > 0) {
        const textFormData = new FormData();
        const aiKey = Object.keys(data[1])[0];
        textFormData.append("ai_response", data[1][aiKey]);
        try {
          const speech_response = await fetch("/synthesize", {
            method: "POST",
            body: textFormData,
          });
          if (speech_response.ok) {
            const response_blob = await speech_response.blob();
            const audioUrl = URL.createObjectURL(response_blob);
            audio.src = audioUrl;
            audio.play();
          } else {
            errorPlaceholder.innerHTML = errorMessage;
          }
        } catch (error) {
          errorPlaceholder.innerHTML = errorMessage;
        }
      }
      progressPlaceholder.innerText = "";
    };

    stopButton.addEventListener("click", function () {
      mediaRecorder.stop();
      stream.getAudioTracks().forEach((track) => track.stop());
    });

    mediaRecorder.start();
    recordButton.disabled = true;
    audio.pause();
  } catch (err) {
    errorPlaceholder.innerHTML =
      "Microphone access denied. Please allow microphone access to use SimTalk.";
  }
}
