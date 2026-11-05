import { describe, expect, it } from "vitest";
import {
  normalizeEsp32JsonPacket,
  parseEsp32CsvLine,
  toGaitSensorData,
  createGaitSensorState,
  applyGaitSensorUpdate
} from "./esp32SensorSerial.service.js";

describe("ESP32 gait packet normalization", () => {
  it("normalizes a left-insole JSON packet", () => {
    const packet = normalizeEsp32JsonPacket({
      deviceId: "left-insole",
      leftFoot: {
        fsr: { sensor1: 1, sensor2: 2, sensor3: 3, sensor4: 4, sensor5: 5, sensor6: 6 },
        imu: { accel: { x: 1, y: 2, z: 3 }, gyro: { x: 4, y: 5, z: 6 } }
      },
      mpuConnected: true
    });

    expect(packet.side).toBe("left");
    expect(packet.reading).toMatchObject({ fsr1: 1, fsr6: 6, ax: 1, mpu_ok: true });
    expect(packet.reading.gz).toBeCloseTo(6 * 180 / Math.PI);
  });

  it("normalizes the current firmware shape with top-level IMU data", () => {
    const packet = normalizeEsp32JsonPacket({
      deviceId: "right-insole",
      rightFoot: {
        fsr: { sensor1: 10, sensor2: 20, sensor3: 30, sensor4: 40, sensor5: 50, sensor6: 60 }
      },
      imu: {
        accel: { x: 1, y: 2, z: 9.8 },
        gyro: { x: 0.1, y: 0.2, z: 0.3 }
      }
    });

    expect(packet.side).toBe("right");
    expect(packet.reading).toMatchObject({
      fsr1: 10,
      fsr6: 60,
      ax: 1,
      ay: 2,
      az: 9.8,
      mpu_ok: true
    });
    expect(packet.reading.gx).toBeCloseTo(0.1 * 180 / Math.PI);
  });

  it("normalizes a right-insole JSON packet independently", () => {
    const packet = normalizeEsp32JsonPacket({
      device_id: "right-insole",
      fsr: { sensor1: 10 },
      imu: { accelerometer: { x: 11 } },
      mpu_ok: false
    });

    expect(packet.side).toBe("right");
    expect(packet.reading).toMatchObject({ fsr1: 10, ax: 11, mpu_ok: false });
    expect(packet.reading.fsr2).toBeNull();
  });

  it("preserves missing IMU values as null", () => {
    const packet = normalizeEsp32JsonPacket({
      deviceId: "left-insole",
      fsr: { sensor1: 20 }
    });

    expect(packet.reading).toMatchObject({ fsr1: 20, ax: null, gy: null, mpu_ok: false });
  });

  it("rejects malformed or unknown JSON packets", () => {
    expect(normalizeEsp32JsonPacket(null)).toBeNull();
    expect(normalizeEsp32JsonPacket({ deviceId: "unknown", fsr: { sensor1: 1 } })).toBeNull();
    expect(normalizeEsp32JsonPacket({ deviceId: "left-insole" })).toBeNull();
  });

  it("preserves the existing CSV format and marks the active side", () => {
    const reading = parseEsp32CsvLine(
      "100,1,2,3,4,5,6,1,2,3,4,5,6,25,false"
    );
    const payload = toGaitSensorData(reading, "right-insole");

    expect(payload.rightFoot.connected).toBe(true);
    expect(payload.leftFoot.connected).toBe(false);
    expect(payload.rightFoot.fsr.sensor1).toBe(1);
    expect(payload.rightFoot.imu.accel.x).toBeNull();
  });

  it("keeps alternating left and right readings independent", () => {
    let state = createGaitSensorState();
    state = applyGaitSensorUpdate(state, {
      side: "left",
      deviceId: "left-insole",
      reading: { fsr1: 1, fsr2: 2, fsr3: 3, fsr4: 4, fsr5: 5, fsr6: 6, ax: 1, ay: 2, az: 3, gx: 4, gy: 5, gz: 6, mpu_ok: true }
    });
    state = applyGaitSensorUpdate(state, {
      side: "right",
      deviceId: "right-insole",
      reading: { fsr1: 10, fsr2: 20, fsr3: 30, fsr4: 40, fsr5: 50, fsr6: 60, ax: 10, ay: 20, az: 30, gx: 40, gy: 50, gz: 60, mpu_ok: true }
    });

    expect(state.left.fsr.sensor1).toBe(1);
    expect(state.right.fsr.sensor1).toBe(10);
    expect(state.left.connected).toBe(true);
    expect(state.right.connected).toBe(true);
  });

  it("clears only the disconnected insole", () => {
    let state = createGaitSensorState();
    state = applyGaitSensorUpdate(state, {
      side: "left",
      deviceId: "left-insole",
      reading: { fsr1: 7, fsr2: 0, fsr3: 0, fsr4: 0, fsr5: 0, fsr6: 0, ax: 1, ay: 1, az: 1, gx: 1, gy: 1, gz: 1, mpu_ok: true }
    });
    state = applyGaitSensorUpdate(state, {
      side: "right",
      deviceId: "right-insole",
      reading: { fsr1: 9, fsr2: 0, fsr3: 0, fsr4: 0, fsr5: 0, fsr6: 0, ax: 1, ay: 1, az: 1, gx: 1, gy: 1, gz: 1, mpu_ok: true }
    });
    state = applyGaitSensorUpdate(state, { side: "left", deviceId: "left-insole", connected: false });

    expect(state.left.connected).toBe(false);
    expect(state.left.fsr.sensor1).toBeNull();
    expect(state.right.connected).toBe(true);
    expect(state.right.fsr.sensor1).toBe(9);
  });
});
