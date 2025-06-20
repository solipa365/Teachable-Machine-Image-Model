#include <Servo.h>

// === CONFIGURAÇÕES GERAIS === //
Servo servo;
String comando = "";
const int pinoServo = 9;
const int anguloAberto = 90;
const int anguloFechado = 0;
const int tempoAberto = 2000;
const int pinoLED = 13;

// === VARIÁVEL PARA CONTROLE SIMPLES DE DEBOUNCE === //
unsigned long ultimaAcao = 0;
const unsigned long intervaloDebounce = 3000;

void setup() {
  Serial.begin(9600);
  servo.attach(pinoServo);
  servo.write(anguloFechado);

  pinMode(pinoLED, OUTPUT);
  digitalWrite(pinoLED, LOW);

  Serial.println("🔧 Sistema iniciado e pronto para comandos.");
}

void loop() {
  if (Serial.available()) {
    String recebido = Serial.readStringUntil('\n');
    recebido.trim();
    Serial.print("Recebido do PC: ");
    Serial.println(recebido);
    processarComando(recebido);
  }
}

// === TRATAMENTO DE COMANDOS === //
void processarComando(String cmd) {
  cmd.trim();
  int sep = cmd.indexOf(',');
  if (sep != -1) {
    String nome = cmd.substring(0, sep);
    String hora = cmd.substring(sep + 1);
    
    Serial.print("Recebido medicamento: ");
    Serial.println(nome);
    Serial.print("Horário: ");
    Serial.println(hora);

    // Aqui você pode abrir a tampa, ligar LED, etc.
    abrirTampa();
  } else if (cmd == "ABRIR") {
    abrirTampa();
  } else if (cmd == "FECHAR") {
    fecharTampa();
  } else {
    Serial.println("Comando inválido: " + cmd);
  }
}

// === ABRIR TAMPA COM EFEITO VISUAL === //
void abrirTampa() {
  Serial.println("🔓 Abrindo tampa...");
  piscarLED(3);
  servo.write(anguloAberto);
  delay(tempoAberto);
  fecharTampa();
}

// === FECHAR TAMPA === //
void fecharTampa() {
  Serial.println("🔒 Fechando tampa...");
  servo.write(anguloFechado);
  digitalWrite(pinoLED, LOW);
}

// === FUNÇÃO PARA PISCAR O LED VISUALMENTE === //
void piscarLED(int vezes) {
  for (int i = 0; i < vezes; i++) {
    digitalWrite(pinoLED, HIGH);
    delay(200);
    digitalWrite(pinoLED, LOW);
    delay(200);
  }
}
