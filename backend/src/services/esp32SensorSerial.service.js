import { SerialPort } from "serialport";

const CSV_FIELDS = [
  "time_ms",
  "fsr1",
  "fsr2",
  "fsr3",
  "fsr4",
  "fsr5",
  "fsr6",
  "ax",
  "ay",
  "az",
  "gx",
  "gy",
  "gz",
  "temperature",
  "mpu_ok"
];

const numericFields = CSV_FIELDS.filter((field) => field !== "mpu_ok");

export function diagnoseEsp32CsvLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return { valid: false, reason: "empty line", fieldCount: 0 };

  const values = trimmed.split(",").map((value) => value.trim());
  if (values.length !== CSV_FIELDS.length) {
    return {
      valid: false,
      reason: `expected ${CSV_FIELDS.length} fields but received ${values.length}`,
      fieldCount: values.length
    };
  }

  if (values.every((value, index) => value.toLowerCase() === CSV_FIELDS[index])) {
    return { valid: true, reason: "header", fieldCount: values.length };
  }

  for (const field of numericFields) {
    const index = CSV_FIELDS.indexOf(field);
    if (!Number.isFinite(Number(values[index]))) {
      return {
        valid: false,
        reason: `field "${field}" is not a finite number`,
        fieldCount: values.length
      };
    }
  }

  const mpuValue = values[CSV_FIELDS.indexOf("mpu_ok")].toLowerCase();
  if (!["1", "true", "ok", "yes", "0", "false", "fail", "no"].includes(mpuValue)) {
    return {
      valid: false,
      reason: `field "mpu_ok" has unsupported value "${mpuValue}"`,
      fieldCount: values.length
    };
  }

  return { valid: true, reason: "valid data row", fieldCount: values.length };
}

export function parseEsp32CsvLine(line) {
  const values = line.trim().split(",").map((value) => value.trim());
  if (values.length !== CSV_FIELDS.length) return null;
  if (values.every((value, index) => value.toLowerCase() === CSV_FIELDS[index])) {
    return "header";
  }

  const reading = Object.fromEntries(
    CSV_FIELDS.map((field, index) => [field, values[index]])
  );

  for (const field of numericFields) {
    const value = Number(reading[field]);
    if (!Number.isFinite(value)) return null;
    reading[field] = value;
  }

  const mpuValue = reading.mpu_ok.toLowerCase();
  if (["1", "true", "ok", "yes"].includes(mpuValue)) {
    reading.mpu_ok = true;
  } else if (["0", "false", "fail", "no"].includes(mpuValue)) {
    reading.mpu_ok = false;
  } else {
    return null;
  }

  return reading;
}

export function toGaitSensorData(reading, deviceId = "esp32") {
  const side = deviceId.toLowerCase().includes("right") ? "right" : "left";
  const activeFoot = {
    connected: true,
    fsr: {
      sensor1: reading.fsr1,
      sensor2: reading.fsr2,
      sensor3: reading.fsr3,
      sensor4: reading.fsr4,
      sensor5: reading.fsr5,
      sensor6: reading.fsr6
    },
    imu: {
      accel: reading.mpu_ok
        ? { x: reading.ax, y: reading.ay, z: reading.az }
        : { x: null, y: null, z: null },
      gyro: reading.mpu_ok
        ? { x: reading.gx, y: reading.gy, z: reading.gz }
        : { x: null, y: null, z: null }
    },
    mpuConnected: reading.mpu_ok
  };
  const inactiveFoot = {
    connected: false,
    fsr: {
      sensor1: null, sensor2: null, sensor3: null,
      sensor4: null, sensor5: null, sensor6: null
    },
    imu: {
      accel: { x: null, y: null, z: null },
      gyro: { x: null, y: null, z: null }
    },
    mpuConnected: false
  };
  return {
    type: "esp32_insole_data",
    source: "esp32_wifi",
    deviceId,
    connected: true,
    leftFoot: side === "left" ? activeFoot : inactiveFoot,
    rightFoot: side === "right" ? activeFoot : inactiveFoot,
    imu: activeFoot.imu,
    temperature: reading.temperature,
    mpuConnected: reading.mpu_ok,
    timestamp: Date.now()
  };
}

