export const FSR_SENSOR_KEYS = Object.freeze([
  'sensor1',
  'sensor2',
  'sensor3',
  'sensor4',
  'sensor5',
  'sensor6'
]);

export const INSOLE_RETRY_WINDOW_MS = 18000;
export const SENSOR_STALE_AFTER_MS = 3000;
export const MAX_SENSOR_PACKETS = 3000;

const SIDES = ['left', 'right'];
const IMU_GROUPS = ['accel', 'gyro'];
const IMU_AXES = ['x', 'y', 'z'];
const sideFromDeviceId = (deviceId) => {
  const value = String(deviceId || '').toLowerCase();
  if (value.includes('left')) return 'left';
  if (value.includes('right')) return 'right';
  return null;
};

const isValidReading = (value) => (
  typeof value === 'number' && Number.isFinite(value)
);

const createFootState = (side, now) => ({
  deviceId: `${side}-insole`,
  connected: false,
  status: 'connecting',
  lastSeen: null,
  retryUntil: now + INSOLE_RETRY_WINDOW_MS,
  fsr: Object.fromEntries(FSR_SENSOR_KEYS.map(key => [key, null])),
  fsrLastSeen: Object.fromEntries(FSR_SENSOR_KEYS.map(key => [key, null])),
  fsrStale: Object.fromEntries(FSR_SENSOR_KEYS.map(key => [key, false])),
  imu: {
    accel: { x: null, y: null, z: null },
    gyro: { x: null, y: null, z: null }
  },
  imuLastSeen: {
    accel: { x: null, y: null, z: null },
    gyro: { x: null, y: null, z: null }
  },
  imuStale: {
    accel: { x: false, y: false, z: false },
    gyro: { x: false, y: false, z: false }
  },
  mpuConnected: false
});

export const createAlzheimerSensorState = (now = Date.now()) => ({
  streamConnected: false,
  timestamp: null,
  leftFoot: createFootState('left', now),
  rightFoot: createFootState('right', now)
});

const isCompleteFootSample = (foot, now) => (
  foot?.connected === true &&
  foot.mpuConnected === true &&
  FSR_SENSOR_KEYS.every(key => (
    isValidReading(foot.fsr?.[key]) &&
    foot.fsrLastSeen?.[key] !== null &&
    now - foot.fsrLastSeen[key] <= SENSOR_STALE_AFTER_MS
  )) &&
  IMU_GROUPS.every(group => IMU_AXES.every(axis => (
    isValidReading(foot.imu?.[group]?.[axis]) &&
    foot.imuLastSeen?.[group]?.[axis] !== null &&
    now - foot.imuLastSeen[group][axis] <= SENSOR_STALE_AFTER_MS
  )))
);

const footFromFlatReading = (reading, deviceId) => ({
  deviceId,
  connected: true,
  mpuConnected: reading.mpu_ok,
  fsr: Object.fromEntries(FSR_SENSOR_KEYS.map((key, index) => [
    key,
    reading[`fsr${index + 1}`]
  ])),
  imu: {
    accel: { x: reading.ax, y: reading.ay, z: reading.az },
    gyro: { x: reading.gx, y: reading.gy, z: reading.gz }
  }
});

const updateFoot = (current, incoming, deviceId, now) => {
  if (!incoming || incoming.connected === false) return current;

  const fsr = { ...current.fsr };
  const fsrLastSeen = { ...current.fsrLastSeen };
  const fsrStale = { ...current.fsrStale };
  const imu = {
    accel: { ...current.imu.accel },
    gyro: { ...current.imu.gyro }
  };
  const imuLastSeen = {
    accel: { ...current.imuLastSeen.accel },
    gyro: { ...current.imuLastSeen.gyro }
  };
  const imuStale = {
    accel: { ...current.imuStale.accel },
    gyro: { ...current.imuStale.gyro }
  };
  let changed = false;

  for (const key of FSR_SENSOR_KEYS) {
    if (!isValidReading(incoming.fsr?.[key])) continue;
    fsr[key] = incoming.fsr[key];
    fsrLastSeen[key] = now;
    fsrStale[key] = false;
    changed = true;
  }

  const acceptImu = incoming.mpuConnected !== false;
  if (acceptImu) {
    for (const group of IMU_GROUPS) {
      for (const axis of IMU_AXES) {
        const value = incoming.imu?.[group]?.[axis];
        if (!isValidReading(value)) continue;
        imu[group][axis] = value;
        imuLastSeen[group][axis] = now;
        imuStale[group][axis] = false;
        changed = true;
      }
    }
  }

  if (!changed) return current;

  return {
    ...current,
    deviceId: deviceId || current.deviceId,
    connected: true,
    status: 'connected',
    lastSeen: now,
    retryUntil: now + INSOLE_RETRY_WINDOW_MS,
    fsr,
    fsrLastSeen,
    fsrStale,
    imu,
    imuLastSeen,
    imuStale,
    mpuConnected: incoming.mpuConnected === true
      ? true
      : incoming.mpuConnected === false
        ? false
        : IMU_GROUPS.some(group => IMU_AXES.some(axis => isValidReading(incoming.imu?.[group]?.[axis])))
          ? true
          : current.mpuConnected
  };
};

