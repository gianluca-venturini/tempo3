#include <avr/sleep.h>
#include <limits.h>
#include <SparkFun_ADXL345.h>
#include <DS3231.h>
#include <SoftwareSerial.h>

#define INTERRUPT_PIN 2
#define BLUETOOTH_POWER 3
#define BLUETOOTH_SERIAL_RX 4
#define BLUETOOTH_SERIAL_TX 5
#define BLUETOOTH_CONNECTION_ENSTABLISHED_PIN 6
#define BLUE_LED_PIN 9

#define DOUBLE_TAP_WINDOW_MS 400
#define LED_MULTIPLIER_CONSTANT 1000.0

// Bluetooth enabled time window
#define BLUETOOTH_ENABLED_S 10

SoftwareSerial bluetooth(BLUETOOTH_SERIAL_RX, BLUETOOTH_SERIAL_TX);

ADXL345 adxl = ADXL345();

// Wether the device is supposed to log orientations
volatile bool activeMode = false;

// Whether the bluetooth is active
bool bluetoothEnabled = false;
// Milliseconds elapsed since bluetooth was enabled
unsigned long int bluetoothEnabledTs = 0;

// Whether the acceleromenter is sensing activity
volatile bool active = true;
volatile unsigned long activityStart = 0;

#define HAPTIC_TIMESTAMP_BUFFER_SIZE 10
long unsigned hapticTimestamp[HAPTIC_TIMESTAMP_BUFFER_SIZE]; // Circular buffer containing timestamp of last haptic interactions
short hapticTimestampHead = 0;                               // Head of haptic interactions timestamp buffer

// This constant depends on the characteristics of the sensor
#define ORIENTATION_THRESHOLD 58
#define TIME_EVENTS_BUFFER_SIZE 10
enum Orientation
{
  NO_ORIENTATION = 0,
  Orientation_X = 1,
  Orientation_MX = 2,
  Orientation_Y = 3,
  Orientation_MY = 4,
  Orientation_Z = 5,
  Orientation_MZ = 6,
};

typedef struct
{
  unsigned long timestampStart;
  Orientation orientation;
} TimeEvent;

TimeEvent timeEvents[TIME_EVENTS_BUFFER_SIZE]; // Circular buffer containing time events
unsigned short timeEventsHead = 0;             // Head of orientation buffer
unsigned short timeEventsNumber = 0;           // Number of elements in orientation circular buffer
bool orientationBufferOverflow = false;

int blueLedBlinkTime = 0;
unsigned int blueLedBlinkSpeed;

typedef struct
{
  int x;
  int y;
  int z;
} SensorReads;

RTClib RTC;
DS3231 clock;

void ledControls()
{
  if (blueLedBlinkTime > 0)
  {
    analogWrite(BLUE_LED_PIN, abs(sin(blueLedBlinkTime / LED_MULTIPLIER_CONSTANT) * 255));
    blueLedBlinkTime -= blueLedBlinkSpeed;
  }
}

bool areLedBlinking()
{
  return blueLedBlinkTime > 0;
}

void startBlueLedBlink(unsigned short numBlinks, unsigned short speed = 1)
{
  blueLedBlinkTime = 3.1415 * LED_MULTIPLIER_CONSTANT * numBlinks;
  blueLedBlinkSpeed = speed;
}

char deviceName[20] = "Time3";

