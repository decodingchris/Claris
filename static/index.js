const feedbackButton = document.getElementById("feedbackButton");
const resetButton = document.getElementById("resetButton");
const feedbackAnchor = document.getElementById("feedbackAnchor");
const errorPlaceholder = document.getElementById("errorPlaceholder");
const progressPlaceholder = document.getElementById("progressPlaceholder");
const convoStatus = document.getElementById("convoStatus");
const errorMessage = "Oops! Something went wrong. Please try again.";
const audio = document.getElementById("aiResponse");

let conversation = JSON.parse(localStorage.getItem("conversation")) || [];

if (Array.isArray(conversation) && conversation.length === 0) {
  feedbackButton.disabled = true;
  resetButton.disabled = true;
  convoStatus.innerText = "Empty";
} else {
  convoStatus.innerText = "Not Empty";
}

function reset() {
  localStorage.removeItem("conversation");
  conversation = [];
  convoStatus.innerText = "Empty";
  feedbackButton.disabled = true;
  resetButton.disabled = true;
}

async function record() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    const recordButton = document.getElementById("recordButton");
    const stopButton = document.getElementById("stopButton");

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
          feedbackButton.disabled = false;
          resetButton.disabled = false;
          convoStatus.innerText = "Not Empty";
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
    console.log("Error: record - ", err);
  }
}

async function feedback() {
  if (conversation.length !== 0) {
    progressPlaceholder.innerText = "Getting feedback...";

    // feedback
    const feedbackFormData = new FormData();
    feedbackFormData.append("conversation", JSON.stringify(conversation));
    try {
      const feedback_response = await fetch("/feedback", {
        method: "POST",
        body: feedbackFormData,
      });
      if (feedback_response.ok) {
        const feedback_data = await feedback_response.text();
        const convoMapped = conversation.map((convo) => {
          const key = Object.keys(convo)[0];
          const value = convo[key];
          return `${key}: ${value}`;
        });
        convoMapped.unshift("Conversation:\n");
        convoMapped.push("\nFeedback:\n\n");
        const convoJoined = convoMapped.join("\n");
        const detailed_feedback = convoJoined + feedback_data;
        const feedbackBlob = new Blob([detailed_feedback], {
          type: "text/plain",
        });
        feedbackAnchor.href = URL.createObjectURL(feedbackBlob);
        feedbackAnchor.innerText = "Download Feedback";
        feedbackAnchor.download = "feedback.txt";
        const textFormData = new FormData();
        textFormData.append("ai_response", feedback_data);

        // synthesize
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
      } else {
        const feedbackError = (await feedback_response.text()).toLowerCase();
        if (feedbackError.includes("memory")) {
          errorPlaceholder.innerHTML =
            "Oops! The AI's memory is full, reset the conversation to clear its memory.";
        } else {
          errorPlaceholder.innerHTML = errorMessage;
        }
      }
    } catch (error) {
      errorPlaceholder.innerHTML = errorMessage;
    }
    progressPlaceholder.innerText = "";
  }
}
