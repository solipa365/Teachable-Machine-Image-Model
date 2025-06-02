const URL = "https://teachablemachine.withgoogle.com/models/7qa_BQ6c5/";

let model, webcam, labelContainer, maxPredictions;
let isIos = false;
let webcamRunning = false;
let webcamInitialized = false;
let loopId = null;

if (window.navigator.userAgent.indexOf("iPhone") > -1 || window.navigator.userAgent.indexOf("iPad") > -1) {
    isIos = true;
}

async function init() {

    if (webcamRunning) {
        stopWebcam();
    } else {
        await startWebcam();
    }
}

async function startWebcam() {
    if (!webcamInitialized) {
        const modelURL = URL + "model.json";
        const metadataURL = URL + "metadata.json";

        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();

        const flip = true;
        const width = 200;
        const height = 200;
        webcam = new tmImage.Webcam(width, height, flip);
        await webcam.setup();
        webcamInitialized = true;
    }

    const container = document.getElementById("webcam-container");
    container.innerHTML = "";

    if (isIos) {
        container.appendChild(webcam.webcam);
        const webCamVideo = document.getElementsByTagName("video")[0];
        webCamVideo.setAttribute("playsinline", true);
        webCamVideo.muted = "true";
        webCamVideo.style.width = webcam.width + "px";
        webCamVideo.style.height = webcam.height + "px";
    } else {
        container.appendChild(webcam.canvas);
    }

    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
    for (let i = 0; i < maxPredictions; i++) {
        labelContainer.appendChild(document.createElement("div"));
    }

    webcam.play();
    webcamRunning = true;
    document.getElementById("start-button").innerText = "Stop";

    loopId = window.requestAnimationFrame(loop);
}

function stopWebcam() {
    webcam.pause();
    webcamRunning = false;
    cancelAnimationFrame(loopId);
    clearLabels();
    document.getElementById("start-button").innerText = "Start";

    const container = document.getElementById("webcam-container");
    container.innerHTML = "";
}

function clearLabels() {
    if (labelContainer) {
        labelContainer.innerHTML = "";
    }
}

async function loop() {
    webcam.update();
    await predict();
    loopId = window.requestAnimationFrame(loop);
}

async function predict() {
    let prediction;
    if (isIos) {
        prediction = await model.predict(webcam.webcam);
    } else {
        prediction = await model.predict(webcam.canvas);
    }

    for (let i = 0; i < maxPredictions; i++) {
        const classPrediction =
            prediction[i].className + ": " + prediction[i].probability.toFixed(2);
        labelContainer.childNodes[i].innerHTML = classPrediction;
    }
}