const markDisconnected = (foot, deviceId, now) => ({
  ...foot,
  deviceId: deviceId || foot.deviceId,
  connected: false,
  status: 'disconnected',
  retryUntil: now + INSOLE_RETRY_WINDOW_MS
});

const makeSensorSample = (side, foot, timestamp, source, now) => {
  if (!isCompleteFootSample(foot, now)) return null;
  return {
    timestamp,
    deviceId: foot.deviceId,
    source,
    [side === 'left' ? 'leftFoot' : 'rightFoot']: {
      connected: true,
      deviceId: foot.deviceId,
      fsr: { ...foot.fsr },
      imu: {
        accel: { ...foot.imu.accel },
        gyro: { ...foot.imu.gyro }
      },
      mpuConnected: true
    }
  };
};

const isHardwareSource = (source) => (
  source === 'esp32_wifi' ||
  source === 'esp32_serial' ||
  source === 'esp32_state' ||
  source === 'esp32'
);

const applyReading = (state, side, incoming, deviceId, now, source, timestamp) => {
  const key = `${side}Foot`;
  const before = state[key];
  const after = updateFoot(before, incoming, deviceId, now);
  if (after === before) return { state, sample: null };

  const next = { ...state, [key]: after };
  const otherKey = side === 'left' ? 'rightFoot' : 'leftFoot';
  const other = next[otherKey];
  if (!state.leftFoot.connected && !state.rightFoot.connected && !other.connected) {
    next[otherKey] = {
      ...other,
      status: 'connecting',
      retryUntil: now + INSOLE_RETRY_WINDOW_MS
    };
  }

  const sample = source === 'esp32_wifi' || source === 'esp32_serial'
    ? makeSensorSample(side, after, timestamp, source, now)
    : null;
  return { state: next, sample };
};

export const applyAlzheimerSensorPacket = (state, data, now = Date.now()) => {
  if (data?.type !== 'esp32_insole_data' || !isHardwareSource(data.source)) {
    return { state, sample: null };
  }

  const timestamp = isValidReading(data.timestamp) ? data.timestamp : now;

  if (data.alzheimerUpdate) {
    const update = data.alzheimerUpdate;
    const side = update.side;
    if (!SIDES.includes(side) || sideFromDeviceId(update.deviceId) !== side) {
      return { state, sample: null };
    }
    if (update.connected === false) {
      const key = `${side}Foot`;
      return {
        state: { ...state, [key]: markDisconnected(state[key], update.deviceId, now) },
        sample: null
      };
    }
    if (!update.reading) return { state, sample: null };

    return applyReading(
      state,
      side,
      footFromFlatReading(update.reading, update.deviceId),
      update.deviceId,
      now,
      update.source || data.source,
      timestamp
    );
  }

  const packetSide = sideFromDeviceId(data.deviceId);
  const sourceIsSnapshot = data.source === 'esp32_state';
  let next = state;
  let sample = null;

  for (const side of SIDES) {
    if (!sourceIsSnapshot && packetSide !== side) continue;
    const incoming = data[`${side}Foot`];
    if (!incoming) continue;

    const deviceId = incoming.deviceId || (packetSide === side ? data.deviceId : null);
    if (sideFromDeviceId(deviceId) !== side) continue;

    if (incoming.connected === false) {
      if (next[`${side}Foot`].connected) {
        next = {
          ...next,
          [`${side}Foot`]: markDisconnected(next[`${side}Foot`], deviceId, now)
        };
      }
      continue;
    }

    const result = applyReading(
      next,
      side,
      incoming,
      deviceId,
      now,
      data.source,
      timestamp
    );
    next = result.state;
    sample = result.sample || sample;
  }

  if (next === state) return { state, sample: null };
  return { state: { ...next, timestamp }, sample };
};

