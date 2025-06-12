const URL = "https://teachablemachine.withgoogle.com/models/KVmuLsMMu/";

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

document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("schedule-form");
    const medNameInput = document.getElementById("med-name");
    const medTimeInput = document.getElementById("med-time");
    const scheduleList = document.getElementById("schedule-list");

    let medicamentos = [];

    function carregarMedicamentos() {
        const dados = localStorage.getItem("medicamentos");
        if (dados) {
            medicamentos = JSON.parse(dados);
            medicamentos.forEach((med) => {
                adicionarMedicamentoNaLista(med.name, med.time, med.alerted);
            });
        }
    }

    function guardarMedicamentos() {
        localStorage.setItem("medicamentos", JSON.stringify(medicamentos));
    }

    function adicionarMedicamentoNaLista(name, time, alerted = false) {
        const li = document.createElement("li");
        li.textContent = `${name} - ${time}`;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remover";
        removeBtn.className = "remove-button";
        removeBtn.onclick = () => {
            scheduleList.removeChild(li);
            medicamentos = medicamentos.filter((m) => !(m.name === name && m.time === time));
            guardarMedicamentos();
        };

        li.appendChild(removeBtn);
        scheduleList.appendChild(li);

        atualizarClasseHorario(li, time);
    }

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const name = medNameInput.value.trim();
        const time = medTimeInput.value;

        if (!name || !time) return;

        const [hour, minute] = time.split(":").map(Number);
        const agora = new Date();
        const horaMedicamento = new Date();
        horaMedicamento.setHours(hour, minute, 0, 0);

        if (horaMedicamento.getTime() < agora.getTime()) {
            const confirmacao = await showCustomConfirm(
                "⚠️ Atenção: A hora deste medicamento já passou hoje. Deseja adicioná-lo mesmo assim?"
            );
            if (!confirmacao) return;
        }

        medicamentos.push({ name, time, alerted: false });

        medicamentos.sort((a, b) => a.time.localeCompare(b.time));
        guardarMedicamentos();

        scheduleList.innerHTML = "";
        medicamentos.forEach((med) => {
            adicionarMedicamentoNaLista(med.name, med.time, med.alerted);
        });

        medNameInput.value = "";
        medTimeInput.value = "";
    });

    function atualizarClasseHorario(li, time) {
        const [hour, minute] = time.split(":").map(Number);
        const agora = new Date();
        const horaMedicamento = new Date();
        horaMedicamento.setHours(hour, minute, 0, 0);

        const agoraMs = agora.getTime();
        const medMs = horaMedicamento.getTime();

        li.classList.remove("medicamento-futuro", "medicamento-passado", "medicamento-agora");

        if (medMs > agoraMs) {
            li.classList.add("medicamento-futuro");
        } else if (medMs < agoraMs) {
            li.classList.add("medicamento-passado");
        } else {
            li.classList.add("medicamento-agora");
        }
    }

    setInterval(() => {
        const agora = new Date();
        const horaAtual = agora.getHours().toString().padStart(2, "0") + ":" + agora.getMinutes().toString().padStart(2, "0");

        medicamentos.forEach((med) => {
            if (med.time === horaAtual && !med.alerted) {
                const alertSound = document.getElementById("alert-sound");
                if (alertSound) {
                    alertSound.play().catch(error => {
                        console.error("Erro ao tocar som:", error);
                    });
                }

                alert(`⏰ Está na hora de tomar o medicamento: ${med.name}`);
                med.alerted = true;
                guardarMedicamentos();
            }
        });

        const items = scheduleList.querySelectorAll("li");
        items.forEach((li) => {
            const texto = li.firstChild.textContent || "";
            const partes = texto.split(" - ");
            if (partes.length === 2) {
                const time = partes[1].trim();
                atualizarClasseHorario(li, time);
            }
        });
    }, 1000);

    document.addEventListener("click", () => {
        const alertSound = document.getElementById("alert-sound");
        if (alertSound) {
            alertSound.play().then(() => alertSound.pause());
        }
    }, { once: true });

    carregarMedicamentos();
});

function showCustomConfirm(mensagem) {
    return new Promise((resolve) => {
        let modal = document.getElementById("confirm-modal");

        if (!modal) {
            modal = document.createElement("div");
            modal.id = "confirm-modal";
            modal.style.position = "fixed";
            modal.style.top = "0";
            modal.style.left = "0";
            modal.style.width = "100%";
            modal.style.height = "100%";
            modal.style.backgroundColor = "rgba(0,0,0,0.6)";
            modal.style.display = "flex";
            modal.style.alignItems = "center";
            modal.style.justifyContent = "center";
            modal.style.zIndex = "9999";

            modal.innerHTML = `
              <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; max-width: 400px; width: 90%;">
                <p id="modal-message" style="margin-bottom: 20px; font-weight: bold;"></p>
                <button id="modal-yes" style="margin: 0 10px; padding: 10px 20px;">SIM</button>
                <button id="modal-no" style="margin: 0 10px; padding: 10px 20px;">NÃO</button>
              </div>
            `;
            document.body.appendChild(modal);
        }

        const messageEl = document.getElementById("modal-message");
        const btnSim = document.getElementById("modal-yes");
        const btnNao = document.getElementById("modal-no");

        messageEl.textContent = mensagem;
        modal.style.display = "flex";

        btnSim.onclick = () => {
            modal.style.display = "none";
            resolve(true);
        };

        btnNao.onclick = () => {
            modal.style.display = "none";
            resolve(false);
        };
    });
}