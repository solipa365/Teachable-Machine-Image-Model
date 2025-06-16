#include <Servo.h>

Servo servo;
String comando = "";
const int pinoServo = 9;
const int anguloAberto = 90;
const int anguloFechado = 0;
const int tempoAberto = 2000;
const int pinoLED = 13;

void setup() {
  Serial.begin(9600);
  servo.attach(pinoServo);
  servo.write(anguloFechado);

  pinMode(pinoLED, OUTPUT);
  digitalWrite(pinoLED, LOW);
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();

    if (c == '\n') {
      comando.trim();
      if (comando == "ABRIR") {
        abrirTampa();
      } else {
        Serial.println("Comando desconhecido: " + comando);
      }
      comando = "";
    } else {
      comando += c; 
    }
  }
}

// === Função para abrir e depois fechar a tampa === //
void abrirTampa() {
  Serial.println(">> Abrindo a tampa...");
  digitalWrite(pinoLED, HIGH);
  servo.write(anguloAberto);
  delay(tempoAberto);
  servo.write(anguloFechado);
  digitalWrite(pinoLED, LOW);
  Serial.println(">> Tampa fechada.");
}
