#include <EEPROM.h>
#include <LiquidCrystal.h>

LiquidCrystal lcd(8, 9, 4, 5, 6, 7);

const int backlightPin = 10;
#define pinMotor 11

#define btnNONE 1023
#define btnSELECT 741
#define btnLEFT 505
#define btnDOWN 326
#define btnUP 142
#define btnRIGHT 0

int fakeHour = 21;
int fakeMinute = 00;

bool alarmTakenToday = false;
bool editingHour = true;
bool inEditMode = false;
unsigned long rightHoldStart = 0;
unsigned long leftHoldStart = 0;

unsigned long lastAdvance = 0;
unsigned long lastBlink = 0;
bool backlightOn = true;

unsigned long scrollTimer = 0;
int scrollIndex = 0;
String currentScrollText = "";
int currentScrollRow = 1;
bool isScrolling = false;

bool showTakenMessage = false;
unsigned long takenMsgStart = 0;

bool startupScrollDone = false;
unsigned long startupStartTime = 0;

bool mostrarNovoMedicamento = false;
String textoNovoMedicamento = "";
unsigned long tempoMostrarMedicamento = 0;

// ESTRUTURA DE MEDICAMENTOS
struct Medicamento {
  int hora;
  int minuto;
  String nome;
};

Medicamento agenda[5]; // até 5 medicamentos
int totalMedicamentos = 0;

int read_LCD_buttons() {
  int adc_key_in = analogRead(0);
  if (adc_key_in > 1000)
    return btnNONE;
  if (adc_key_in < 50)
    return btnRIGHT;
  if (adc_key_in < 195)
    return btnUP;
  if (adc_key_in < 380)
    return btnDOWN;
  if (adc_key_in < 555)
    return btnLEFT;
  if (adc_key_in < 790)
    return btnSELECT;
  return btnNONE;
}

void scrollText(String text, int row) {
  static bool scrollReset = false;
  String padded = text + "                ";
  if (currentScrollText != padded || currentScrollRow != row) {
    scrollIndex = 0;
    scrollTimer = millis();
    currentScrollText = padded;
    currentScrollRow = row;
    scrollReset = true;
  }

  if (millis() - scrollTimer > 500) {
    lcd.setCursor(0, row);
    lcd.print(currentScrollText.substring(scrollIndex, scrollIndex + 16));
    scrollIndex++;
    if (scrollIndex > currentScrollText.length() - 16) {
      scrollIndex = 0;
    }
    scrollTimer = millis();
  }

  isScrolling = true;
}

void setup() {
  lcd.begin(16, 2);
  Serial.begin(9600);
  pinMode(backlightPin, OUTPUT);
  pinMode(pinMotor, OUTPUT);
  digitalWrite(backlightPin, HIGH);
  digitalWrite(pinMotor, LOW);
  startupStartTime = millis();
}

