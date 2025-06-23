const URL = "https://teachablemachine.withgoogle.com/models/KVmuLsMMu/";

let model, webcam, labelContainer, maxPredictions;
let isIos = false;
let webcamRunning = false;
let webcamInitialized = false;
let loopId = null;

let port;
let writer;
let medicamentos = [];

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

document.addEventListener("DOMContentLoaded", () => {
  const botaoConectar = document.getElementById("btn-conectar-arduino");
  if (botaoConectar) {
    botaoConectar.addEventListener("click", conectarArduino);
  } else {
    console.warn("Botão de conectar Arduino não encontrado no DOM.");
  }
});



// Evento que executa quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("schedule-form");
  const medNameInput = document.getElementById("med-name");
  const medTimeInput = document.getElementById("med-time");
  const scheduleList = document.getElementById("schedule-list");

  // Carrega do localStorage
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
    console.log("guardarMedicamentos is being executed.");
  }


guardarMedicamentos(); // Now this call will work

  function adicionarMedicamentoNaLista(name, time, alerted = false) {
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

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = medNameInput.value.trim();
    const time = medTimeInput.value;

    if (!name || !time) return;

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

  // Alerta + comando Arduino
  setInterval(async () => {
    const agora = new Date();
    const horaAtual =
      agora.getHours().toString().padStart(2, "0") +
      ":" +
      agora.getMinutes().toString().padStart(2, "0");

    for (const med of medicamentos) {
      if (med.time === horaAtual && !med.alerted) {
        const alertSound = document.getElementById("alert-sound");
        if (alertSound) alertSound.play().catch(console.error);

        alert(`⏰ Está na hora de tomar: ${med.name}`);
        await enviarComandoArduino("ABRIR");
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

  carregarMedicamentos();

    document.getElementById("btn-conectar-arduino").addEventListener("click", conectarArduino);
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

// ========== COMUNICAÇÃO COM ARDUINO VIA WEB SERIAL ========== //

// async function conectarArduino() {
//   try {
//     const port = await navigator.serial.requestPort();
//     await port.open({ baudRate: 9600 });

//     const encoder = new TextEncoderStream();
//     encoder.readable.pipeTo(port.writable);
//     writer = encoder.writable.getWriter();

//     alert("✅ Arduino conectado!");
//   } catch (err) {
//     alert("❌ Erro ao conectar: " + err);
//     console.error(err);
//   }
// }

// async function conectarArduino() {
//   try {
//     const port = await navigator.serial.requestPort();
//     await port.open({ baudRate: 9600 });
//     // resto da lógica
//   } catch (err) {
//     if (err.name === "NotFoundError") {
//       console.warn("Nenhuma porta foi selecionada.");
//     } else {
//       console.error("Erro ao conectar no Arduino:", err);
//     }
//   }
// }

async function conectarArduino() {
  try {
    if (port && port.readable) {
      // Check if a port exists and is readable (implies it's open)
      console.warn("A porta serial já está aberta.");
      return; // Exit the function if the port is already open
    }

    port = await navigator.serial.requestPort(); // Request the port only if not already open
    await port.open({ baudRate: 9600 });
    // resto da lógica
  } catch (err) {
    if (err.name === "NotFoundError") {
      console.warn("Nenhuma porta foi selecionada.");
    } else {
      console.error("Erro ao conectar no Arduino:", err);
    }
  }
}

// async function desconectarArduino() {
//   if (writer) {
//     await writer.close();
//     writer = null;
//     alert("✅ Arduino desconectado!");
//   } else {
//     alert("⚠️ Arduino não conectado.");
//   }
// }

async function desconectarArduino() {
  if (port && port.readable) { // Check if port exists and is readable before closing
    const reader = port.readable.getReader();
    if (reader) {
      await reader.cancel(); // Cancel any ongoing read operations
      reader.releaseLock();
    }
    if (writer) {
      await writer.close();
      writer = null;
    }
    await port.close();
    port = null; // Set port to null after closing
    alert("✅ Arduino desconectado!");
  } else {
    alert("⚠️ Arduino não conectado.");
  }
}

// async function enviarComandoArduino(comando) {
//   if (writer) {
//     try {
//       await writer.write(comando + "\n");
//       console.log("Comando enviado:", comando);
//     } catch (e) {
//       console.error("Erro ao enviar:", e);
//     }
//   } else {
//     console.warn("⚠️ Arduino não conectado.");
//   }
// }

async function enviarComandoArduino(comando) {
  if (port && port.writable) { // Check if port is open and writable
    try {
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
      writer = textEncoder.writable.getWriter();

      await writer.write(comando + "\n");
      console.log("Comando enviado:", comando);

      // It's often better to keep the writer open if you'll be sending multiple commands.
      // Close it only when disconnecting.
      // await writer.close();
      // await writableStreamClosed;

    } catch (e) {
      console.error("Erro ao enviar:", e);
    }
  } else {
    console.warn("⚠️ Arduino não conectado ou porta não aberta.");
  }
}

// ========== BOTÃO DE CONEXÃO ========== //
document.addEventListener("DOMContentLoaded", function () {
    const botaoConectar = document.getElementById("btn-conectar-arduino");
        if (botaoConectar) {
            botaoConectar.onclick = conectarArduino;
        } else {
            console.warn("Botão de conectar Arduino não encontrado no DOM.");
        }

    const botaoAbrir = document.getElementById("btn-abrir-manual");
        if (botaoAbrir) {
            botaoAbrir.onclick = () => enviarComandoArduino("ABRIR");
        }
            
    const botaoFechar = document.getElementById("btn-fechar-manual");
        if (botaoFechar) {
            botaoFechar.onclick = () => enviarComandoArduino("FECHAR");
        }

    botaoConectar.textContent = "🔌 Ligar Arduino";
    botaoConectar.style.marginTop = "10px";
    botaoConectar.style.padding = "10px";
    botaoConectar.style.cursor = "pointer";
    botaoConectar.onclick = conectarArduino;

    document.body.appendChild(botaoConectar);

    console.log("Botão Ligar Arduino criado e adicionado ao DOM.");
});

// Modifica apenas a parte do alerta para também enviar comando ao Arduino //
setInterval(async () => {
    const agora = new Date();
    const horaAtual = agora.getHours().toString().padStart(2, "0") + ":" + agora.getMinutes().toString().padStart(2, "0");

    for (const med of medicamentos) {
        if (med.time === horaAtual && !med.alerted) {
            const alertSound = document.getElementById("alert-sound");
            if (alertSound) {
                alertSound.play().catch(error => {
                    console.error("Erro ao tocar som:", error);
                });
            }

            alert(`⏰ Está na hora de tomar o medicamento: ${med.name}`);

            // Envia comando para o Arduino abrir a tampa e aguarda o envio
            await enviarComandoArduino("ABRIR");

            med.alerted = true;
            guardarMedicamentos();
        }
    }

    // const items = scheduleList.querySelectorAll("li");
    // items.forEach((li) => {
    //     const texto = li.firstChild.textContent || "";
    //     const partes = texto.split(" - ");
    //     if (partes.length === 2) {
    //         const time = partes[1].trim();
    //         atualizarClasseHorario(li, time);
    //     }
    // });
}, 1000);


const scheduleList = document.getElementById("schedule-list");

if (scheduleList) {
    const items = scheduleList.querySelectorAll("li");
    items.forEach((li) => {
        const texto = li.firstChild.textContent || "";
        const partes = texto.split(" - ");
        if (partes.length === 2) {
            const time = partes[1].trim();
            atualizarClasseHorario(li, time);
        }
    });
} else {
    console.error("Elemento 'schedule-list' não encontrado no DOM.");
}
