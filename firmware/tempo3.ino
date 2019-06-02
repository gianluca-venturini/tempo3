#include <avr/sleep.h>
#include <SparkFun_ADXL345.h>

#define INTERRUPT_PIN 2

#define DOUBLE_TAP_WINDOW_MS 400

ADXL345 adxl = ADXL345();
volatile bool active = true;
volatile unsigned long activityStart = 0;

#define HAPTIC_TIMESTAMP_BUFFER_SIZE 3
long unsigned hapticTimestamp[HAPTIC_TIMESTAMP_BUFFER_SIZE]; // Circular buffer containing timestamp of last haptic interactions
unsigned short hapticTimestampHead = 0;                      // Head of haptic interactions timestamp buffer

// This constant depends on the characteristics of the sensor
#define ORIENTATION_THRESHOLD 58
#define ORIENTATION_BUFFER_SIZE 10
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
Orientation orientation[ORIENTATION_THRESHOLD]; // Circular buffer containing orientation codes.
unsigned short orientationHead = 0;             // Head of orientation buffer
unsigned short orientationNumber = 0;           // Number of elements in orientation circular buffer
bool orientationBufferOverflow = false;

typedef struct
{
  int x;
  int y;
  int z;
} SensorReads;

void setup()
{
  Serial.begin(9600); // Start the serial terminal
  Serial.println("SparkFun ADXL345 Accelerometer Hook Up Guide Example");
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
  adxl.setTapThreshold(20);                                  // 62.5 mg per increment
  adxl.setTapDuration(15);                                   // 625 μs per increment
  adxl.setDoubleTapLatency(80);                              // 1.25 ms per increment
  adxl.setDoubleTapWindow(int(DOUBLE_TAP_WINDOW_MS / 1.25)); // 1.25 ms per increment

  adxl.InactivityINT(0);
  adxl.ActivityINT(1);
  adxl.FreeFallINT(0);
  adxl.doubleTapINT(1);
  adxl.singleTapINT(0);

  adxl.setLowPower(false);
  adxl.setRate(100);

  resetHapticInteractions();
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
  Serial.flush();
  sleepNow();

  ADXL_ISR();

  // Before enabling this connect a Realtime Timer and use it to read real milliseconds
  //  if (isMultipleHapticInteraction(millis(), 5000, 2)) {
  //    Serial.print(hapticTimestamp[0]);
  //    Serial.print(", ");
  //    Serial.print(hapticTimestamp[1]);
  //    Serial.print(", ");
  //    Serial.print(hapticTimestamp[2]);
  //    Serial.println("");
  //    resetHapticInteractions();
  //    Serial.println("2 interactions");
  //  }
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

void ADXL_ISR()
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
    setActivePosition(&sensorReads);
    printOrientations();
  }

  // Activity
  if (adxl.triggered(interrupts, ADXL345_ACTIVITY))
  {
    Serial.println("*** ACTIVITY ***");
    activityStart = millis();
    adxl.InactivityINT(1);
    adxl.ActivityINT(0);
    active = true;
  }

  // Double Tap Detection
  if (adxl.triggered(interrupts, ADXL345_DOUBLE_TAP))
  {
    Serial.println("*** DOUBLE TAP ***");
    if (active == false || millis() - activityStart < DOUBLE_TAP_WINDOW_MS)
    {
      Serial.println("*** ACTION ***");
      addHapticInteraction(millis());
    }
  }

  // Tap Detection
  if (adxl.triggered(interrupts, ADXL345_SINGLE_TAP))
  {
    Serial.println("*** TAP ***");
    //add code here to do when a tap is sensed
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
  hapticTimestamp[hapticTimestampHead] = 0;
}

// Returns true if numInteractions were executed at intaractionWindow distance between one another.
bool isMultipleHapticInteraction(unsigned long now, unsigned long interactionWindow, unsigned int numInteractions)
{
  if (numInteractions > HAPTIC_TIMESTAMP_BUFFER_SIZE)
  {
    return false;
  }
  long int timestamp = now;
  for (int i = 0; i < numInteractions; i++)
  {
    long int interactionTimestamp = hapticTimestamp[(hapticTimestampHead - i) % HAPTIC_TIMESTAMP_BUFFER_SIZE];
    if (timestamp - interactionTimestamp > interactionWindow)
    {
      return false;
    }
    timestamp = interactionTimestamp;
  }
  return true;
}

void setActivePosition(SensorReads *sensorReads)
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
    addOrientation(newOrientation);
  }
}

void addOrientation(Orientation newOrientation)
{
  if (orientationNumber >= ORIENTATION_BUFFER_SIZE)
  {
    orientationBufferOverflow = true;
    return;
  }
  Serial.print("New Orientation ");
  Serial.println(newOrientation);
  orientation[orientationHead] = newOrientation;
  orientationHead += 1;
  orientationHead = orientationHead % ORIENTATION_BUFFER_SIZE;
  orientationNumber += 1;
}

Orientation lastOrientation()
{
  if (orientationNumber <= 0)
  {
    return NO_ORIENTATION;
  }
  return orientation[(orientationHead - 1) % ORIENTATION_BUFFER_SIZE];
}

void printOrientations()
{
  for (int i = 0; i < orientationNumber; i++)
  {
    Serial.print("Orientation");
    Serial.print(i);
    Serial.print(": ");
    Serial.println(orientation[(i + orientationHead - orientationNumber) % ORIENTATION_BUFFER_SIZE]);
    if (orientationBufferOverflow)
    {
      Serial.println("Buffer overflow");
    }
  }
}
