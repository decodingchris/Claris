const feedbackButton = document.getElementById("feedbackButton");
const resetButton = document.getElementById("resetButton");
const feedbackAnchor = document.getElementById("feedbackAnchor");
const progressMessage = document.getElementById("progressMessage");
const convoStatus = document.getElementById("convoStatus");

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
  console.log("Reset Pressed: ", conversation);
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
      progressMessage.innerText = "Getting response...";

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
          console.log("Error: transcribe response not ok");
        }
      } catch (error) {
        console.log("Error: transcribe - ", error);
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
            console.log("Error: synthesize response not ok");
          }
        } catch (error) {
          console.log("Error: synthesize - ", error);
        }
      }
      progressMessage.innerText = "";
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
    progressMessage.innerText = "Getting feedback...";
    const feedbackFormData = new FormData();
    feedbackFormData.append("conversation", JSON.stringify(conversation));
    try {
      const feedback_response = await fetch("/feedback", {
        method: "POST",
        body: feedbackFormData,
      });
      if (feedback_response.ok) {
        const feedback_data = await feedback_response.text();

        const feedbackBlob = new Blob([feedback_data], { type: "text/plain" });
        feedbackAnchor.href = URL.createObjectURL(feedbackBlob);
        feedbackAnchor.innerText = "Download Feedback";
        feedbackAnchor.download = "feedback.txt";

        const textFormData = new FormData();
        textFormData.append("ai_response", feedback_data);
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
            console.log("Error: synthesize response not ok");
          }
        } catch (error) {
          console.log("Error: synthesize - ", error);
        }
      } else {
        console.log("Error: feedback response not ok");
      }
    } catch (error) {
      console.log("Error: feedback - ", error);
    }
    progressMessage.innerText = "";
  }
}