void setup()
{
  Serial.begin(9600); // Start the serial terminal
  Serial.println("Time3 setup routine");
  Serial.println();
  Serial.flush();

  adxl.powerOn();               // Power on the ADXL345
  adxl.setInterruptLevelBit(1); // Interrupt active low

  adxl.setRangeSetting(8); // Give the range settings
                           // Accepted values are 2g, 4g, 8g or 16g
                           // Higher Values = Wider Measurement Range
                           // Lower Values = Greater Sensitivity

  adxl.setActivityXYZ(1, 1, 1);  // Set to activate movement detection in the axes "adxl.setActivityXYZ(X, Y, Z);" (1 == ON, 0 == OFF)
  adxl.setActivityThreshold(20); // 62.5mg per increment   // Set activity   // Inactivity thresholds (0-255)

  adxl.setInactivityXYZ(1, 1, 1);  // Set to detect inactivity in all the axes "adxl.setInactivityXYZ(X, Y, Z);" (1 == ON, 0 == OFF)
  adxl.setInactivityThreshold(20); // 62.5mg per increment   // Set inactivity // Inactivity thresholds (0-255)
  adxl.setTimeInactivity(2);       // How many seconds of no activity is inactive?

  adxl.setTapDetectionOnXYZ(1, 1, 1); // Detect taps in the directions turned ON "adxl.setTapDetectionOnX(X, Y, Z);" (1 == ON, 0 == OFF)

  // Set values for what is considered a TAP and what is a DOUBLE TAP (0-255)
  adxl.setTapThreshold(25);                                  // 62.5 mg per increment
  adxl.setTapDuration(30);                                   // 625 μs per increment
  adxl.setDoubleTapLatency(80);                              // 1.25 ms per increment
  adxl.setDoubleTapWindow(int(DOUBLE_TAP_WINDOW_MS / 1.25)); // 1.25 ms per increment

  adxl.InactivityINT(0);
  adxl.ActivityINT(1);
  adxl.FreeFallINT(0);
  adxl.doubleTapINT(0);
  adxl.singleTapINT(1);

  adxl.setLowPower(false);
  adxl.setRate(100);

  pinMode(BLUE_LED_PIN, OUTPUT);
  pinMode(BLUETOOTH_CONNECTION_ENSTABLISHED_PIN, INPUT);
  pinMode(BLUETOOTH_SERIAL_TX, OUTPUT);
  pinMode(BLUETOOTH_POWER, OUTPUT); // Activate bluetooth serial

  resetHapticInteractions();
  disableBluetooth();
}

void handleDoubleTapInterrupt() {}

void sleepNow()
{
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  attachInterrupt(digitalPinToInterrupt(INTERRUPT_PIN), handleDoubleTapInterrupt, LOW);
  sleep_mode();
  sleep_disable();
  detachInterrupt(digitalPinToInterrupt(INTERRUPT_PIN));
}

void loop()
{
  if (areLedBlinking())
  {
    ledControls();
    return;
  }
  if (bluetoothEnabled == false)
  {
    sleepNow();
    delay(10);
  }

  unsigned long now = getTimestamp();

  ADXL_ISR(now);

  Serial.print(hapticTimestampHead);
  Serial.print(", ");
  Serial.print(hapticTimestamp[0]);
  Serial.print(", ");
  Serial.print(hapticTimestamp[1]);
  Serial.print(", ");
  Serial.print(hapticTimestamp[2]);
  Serial.println("");
  if (activeMode)
  {
    if (isMultipleHapticInteraction(now, 3, 5))
    {
      // Enter inactive mode: nothing is enabled except tap
      resetHapticInteractions();
      startBlueLedBlink(10, 4);
      activeMode = false;
    }
  }
  else
  {
    if (isMultipleHapticInteraction(now, 5, 10))
    {
      // Enter active mode: position is actively monitored
      resetHapticInteractions();
      startBlueLedBlink(2, 4);
      activeMode = true;
    }
  }
  checkBluetooth();

  if (now - bluetoothEnabledTs > BLUETOOTH_ENABLED_S && !isBluetoothConnected())
  {
    disableBluetooth();
  }

  Serial.flush();
}

boolean isBluetoothConnected()
{
  return digitalRead(BLUETOOTH_CONNECTION_ENSTABLISHED_PIN) == HIGH;
}

void checkBluetooth()
{
  if (bluetoothEnabled == false)
  {
    return;
  }

  while (bluetooth.available() > 0)
  {
    char inByte = bluetooth.read();
    bool nameRequested = inByte & 0x1;
    bool eventsRequested = inByte & 0x2;
    char *message = buildMessage(nameRequested, eventsRequested);
    sendBluetoothMessage(message);
    free(message);
  }
}