const finiteOrNull = (value) => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    if (["true", "1", "yes", "ok"].includes(value.toLowerCase())) return true;
    if (["false", "0", "no", "fail"].includes(value.toLowerCase())) return false;
  }
  return null;
}

function getDeviceSide(deviceId, explicitSide) {
  const value = String(explicitSide || deviceId || "").toLowerCase();
  if (value.includes("left")) return "left";
  if (value.includes("right")) return "right";
  return null;
}

export function normalizeEsp32JsonPacket(packet, fallbackDeviceId = null) {
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) return null;

  const deviceId = packet.deviceId || packet.device_id || fallbackDeviceId;
  const side = getDeviceSide(deviceId, packet.side);
  if (!side) return null;

  const foot = packet[`${side}Foot`] || packet.foot || packet;
  const fsr = foot.fsr || foot.fsrSensors || packet.fsr || {};
  const imu = foot.imu || packet.imu || {};
  const accel = imu.accel || imu.accelerometer || packet.accelerometer || {};
  const gyro = imu.gyro || packet.gyroscope || {};
  const explicitMpuConnected = parseBoolean(
    packet.mpuConnected ?? packet.mpu_ok ?? foot.mpuConnected
  );
  const hasCompleteImu = [accel.x ?? accel.ax, accel.y ?? accel.ay, accel.z ?? accel.az,
    gyro.x ?? gyro.gx, gyro.y ?? gyro.gy, gyro.z ?? gyro.gz]
    .every((value) => finiteOrNull(value) !== null);
  const mpuConnected = explicitMpuConnected ?? hasCompleteImu;

  const reading = {
    fsr1: finiteOrNull(fsr.sensor1 ?? fsr.fsr1),
    fsr2: finiteOrNull(fsr.sensor2 ?? fsr.fsr2),
    fsr3: finiteOrNull(fsr.sensor3 ?? fsr.fsr3),
    fsr4: finiteOrNull(fsr.sensor4 ?? fsr.fsr4),
    fsr5: finiteOrNull(fsr.sensor5 ?? fsr.fsr5),
    fsr6: finiteOrNull(fsr.sensor6 ?? fsr.fsr6),
    ax: finiteOrNull(accel.x ?? accel.ax),
    ay: finiteOrNull(accel.y ?? accel.ay),
    az: finiteOrNull(accel.z ?? accel.az),
    // The current Adafruit firmware sends radians/second. The dashboard contract is degrees/second.
    gx: finiteOrNull(gyro.x ?? gyro.gx) === null ? null : finiteOrNull(gyro.x ?? gyro.gx) * 180 / Math.PI,
    gy: finiteOrNull(gyro.y ?? gyro.gy) === null ? null : finiteOrNull(gyro.y ?? gyro.gy) * 180 / Math.PI,
    gz: finiteOrNull(gyro.z ?? gyro.gz) === null ? null : finiteOrNull(gyro.z ?? gyro.gz) * 180 / Math.PI,
    temperature: finiteOrNull(packet.temperature ?? foot.temperature),
    mpu_ok: mpuConnected
  };

  const hasSensorValue = Object.entries(reading)
    .some(([field, value]) => field !== "mpu_ok" && value !== null);
  if (!hasSensorValue) return null;

  return {
    side,
    deviceId: String(deviceId),
    reading,
    timestamp: finiteOrNull(packet.timestamp) || Date.now()
  };
}

const emptyFoot = (deviceId) => ({
  deviceId,
  connected: false,
  fsr: {
    sensor1: null, sensor2: null, sensor3: null,
    sensor4: null, sensor5: null, sensor6: null
  },
  imu: {
    accel: { x: null, y: null, z: null },
    gyro: { x: null, y: null, z: null }
  },
  mpuConnected: false
});

