import { describe, expect, it } from "vitest";
import {
  Esp32SensorSerialService,
  diagnoseEsp32CsvLine,
  parseEsp32CsvLine,
  toGaitFootData,
  toGaitSensorData
} from "./esp32SensorSerial.service.js";
import { EventEmitter } from "node:events";

class FakeSerialPort extends EventEmitter {
  constructor(options) {
    super();
    this.path = options.path;
    this.isOpen = false;
  }

  open(callback) {
    this.isOpen = true;
    this.emit("open");
    callback();
  }

  close() {
    this.isOpen = false;
    this.emit("close");
  }
}

describe("ESP32 serial CSV parsing", () => {
  it("parses the documented FSR and MPU row", () => {
    const reading = parseEsp32CsvLine(
      "100,1,2,3,4,5,6,0.1,0.2,0.3,1,2,3,24.5,true"
    );

    expect(reading).toEqual({
      time_ms: 100,
      fsr1: 1,
      fsr2: 2,
      fsr3: 3,
      fsr4: 4,
      fsr5: 5,
      fsr6: 6,
      ax: 0.1,
      ay: 0.2,
      az: 0.3,
      gx: 1,
      gy: 2,
      gz: 3,
      temperature: 24.5,
      mpu_ok: true
    });
  });

  it("recognizes the header and rejects invalid rows", () => {
    expect(parseEsp32CsvLine(
      "time_ms,fsr1,fsr2,fsr3,fsr4,fsr5,fsr6,ax,ay,az,gx,gy,gz,temperature,mpu_ok"
    )).toBe("header");
    expect(parseEsp32CsvLine("not,a,valid,row")).toBeNull();
  });

  it("reports the exact rejection reason without changing parser behavior", () => {
    expect(diagnoseEsp32CsvLine("1,2,3")).toMatchObject({
      valid: false,
      fieldCount: 3,
      reason: "expected 15 fields but received 3"
    });
    expect(diagnoseEsp32CsvLine(
      "100,1,2,3,4,5,6,not-a-number,0.2,0.3,1,2,3,24.5,true"
    ).reason).toBe('field "ax" is not a finite number');
    expect(diagnoseEsp32CsvLine(
      "100,1,2,3,4,5,6,0.1,0.2,0.3,1,2,3,24.5,maybe"
    ).reason).toBe('field "mpu_ok" has unsupported value "maybe"');
  });

  it("maps the left-foot row without duplicating it to the right foot", () => {
    const reading = parseEsp32CsvLine(
      "100,1,2,3,4,5,6,0.1,0.2,0.3,1,2,3,24.5,1"
    );
    const data = toGaitSensorData(reading, "left-glove");

    expect(data.leftFoot.fsr.sensor6).toBe(6);
    expect(data.rightFoot.fsr.sensor1).toBeNull();
    expect(data.imu.accel).toEqual({ x: 0.1, y: 0.2, z: 0.3 });
    expect(data.temperature).toBe(24.5);
    expect(data.mpuConnected).toBe(true);
  });

  it("maps all FSR and IMU values for one side", () => {
    const reading = parseEsp32CsvLine(
      "100,1,2,3,4,5,6,0.1,0.2,0.3,1,2,3,24.5,true"
    );

    expect(toGaitFootData(reading)).toEqual({
      fsr: { sensor1: 1, sensor2: 2, sensor3: 3, sensor4: 4, sensor5: 5, sensor6: 6 },
      imu: {
        accel: { x: 0.1, y: 0.2, z: 0.3 },
        gyro: { x: 1, y: 2, z: 3 }
      },
      connected: true,
      mpuConnected: true
    });
  });

  it("marks MPU values unavailable when the packet reports MPU failure", () => {
    const reading = parseEsp32CsvLine(
      "100,1,2,3,4,5,6,0.1,0.2,0.3,1,2,3,24.5,false"
    );

    expect(toGaitFootData(reading).imu).toEqual({
      accel: { x: null, y: null, z: null },
      gyro: { x: null, y: null, z: null }
    });
  });

  it("opens two ports and emits independent side updates", () => {
    const ports = new Map();
    const tremorUpdates = [];
    const gaitUpdates = [];
    const service = new Esp32SensorSerialService({
      portConfigs: [
        { side: "left", portPath: "COM7" },
        { side: "right", portPath: "COM8" }
      ],
      reconnectDelayMs: 100000,
      serialPortFactory: (options) => {
        const port = new FakeSerialPort(options);
        ports.set(options.path, port);
        return port;
      }
    });

    service.start(
      (payload) => tremorUpdates.push(payload),
      (payload) => gaitUpdates.push(payload)
    );

    ports.get("COM7").emit(
      "data",
      Buffer.from("100,1,2,3,4,5,6,0.1,0.2,0.3,1,2,3,24.5,true\n")
    );
    ports.get("COM8").emit(
      "data",
      Buffer.from("200,11,12,13,14,15,16,4,5,6,7,8,9,25,false\n")
    );

    expect(ports.size).toBe(2);
    const readings = gaitUpdates.filter((update) => update.reading);
    expect(readings.map((update) => update.side)).toEqual(["left", "right"]);
    expect(readings[0].reading.fsr1).toBe(1);
    expect(readings[0].reading.gz).toBe(3);
    expect(readings[1].reading.fsr1).toBe(11);
    expect(readings[1].reading.gz).toBe(9);
    expect(tremorUpdates.filter((update) => update.reading)).toHaveLength(2);
    service.stop();
  });

  it("rejects malformed packets without emitting a reading", () => {
    const gaitUpdates = [];
    const service = new Esp32SensorSerialService({
      portConfigs: [{ side: "left", portPath: "COM7" }],
      serialPortFactory: (options) => new FakeSerialPort(options)
    });
    service.start(() => {}, (payload) => gaitUpdates.push(payload));
    const port = service.ports.get("left").port;

    port.emit("data", Buffer.from("100,1,2,not-a-number\n"));

    expect(gaitUpdates.filter((update) => update.reading)).toEqual([]);
    service.stop();
  });

  it("emits a disconnected status for only the affected side", () => {
    const gaitUpdates = [];
    const service = new Esp32SensorSerialService({
      portConfigs: [
        { side: "left", portPath: "COM7" },
        { side: "right", portPath: "COM8" }
      ],
      serialPortFactory: (options) => new FakeSerialPort(options)
    });
    service.start(() => {}, (payload) => gaitUpdates.push(payload));

    service.ports.get("left").port.close();

    expect(gaitUpdates.at(-1)).toMatchObject({
      side: "left",
      connected: false,
      deviceId: "left-insole"
    });
    expect(gaitUpdates.at(-1).side).not.toBe("right");
    service.stop();
  });
});