char *buildMessage(bool nameRequested, bool eventsRequested)
{

  char *message = (char *)malloc(400);
  bool firstField = true;
  message[0] = 0x0;
  strcat(message, "{");

  if (nameRequested)
  {
    if (firstField == false)
    {
      strcat(message, ",");
    }
    char nameFormatted[30];
    sprintf(nameFormatted, "\"name\":\"%s\"", deviceName);
    strcat(message, nameFormatted);
    firstField = false;
  }

  if (eventsRequested)
  {
    if (firstField == false)
    {
      strcat(message, ",");
    }
    strcat(message, "\"events\":[");

    unsigned int initialTimeEventIndex = (TIME_EVENTS_BUFFER_SIZE + timeEventsHead - timeEventsNumber) % TIME_EVENTS_BUFFER_SIZE;
    unsigned int timeEventIndex = initialTimeEventIndex;
    unsigned int processedTimeEvents = 0;
    while (processedTimeEvents < timeEventsNumber)
    {
      char timeEventFormatted[100];
      TimeEvent timeEvent = timeEvents[timeEventIndex];
      sprintf(timeEventFormatted, "{\"ts\":%ld, \"pos\":%d}", timeEvent.timestampStart, timeEvent.orientation);
      if (timeEventIndex == initialTimeEventIndex)
      {
        strcat(message, timeEventFormatted);
      }
      else
      {
        strcat(message, ",");
        strcat(message, timeEventFormatted);
      }

      processedTimeEvents += 1;
      timeEventIndex = (timeEventIndex + 1) % TIME_EVENTS_BUFFER_SIZE;
    }
    strcat(message, "]");

    firstField = false;
  }

  strcat(message, "}");

  return message;
}

void sendBluetoothMessage(char *message)
{
  char messageLength[6];
  itoa(strlen(message), messageLength, 10);
  for (int i = 0; messageLength[i] != '\0'; i++)
  {
    bluetooth.write(messageLength[i]);
  }
  int zero = 0x0;
  bluetooth.write(zero);
  for (int i = 0; message[i] != '\0'; i++)
  {
    bluetooth.write(message[i]);
  }
}

void readOrientation(SensorReads *sensorReads)
{
  // Accelerometer Readings
  adxl.readAccel(&(sensorReads->x), &(sensorReads->y), &(sensorReads->z)); // Read the accelerometer values and store them in variables declared above x,y,z

  // Output Results to Serial
  /* UNCOMMENT TO VIEW X Y Z ACCELEROMETER VALUES */
  Serial.print(sensorReads->x);
  Serial.print(", ");
  Serial.print(sensorReads->y);
  Serial.print(", ");
  Serial.println(sensorReads->z);
  Serial.println(adxl.isLowPower());
}

// Returns timestamps in seconds
unsigned long getTimestamp()
{
  DateTime now = RTC.now();
  return now.unixtime();
}

void ADXL_ISR(unsigned long now)
{

  // getInterruptSource clears all triggered actions after returning value
  // Do not call again until you need to recheck for triggered actions
  byte interrupts = adxl.getInterruptSource();

  // Free Fall Detection
  if (adxl.triggered(interrupts, ADXL345_FREE_FALL))
  {
    Serial.println("*** FREE FALL ***");
    //add code here to do when free fall is sensed
  }

  // Inactivity
  if (adxl.triggered(interrupts, ADXL345_INACTIVITY))
  {
    Serial.println("*** INACTIVITY ***");
    adxl.ActivityINT(1);
    adxl.InactivityINT(0);
    active = false;

    SensorReads sensorReads;
    readOrientation(&sensorReads);
    setActivePosition(&sensorReads, now);
    printOrientations();
  }

  // Activity
  if (adxl.triggered(interrupts, ADXL345_ACTIVITY))
  {
    Serial.println("*** ACTIVITY ***");
    activityStart = getTimestamp();
    adxl.InactivityINT(1);
    adxl.ActivityINT(0);
    active = true;
  }

  // Double Tap Detection
  if (adxl.triggered(interrupts, ADXL345_DOUBLE_TAP))
  {
    Serial.println("*** DOUBLE TAP ***");
  }

  // Tap Detection
  if (adxl.triggered(interrupts, ADXL345_SINGLE_TAP))
  {
    Serial.println("*** TAP ***");
    unsigned long now = getTimestamp();
    addHapticInteraction(now);
  }
}

// Add one haptic interaction to the buffer
void addHapticInteraction(unsigned long timestamp)
{
  hapticTimestamp[hapticTimestampHead] = timestamp;
  hapticTimestampHead += 1;
  hapticTimestampHead = hapticTimestampHead % HAPTIC_TIMESTAMP_BUFFER_SIZE;
}