export function createGaitSensorState() {
  return {
    left: emptyFoot("left-insole"),
    right: emptyFoot("right-insole")
  };
}

export function applyGaitSensorUpdate(state, update) {
  if (!state?.[update?.side]) return state;

  const next = {
    left: { ...state.left },
    right: { ...state.right }
  };
  const current = next[update.side];

  if (update.reading) {
    const reading = update.reading;
    next[update.side] = {
      ...current,
      deviceId: update.deviceId || current.deviceId,
      connected: true,
      fsr: {
        sensor1: reading.fsr1,
        sensor2: reading.fsr2,
        sensor3: reading.fsr3,
        sensor4: reading.fsr4,
        sensor5: reading.fsr5,
        sensor6: reading.fsr6
      },
      imu: {
        accel: reading.mpu_ok
          ? { x: reading.ax, y: reading.ay, z: reading.az }
          : { x: null, y: null, z: null },
        gyro: reading.mpu_ok
          ? { x: reading.gx, y: reading.gy, z: reading.gz }
          : { x: null, y: null, z: null }
      },
      mpuConnected: reading.mpu_ok === true
    };
  } else if (typeof update.connected === "boolean") {
    next[update.side] = update.connected
      ? { ...current, deviceId: update.deviceId || current.deviceId, connected: true }
      : emptyFoot(update.deviceId || current.deviceId);
  }

  return next;
}

export function toGaitFootData(reading) {
  return {
    fsr: {
      sensor1: reading.fsr1,
      sensor2: reading.fsr2,
      sensor3: reading.fsr3,
      sensor4: reading.fsr4,
      sensor5: reading.fsr5,
      sensor6: reading.fsr6
    },
    imu: {
      accel: reading.mpu_ok
        ? { x: reading.ax, y: reading.ay, z: reading.az }
        : { x: null, y: null, z: null },
      gyro: reading.mpu_ok
        ? { x: reading.gx, y: reading.gy, z: reading.gz }
        : { x: null, y: null, z: null }
    },
    connected: true,
    mpuConnected: reading.mpu_ok
  };
}

export class Esp32SensorSerialService {
  constructor({
    serialPortFactory = (options) => new SerialPort(options),
    portConfigs,
    baudRate = Number(process.env.ESP32_SERIAL_BAUD_RATE || 115200),
    reconnectDelayMs = Number(process.env.ESP32_SERIAL_RECONNECT_DELAY_MS || 3000)
  } = {}) {
    this.serialPortFactory = serialPortFactory;
    this.portConfigs = portConfigs || [
      {
        side: "left",
        portPath: process.env.ESP32_LEFT_SERIAL_PORT?.trim() || null
      },
      {
        side: "right",
        portPath: process.env.ESP32_RIGHT_SERIAL_PORT?.trim() || null
      }
    ];
    if (!portConfigs && !this.portConfigs.some((config) => config.portPath)) {
      const legacyPort = process.env.ESP32_SERIAL_PORT?.trim() || null;
      if (legacyPort) this.portConfigs[0].portPath = legacyPort;
    }
    this.baudRate = baudRate;
    this.reconnectDelayMs = reconnectDelayMs;
    this.ports = new Map();
    this.reconnectTimer = null;
    this.running = false;
    this.broadcast = null;
    this.gaitBroadcast = null;
  }

  start(broadcast, gaitBroadcast) {
    this.broadcast = broadcast;
    this.gaitBroadcast = gaitBroadcast;
    const enabledPorts = this.portConfigs.filter((config) => config.portPath);
    if (enabledPorts.length === 0) {
      console.info("[ESP32 Serial] Disabled: no serial ports are configured");
      return;
    }

    this.running = true;
    enabledPorts.forEach((config) => this.open(config));
  }

  stop() {
    this.running = false;
    for (const state of this.ports.values()) {
      if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
      state.port.removeAllListeners();
      if (state.port.isOpen) state.port.close();
    }
    this.ports.clear();
  }

