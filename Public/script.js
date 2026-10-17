const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let cameraStream = null;
let processingOCR = false;
let submittingEntry = false;

// Start the camera.
async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access is not supported by this browser.");
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });

    video.srcObject = cameraStream;
  } catch (error) {
    console.error("Camera error:", error);
    showMessage(
      "Camera unavailable. Allow camera permission or enter the number manually.",
      true,
    );
  }
}

startCamera();

function showMessage(message, isError = false) {
  const element = document.getElementById("entryMessage");
  element.textContent = message;
  element.className = isError ? "message error" : "message success";
}

// Capture a photo and recognize the plate locally.
async function capturePhoto() {
  if (processingOCR) return;

  if (!video.videoWidth || !video.videoHeight) {
    showMessage(
      "Camera is not ready. Please wait or enter the plate manually.",
      true,
    );
    return;
  }

  processingOCR = true;
  const captureButton = document.getElementById("captureButton");
  captureButton.disabled = true;

  try {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.filter = "grayscale(100%) contrast(180%)";
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.filter = "none";

    document.getElementById("detectedNumber").textContent = "Recognizing...";

    const result = await Tesseract.recognize(canvas, "eng", {
      logger: (info) => {
        if (info.status === "recognizing text") {
          document.getElementById("detectedNumber").textContent =
            `Recognizing: ${Math.round((info.progress || 0) * 100)}%`;
        }
      },
    });

    const detectedText = formatNumberPlate(result.data.text);

    document.getElementById("numberPlate").value =
      detectedText === "Invalid Plate" ? "" : detectedText;

    document.getElementById("detectedNumber").textContent = detectedText;

    if (detectedText === "Invalid Plate") {
      showMessage(
        "Could not confidently read a valid plate. Please enter it manually.",
        true,
      );
    } else {
      showMessage("Number plate recognized. Check it before continuing.");
    }
  } catch (error) {
    console.error("OCR error:", error);
    document.getElementById("detectedNumber").textContent = "OCR failed";
    showMessage("Number recognition failed. Enter the plate manually.", true);
  } finally {
    processingOCR = false;
    captureButton.disabled = false;
  }
}

// Basic Indian vehicle registration formats.
// These patterns do not cover every special registration format.
function formatNumberPlate(text) {
  const cleaned = String(text || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  const patterns = [
    /^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/,
    /^[A-Z]{2}\d{2}[A-Z]\d{4}$/,
    /^[A-Z]{3}\d{4}$/,
  ];

  return patterns.some((pattern) => pattern.test(cleaned))
    ? cleaned
    : "Invalid Plate";
}

// Validate the fields and show the Resident/Visitor popup.
function verifyCar() {
  const numberInput = document.getElementById("numberPlate");
  const phoneInput = document.getElementById("phone");

  const carNumber = numberInput.value
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  const phone = phoneInput.value.trim();
  const normalizedPhone = phone.replace(/[\s-]/g, "");

  if (!/^(?:\+91)?[6-9]\d{9}$/.test(normalizedPhone)) {
    showMessage("Enter a valid Indian mobile number.", true);
    return;
  }

  if (!isValidPlate(carNumber)) {
    showMessage("Enter a valid vehicle number plate.", true);
    return;
  }

  numberInput.value = carNumber;
  phoneInput.value = normalizedPhone;

  document.getElementById("popupCarNumber").textContent = carNumber;
  document.getElementById("popupModal").style.display = "flex";
}

function isValidPlate(number) {
  return [
    /^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/,
    /^[A-Z]{2}\d{2}[A-Z]\d{4}$/,
    /^[A-Z]{3}\d{4}$/,
  ].some((pattern) => pattern.test(number));
}

function closeEntryModal() {
  document.getElementById("popupModal").style.display = "none";
}

// Resident selection.
async function grantAccess() {
  await submitEntry(true);
}

// Visitor selection.
async function redirectToParking() {
  await submitEntry(false, true);
}

// Send the entry to Express. Express allocates the slot and saves it in MongoDB.
async function submitEntry(isResident, goToParking = false) {
  if (submittingEntry) return;

  submittingEntry = true;

  const buttons = document.querySelectorAll("#popupModal button");
  buttons.forEach((button) => {
    button.disabled = true;
  });

  const carNumber = document.getElementById("numberPlate").value.trim();
  const phone = document.getElementById("phone").value.trim();

  try {
    const response = await fetch("/api/parking/entry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        carNumber,
        phone,
        isResident,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not register the vehicle.");
    }

    closeEntryModal();

    showMessage(
      `${data.message} Allocated slot: ${data.record.slotNumber}.` +
        (data.smsStatus === "submitted"
          ? " SMS request submitted."
          : data.smsStatus === "failed"
            ? " SMS could not be submitted."
            : ""),
    );

    if (goToParking) {
      window.location.href = "parking.html";
    }
  } catch (error) {
    console.error("Entry error:", error);
    showMessage(error.message || "Server connection failed.", true);
  } finally {
    submittingEntry = false;
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

// Stop the camera when the page is closed.
window.addEventListener("pagehide", () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
  }
});
