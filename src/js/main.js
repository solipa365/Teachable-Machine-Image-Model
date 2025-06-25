const URL = "https://teachablemachine.withgoogle.com/models/KVmuLsMMu/";

let model, webcam, labelContainer, maxPredictions;
let isIos = false;
let webcamRunning = false;
let webcamInitialized = false;
let loopId = null;

let port;
let writer;  // manter writer aberto para reutilizar
let medicamentos = [];

if (
  window.navigator.userAgent.indexOf("iPhone") > -1 ||
  window.navigator.userAgent.indexOf("iPad") > -1
) {
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
    webCamVideo.muted = true;
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

// Funções para salvar e carregar medicamentos do localStorage
function carregarMedicamentos() {
  const dados = localStorage.getItem("medicamentos");
  if (dados) {
    try {
      medicamentos = JSON.parse(dados);
      medicamentos.forEach((med) => {
        adicionarMedicamentoNaLista(med.name, med.time, med.alerted);
      });
    } catch (e) {
      console.error("Erro ao carregar medicamentos do localStorage:", e);
      localStorage.removeItem("medicamentos");
    }
  }
}

function guardarMedicamentos() {
  try {
    localStorage.setItem("medicamentos", JSON.stringify(medicamentos));
  } catch (error) {
    console.error("Erro ao salvar medicamentos:", error);
  }
}

function adicionarMedicamentoNaLista(name, time, alerted = false) {
  const scheduleList = document.getElementById("schedule-list");

  const li = document.createElement("li");
  li.textContent = `${name} - ${time}`;

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "Remover";
  removeBtn.onclick = () => {
    scheduleList.removeChild(li);
    medicamentos = medicamentos.filter(
      (m) => !(m.name === name && m.time === time)
    );
    guardarMedicamentos();
  };

  li.appendChild(removeBtn);
  scheduleList.appendChild(li);
  atualizarClasseHorario(li, time);
}

// Atualiza as classes dos horários para estilo visual
function atualizarClasseHorario(li, time) {
  const [hour, minute] = time.split(":").map(Number);
  const agora = new Date();
  const horaMedicamento = new Date();
  horaMedicamento.setHours(hour, minute, 0, 0);

  li.classList.remove(
    "medicamento-futuro",
    "medicamento-passado",
    "medicamento-agora"
  );

  const agoraMs = agora.getTime();
  const medMs = horaMedicamento.getTime();

  if (medMs > agoraMs) {
    li.classList.add("medicamento-futuro");
  } else if (medMs < agoraMs) {
    li.classList.add("medicamento-passado");
  } else {
    li.classList.add("medicamento-agora");
  }
}

// === Ações do formulário e agendamento ===

document.addEventListener("DOMContentLoaded", () => {
  carregarMedicamentos();

  const form = document.getElementById("schedule-form");
  const medNameInput = document.getElementById("med-name");
  const medTimeInput = document.getElementById("med-time");
  const scheduleList = document.getElementById("schedule-list");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = medNameInput.value.trim();
    const time = medTimeInput.value;

    if (!name || !time) return;

    const duplicado = medicamentos.find(
      (m) => m.name === name && m.time === time
    );
    if (duplicado) {
      alert("Este medicamento já está agendado para esse horário.");
      return;
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

    await enviarListaMedicamentosParaArduino();
  });

  // Enviar a hora atual para o Arduino a cada minuto para sincronizar relógio
  setInterval(() => {
    if (port && writer) {
      const agora = new Date();
      const hora = String(agora.getHours()).padStart(2, "0");
      const minuto = String(agora.getMinutes()).padStart(2, "0");
      const comandoHora = `HORA|${hora}:${minuto}\n`;
      writer.write(comandoHora).catch((err) => {
        console.error("Erro ao enviar hora para Arduino:", err);
      });
    }
  }, 60000);

  // Intervalo para checar horário e enviar alertas
  setInterval(async () => {
    const agora = new Date();
    const horaAtual =
      agora.getHours().toString().padStart(2, "0") +
      ":" +
      agora.getMinutes().toString().padStart(2, "0");

    for (const med of medicamentos) {
      if (med.time === horaAtual && !med.alerted) {
        const alertSound = document.getElementById("alert-sound");
        if (alertSound) {
          alertSound.play().catch((error) => {
            console.error("Erro ao tocar som:", error);
          });
        }

        alert(`⏰ Está na hora de tomar o medicamento: ${med.name}`);

        await enviarComandoArduino("ABRIR");

        setTimeout(() => {
          enviarComandoArduino("FECHAR");
          console.log(
            "⏳ Comando 'FECHAR' enviado automaticamente após 1 minuto."
          );
        }, 60000);

        med.alerted = true;
        guardarMedicamentos();
      }
    }

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

  const botaoConectar = document.getElementById("btn-conectar-arduino");
  if (botaoConectar) {
    botaoConectar.onclick = conectarArduino;
  }

  const botaoAbrir = document.getElementById("btn-abrir-manual");
  if (botaoAbrir) {
    botaoAbrir.onclick = () => enviarComandoArduino("ABRIR");
  }

  const botaoFechar = document.getElementById("btn-fechar-manual");
  if (botaoFechar) {
    botaoFechar.onclick = () => enviarComandoArduino("FECHAR");
  }
});

// Comunicação com Arduino via Web Serial API

async function conectarArduino() {
  try {
    if (port && port.readable) {
      console.warn("A porta serial já está aberta.");
      return;
    }

    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    // Cria TextEncoderStream e writer para reutilizar
    const textEncoder = new TextEncoderStream();
    const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
    writer = textEncoder.writable.getWriter();

    await enviarListaMedicamentosParaArduino();

    alert("✅ Arduino conectado!");
  } catch (err) {
    if (err.name === "NotFoundError") {
      console.warn("Nenhuma porta foi selecionada.");
    } else {
      console.error("Erro ao conectar no Arduino:", err);
    }
  }
}

async function enviarComandoArduino(comando) {
  if (writer) {
    try {
      await writer.write(comando + "\n");
    } catch (err) {
      console.error("Erro ao enviar comando para Arduino:", err);
    }
  } else {
    console.warn("Porta serial não está aberta.");
  }
}

async function enviarListaMedicamentosParaArduino() {
  if (!writer) {
    console.warn("Porta serial não está aberta, não pode enviar dados.");
    return;
  }

  try {
    for (const med of medicamentos) {
      // Formato ajustado para o protocolo Arduino: MED|HH:MM|nome
      const comando = `MED|${med.time}|${med.name}\n`;
      await writer.write(comando);
    }
    console.log("Lista de medicamentos enviada para Arduino.");
  } catch (err) {
    console.error("Erro ao enviar lista para Arduino:", err);
  }
}