// Reset the haptic interactions buffer
void resetHapticInteractions()
{
  hapticTimestampHead = 0;
  hapticTimestamp[HAPTIC_TIMESTAMP_BUFFER_SIZE - 1] = 0;
}

int positiveModule(int number, int module)
{
  return (number % module + module) % module;
}

// Returns true if numInteractions were executed at intaractionWindow distance between one another.
bool isMultipleHapticInteraction(unsigned long now, unsigned long interactionWindow, unsigned int numInteractions)
{
  if (numInteractions > HAPTIC_TIMESTAMP_BUFFER_SIZE)
  {
    return false;
  }
  for (int i = 0; i < numInteractions; i++)
  {
    short index = positiveModule(hapticTimestampHead - i - 1, HAPTIC_TIMESTAMP_BUFFER_SIZE);
    long int interactionTimestamp = hapticTimestamp[index];
    if (now - interactionTimestamp > interactionWindow)
    {
      return false;
    }
  }
  return true;
}

void setActivePosition(SensorReads *sensorReads, unsigned long now)
{
  Orientation newOrientation = NO_ORIENTATION;
  if (sensorReads->x > ORIENTATION_THRESHOLD)
  {
    newOrientation = Orientation_X;
  }
  else if (sensorReads->x < -ORIENTATION_THRESHOLD)
  {
    newOrientation = Orientation_MX;
  }
  else if (sensorReads->y > ORIENTATION_THRESHOLD)
  {
    newOrientation = Orientation_Y;
  }
  else if (sensorReads->y < -ORIENTATION_THRESHOLD)
  {
    newOrientation = Orientation_MY;
  }
  else if (sensorReads->z > ORIENTATION_THRESHOLD)
  {
    newOrientation = Orientation_Z;
  }
  else if (sensorReads->z < -ORIENTATION_THRESHOLD)
  {
    newOrientation = Orientation_MZ;
  }
  if (newOrientation != lastOrientation())
  {
    handleOrientationChange(newOrientation, now);
  }
}

void handleOrientationChange(Orientation newOrientation, unsigned long now)
{
  addOrientation(newOrientation, now);
  enableBluetooth();
}

void addOrientation(Orientation newOrientation, unsigned long now)
{
  if (timeEventsNumber >= TIME_EVENTS_BUFFER_SIZE)
  {
    orientationBufferOverflow = true;
    return;
  }
  Serial.print("New Orientation ");
  Serial.println(newOrientation);
  timeEvents[timeEventsHead].orientation = newOrientation;
  timeEvents[timeEventsHead].timestampStart = now;
  timeEventsHead += 1;
  timeEventsHead = timeEventsHead % TIME_EVENTS_BUFFER_SIZE;
  timeEventsNumber += 1;
}

Orientation lastOrientation()
{
  if (timeEventsNumber <= 0)
  {
    return NO_ORIENTATION;
  }
  return timeEvents[(timeEventsHead - 1) % TIME_EVENTS_BUFFER_SIZE].orientation;
}

void printOrientations()
{
  for (int i = 0; i < timeEventsNumber; i++)
  {
    Serial.print("Orientation");
    Serial.print(i);
    Serial.print(": ");
    Serial.println(timeEvents[(i + timeEventsHead - timeEventsNumber) % TIME_EVENTS_BUFFER_SIZE].orientation);
    Serial.println(timeEvents[(i + timeEventsHead - timeEventsNumber) % TIME_EVENTS_BUFFER_SIZE].timestampStart);
    if (orientationBufferOverflow)
    {
      Serial.println("Buffer overflow");
    }
  }
}

void enableBluetooth()
{
  bluetooth.begin(9600);
  bluetooth.listen();
  digitalWrite(BLUETOOTH_POWER, HIGH);
  digitalWrite(BLUETOOTH_SERIAL_TX, HIGH);
  bluetoothEnabled = true;
  bluetoothEnabledTs = getTimestamp();
}

void disableBluetooth()
{
  bluetooth.end();
  digitalWrite(BLUETOOTH_POWER, LOW);
  digitalWrite(BLUETOOTH_SERIAL_TX, LOW);
  bluetoothEnabled = false;
}