void loop() {
  // 📥 RECEBER COMANDOS SERIAL
  if (Serial.available()) {
    String comando = Serial.readStringUntil('\n');
    comando.trim();

    // Novo comando para sincronizar hora
    if (comando.startsWith("HORA|")) {
      String horaStr = comando.substring(5); // pegar HH:MM
      int sep = horaStr.indexOf(':');
      if (sep != -1) {
        int h = horaStr.substring(0, sep).toInt();
        int m = horaStr.substring(sep + 1).toInt();

        // Atualiza a hora interna
        fakeHour = h;
        fakeMinute = m;

        Serial.println("Hora sincronizada: " + horaStr);
      }
    } else if (comando.startsWith("MED|")) {
      if (totalMedicamentos < 5) {
        int p1 = comando.indexOf('|', 4);
        if (p1 != -1) {
          String horaStr = comando.substring(4, p1);
          String nome = comando.substring(p1 + 1);

          int sep = horaStr.indexOf(':');
          if (sep != -1) {
            int h = horaStr.substring(0, sep).toInt();
            int m = horaStr.substring(sep + 1).toInt();

            agenda[totalMedicamentos].hora = h;
            agenda[totalMedicamentos].minuto = m;
            agenda[totalMedicamentos].nome = nome;
            totalMedicamentos++;

            // Mostrar o novo medicamento no visor
            textoNovoMedicamento = "Agendado: " + nome + " às " + horaStr;
            mostrarNovoMedicamento = true;
            tempoMostrarMedicamento = millis();

            Serial.println("Medicamento adicionado: " + nome);
          }
        }
      }
    } else if (comando == "ABRIR") {
      scrollText("⚠ ABRIR SOLICITADO", 1);
      digitalWrite(pinMotor, HIGH);
      delay(1000);
      digitalWrite(pinMotor, LOW);
    } else if (comando == "FECHAR") {
      scrollText(">> FECHAR TUDO <<", 1);
    } else {
      scrollText("Comando desconhecido", 1);
    }
  }

  int btn = read_LCD_buttons();

  // 🎬 Mensagem inicial
  if (!startupScrollDone) {
    scrollText("Smart Medicine Box", 0);
    if (millis() - startupStartTime > 4000) {
      lcd.clear();
      startupScrollDone = true;
    }
    return;
  }

  // ⏳ Mostrar novo medicamento durante 5 segundos
  if (mostrarNovoMedicamento) {
    scrollText(textoNovoMedicamento, 0);
    lcd.setCursor(0, 1);
    lcd.print("                ");
    if (millis() - tempoMostrarMedicamento > 5000) {
      mostrarNovoMedicamento = false;
      lcd.clear();
    }
    return;
  }

  // AVANÇAR TEMPO SIMULADO DESATIVADO PARA SINCRONIZAÇÃO PELO PC
  /*
  if (millis() - lastAdvance >= 60000) {
    fakeMinute++;
    if (fakeMinute >= 60) {
      fakeMinute = 0;
      fakeHour++;
      if (fakeHour >= 24) {
        fakeHour = 0;
        alarmTakenToday = false;
      }
    }
    lastAdvance = millis();
  }
  */

  // 🛠 Editar hora manualmente pelo botão no Arduino
  if (btn == btnRIGHT) {
    if (rightHoldStart == 0)
      rightHoldStart = millis();
    if (millis() - rightHoldStart > 2000 && !inEditMode) {
      inEditMode = true;
      editingHour = true;
      lcd.clear();
    }
  } else {
    rightHoldStart = 0;
  }

  if (btn == btnLEFT && inEditMode) {
    if (leftHoldStart == 0)
      leftHoldStart = millis();
    if (millis() - leftHoldStart > 2000) {
      inEditMode = false;
      lcd.clear();
    }
  } else {
    leftHoldStart = 0;
  }

  if (inEditMode) {
    lcd.setCursor(0, 0);
    lcd.print("Editar Manual:   ");
    lcd.setCursor(0, 1);
    lcd.print("                ");
    lcd.setCursor(0, 1);

    if (editingHour)
      lcd.print(">");
    else
      lcd.print(" ");

    if (fakeHour < 10)
      lcd.print("0");
    lcd.print(fakeHour);
    lcd.print(":");

    if (!editingHour)
      lcd.print("<");
    else
      lcd.print(" ");

    if (fakeMinute < 10)
      lcd.print("0");
    lcd.print(fakeMinute);
    lcd.print("     ");

    if (btn == btnUP) {
      if (editingHour)
        fakeHour = (fakeHour + 1) % 24;
      else
        fakeMinute = (fakeMinute + 1) % 60;
      delay(200);
    } else if (btn == btnDOWN) {
      if (editingHour)
        fakeHour = (fakeHour + 23) % 24;
      else
        fakeMinute = (fakeMinute + 59) % 60;
      delay(200);
    } else if (btn == btnLEFT || btn == btnRIGHT) {
      editingHour = !editingHour;
      delay(300);
    } else if (btn == btnSELECT) {
      inEditMode = false;
      lcd.clear();
      delay(300);
    }

  } else {
    lcd.setCursor(0, 0);
    lcd.print("Hora: ");
    if (fakeHour < 10)
      lcd.print("0");
    lcd.print(fakeHour);
    lcd.print(":");
    if (fakeMinute < 10)
      lcd.print("0");
    lcd.print(fakeMinute);
    lcd.print("  ");

    if (showTakenMessage) {
      scrollText("MEDICAMENTO TOMADO", 1);
      if (millis() - takenMsgStart > 4000) {
        showTakenMessage = false;
        lcd.setCursor(0, 1);
        lcd.print("                ");
        isScrolling = false;
      }
    } else {
      bool encontrou = false;

      for (int i = 0; i < totalMedicamentos; i++) {
        if (agenda[i].hora == fakeHour && agenda[i].minuto == fakeMinute) {
          scrollText("Tomar: " + agenda[i].nome, 1);
          encontrou = true;

          if (millis() - lastBlink >= 500) {
            digitalWrite(backlightPin, backlightOn ? LOW : HIGH);
            backlightOn = !backlightOn;
            lastBlink = millis();
          }

          if (btn == btnSELECT) {
            digitalWrite(backlightPin, HIGH);
            scrollText("MEDICAMENTO TOMADO", 1);
            alarmTakenToday = true;
            takenMsgStart = millis();
            showTakenMessage = true;
          }
          break;
        }
      }

      if (!encontrou) {
        digitalWrite(backlightPin, HIGH);
        if (!isScrolling) {
          lcd.setCursor(0, 1);
          lcd.print("                ");
        }
      }
    }
  }

  delay(100);
}