  open(config) {
    if (!this.running || this.ports.has(config.side)) return;

    try {
      const port = this.serialPortFactory({
        path: config.portPath,
        baudRate: this.baudRate,
        autoOpen: false
      });
      const state = {
        port,
        buffer: "",
        reconnectTimer: null,
        diagnosticLinesLogged: 0
      };
      this.ports.set(config.side, state);

      port.on("open", () => {
        console.info(`[ESP32 Serial] Connected ${config.side} insole`, {
          side: config.side,
          port: config.portPath,
          baudRate: this.baudRate
        });
        this.emitStatus(config, true);
      });

      port.on("data", (chunk) => this.handleData(config, state, chunk));
      port.on("error", (error) => {
        console.error(`[ESP32 Serial] Error ${config.side} insole`, {
          side: config.side,
          port: config.portPath,
          message: error.message
        });
        this.emitStatus(config, false, error.message);
      });
      port.on("close", () => {
        this.ports.delete(config.side);
        console.info(`[ESP32 Serial] Disconnected ${config.side} insole`, {
          side: config.side,
          port: config.portPath
        });
        this.emitStatus(config, false);
        this.scheduleReconnect(config);
      });

      port.open((error) => {
        if (error) {
          console.error(`[ESP32 Serial] Failed to open ${config.side} insole`, {
            side: config.side,
            port: config.portPath,
            message: error.message
          });
          port.removeAllListeners();
          this.ports.delete(config.side);
          this.emitStatus(config, false, error.message);
          this.scheduleReconnect(config);
        }
      });
    } catch (error) {
      this.ports.delete(config.side);
      console.error(`[ESP32 Serial] Initialization failed ${config.side} insole`, {
        side: config.side,
        port: config.portPath,
        message: error.message
      });
      this.emitStatus(config, false, error.message);
      this.scheduleReconnect(config);
    }
  }

  handleData(config, state, chunk) {
    state.buffer += chunk.toString("utf8");
    const lines = state.buffer.split(/\r?\n/);
    state.buffer = lines.pop() || "";

    for (const line of lines) {
      const reading = parseEsp32CsvLine(line);
      if (!reading || reading === "header") {
        if (reading !== "header" && state.diagnosticLinesLogged < 5) {
          const diagnosis = diagnoseEsp32CsvLine(line);
          console.warn(`[ESP32 Serial] Invalid CSV from ${config.side} insole`, {
            port: config.portPath,
            rawLine: line.slice(0, 500),
            fieldCount: diagnosis.fieldCount,
            reason: diagnosis.reason
          });
          state.diagnosticLinesLogged += 1;
        }
        continue;
      }

      console.info(`[ESP32 Serial] Reading ${config.side} insole`, {
        ax: reading.ax,
        ay: reading.ay,
        az: reading.az,
        gx: reading.gx,
        gy: reading.gy,
        gz: reading.gz
      });

      this.broadcast?.({
        type: "fsr_mpu_reading",
        source: "esp32_serial",
        serialConnected: true,
        mpuConnected: reading.mpu_ok,
        reading,
        timestamp: Date.now()
      });
      this.gaitBroadcast?.({
        side: config.side,
        deviceId: `${config.side}-insole`,
        reading,
        timestamp: Date.now()
      });
    }
  }

  emitStatus(config, serialConnected, error = null) {
    this.broadcast?.({
      type: "esp32_status",
      source: "esp32_serial",
      serialConnected,
      mpuConnected: null,
      error
    });
    this.gaitBroadcast?.({
      side: config.side,
      deviceId: `${config.side}-insole`,
      connected: serialConnected,
      error,
      timestamp: Date.now()
    });
  }

  scheduleReconnect(config) {
    if (!this.running || this.ports.has(config.side)) return;
    const reconnectTimer = setTimeout(() => {
      this.ports.delete(config.side);
      this.open(config);
    }, this.reconnectDelayMs);
    this.ports.set(config.side, {
      port: { removeAllListeners() {}, isOpen: false },
      buffer: "",
      reconnectTimer
    });
  }
}

export const esp32SensorSerialService = new Esp32SensorSerialService();