export const expireAlzheimerSensorState = (state, now = Date.now()) => {
  let changed = false;
  const next = { ...state };

  for (const side of SIDES) {
    const key = `${side}Foot`;
    const foot = state[key];
    const fsrStale = { ...foot.fsrStale };
    const imuStale = {
      accel: { ...foot.imuStale.accel },
      gyro: { ...foot.imuStale.gyro }
    };
    let footChanged = false;

    for (const sensorKey of FSR_SENSOR_KEYS) {
      const lastSeen = foot.fsrLastSeen[sensorKey];
      const stale = lastSeen !== null && now - lastSeen > SENSOR_STALE_AFTER_MS;
      if (fsrStale[sensorKey] !== stale) {
        fsrStale[sensorKey] = stale;
        footChanged = true;
      }
    }
    for (const group of IMU_GROUPS) {
      for (const axis of IMU_AXES) {
        const lastSeen = foot.imuLastSeen[group][axis];
        const stale = lastSeen !== null && now - lastSeen > SENSOR_STALE_AFTER_MS;
        if (imuStale[group][axis] !== stale) {
          imuStale[group][axis] = stale;
          footChanged = true;
        }
      }
    }

    const disconnected = foot.connected &&
      foot.lastSeen !== null &&
      now - foot.lastSeen > SENSOR_STALE_AFTER_MS;
    if (disconnected) footChanged = true;

    if (!foot.connected && foot.status === 'connecting' && now >= foot.retryUntil) {
      next[key] = { ...foot, status: 'disconnected', fsrStale, imuStale };
      changed = true;
      continue;
    }
    if (footChanged) {
      next[key] = {
        ...foot,
        connected: disconnected ? false : foot.connected,
        status: disconnected ? 'disconnected' : foot.status,
        fsrStale,
        imuStale
      };
      changed = true;
    }
  }

  return changed ? next : state;
};

export const hasCompleteBilateralSensorReadings = (state, now = Date.now()) => (
  isCompleteFootSample(state?.leftFoot, now) &&
  isCompleteFootSample(state?.rightFoot, now)
);

const isCompleteStoredSample = (packet, side) => {
  const foot = packet?.[side === 'left' ? 'leftFoot' : 'rightFoot'];
  return (
    (packet?.source === 'esp32_wifi' || packet?.source === 'esp32_serial') &&
    isValidReading(packet.timestamp) &&
    sideFromDeviceId(packet.deviceId) === side &&
    foot?.connected === true &&
    foot.mpuConnected === true &&
    FSR_SENSOR_KEYS.every(key => isValidReading(foot.fsr?.[key])) &&
    IMU_GROUPS.every(group => IMU_AXES.every(axis => isValidReading(foot.imu?.[group]?.[axis])))
  );
};

export const getRealAssessmentSensorBuffer = (sensorData, packets, now = Date.now()) => {
  if (!hasCompleteBilateralSensorReadings(sensorData, now) || !Array.isArray(packets)) {
    return undefined;
  }

  const realPackets = packets.filter(packet => (
    isCompleteStoredSample(packet, 'left') ||
    isCompleteStoredSample(packet, 'right')
  ));
  const sidesWithSamples = new Set(
    realPackets.flatMap(packet => [
      isCompleteStoredSample(packet, 'left') ? 'left' : null,
      isCompleteStoredSample(packet, 'right') ? 'right' : null
    ]).filter(Boolean)
  );

  return sidesWithSamples.has('left') && sidesWithSamples.has('right')
    ? realPackets
    : undefined;
};

export const createAlzheimerSensorStream = ({
  WebSocketImpl,
  url,
  onData,
  onStatus = () => {},
  reconnectDelayMs = 1000
}) => {
  let socket = null;
  let reconnectTimer = null;
  let stopped = true;

  const connect = () => {
    if (stopped || (socket && (
      socket.readyState === WebSocketImpl.CONNECTING ||
      socket.readyState === WebSocketImpl.OPEN
    ))) return;

    const currentSocket = new WebSocketImpl(url);
    socket = currentSocket;
    currentSocket.onopen = () => {
      if (socket === currentSocket && !stopped) onStatus(true);
    };
    currentSocket.onmessage = event => {
      if (socket !== currentSocket || stopped) return;
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      onData(data);
    };
    currentSocket.onerror = () => currentSocket.close();
    currentSocket.onclose = () => {
      if (socket !== currentSocket) return;
      socket = null;
      onStatus(false);
      if (!stopped && reconnectTimer === null) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, reconnectDelayMs);
      }
    };
  };

  return {
    start() {
      stopped = false;
      connect();
    },
    stop() {
      stopped = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      const currentSocket = socket;
      socket = null;
      if (currentSocket) {
        currentSocket.onopen = null;
        currentSocket.onmessage = null;
        currentSocket.onerror = null;
        currentSocket.onclose = null;
        currentSocket.close();
      }
      onStatus(false);
    }
  };
};
