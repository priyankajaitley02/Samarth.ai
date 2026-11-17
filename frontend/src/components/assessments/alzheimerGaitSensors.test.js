import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAlzheimerSensorPacket,
  createAlzheimerSensorState,
  createAlzheimerSensorStream,
  expireAlzheimerSensorState,
  FSR_SENSOR_KEYS,
  getRealAssessmentSensorBuffer,
  hasCompleteBilateralSensorReadings,
  INSOLE_RETRY_WINDOW_MS,
  SENSOR_STALE_AFTER_MS
} from './alzheimerGaitSensors.js';
import { selectAssessmentComponent } from './assessmentSelection.js';

const makeReading = (overrides = {}) => ({
  fsr1: 1,
  fsr2: 2,
  fsr3: 3,
  fsr4: 4,
  fsr5: 5,
  fsr6: 6,
  ax: 1,
  ay: 2,
  az: 3,
  gx: 4,
  gy: 5,
  gz: 6,
  mpu_ok: true,
  ...overrides
});

const makePacket = (side, reading = makeReading(), timestamp = 1000) => ({
  type: 'esp32_insole_data',
  source: 'esp32_wifi',
  deviceId: `${side}-insole`,
  timestamp,
  alzheimerUpdate: {
    side,
    deviceId: `${side}-insole`,
    reading
  }
});

test('accepts either insole as the first genuine device connection', () => {
  for (const firstSide of ['left', 'right']) {
    const initial = createAlzheimerSensorState(0);
    const { state } = applyAlzheimerSensorPacket(
      initial,
      makePacket(firstSide),
      1000
    );
    const otherSide = firstSide === 'left' ? 'right' : 'left';
    assert.equal(state[`${firstSide}Foot`].connected, true);
    assert.equal(state[`${firstSide}Foot`].deviceId, `${firstSide}-insole`);
    assert.equal(state[`${otherSide}Foot`].connected, false);
    assert.equal(state[`${otherSide}Foot`].status, 'connecting');
  }
});

test('discovers and updates the second insole without refreshing the first side timestamp', () => {
  let state = createAlzheimerSensorState(0);
  state = applyAlzheimerSensorPacket(state, makePacket('right'), 1000).state;
  state = applyAlzheimerSensorPacket(state, makePacket('left'), 1500).state;
  const leftLastSeen = state.leftFoot.lastSeen;

  state = applyAlzheimerSensorPacket(state, makePacket('right', makeReading({ fsr1: 20 }), 2000), 2000).state;

  assert.equal(state.leftFoot.connected, true);
  assert.equal(state.leftFoot.lastSeen, leftLastSeen);
  assert.equal(state.rightFoot.fsr.sensor1, 20);
  assert.equal(state.leftFoot.fsr.sensor1, 1);
});

test('keeps six FSR positions, accepts genuine zero, and retains missing channels', () => {
  let state = createAlzheimerSensorState(0);
  state = applyAlzheimerSensorPacket(state, makePacket('left'), 1000).state;
  state = applyAlzheimerSensorPacket(
    state,
    makePacket('left', makeReading({ fsr1: 0, fsr2: null, fsr3: undefined }), 1500),
    1500
  ).state;

  assert.deepEqual(FSR_SENSOR_KEYS.map(key => state.leftFoot.fsr[key]), [0, 2, 3, 4, 5, 6]);
  assert.equal(state.leftFoot.fsr.sensor1, 0);
  assert.equal(state.leftFoot.fsrLastSeen.sensor2, 1000);
  assert.equal(state.rightFoot.fsr.sensor1, null);
});

test('displays the available channel when the rest of the first packet is missing', () => {
  const partialReading = makeReading({
    fsr1: 77,
    fsr2: null,
    fsr3: null,
    fsr4: null,
    fsr5: null,
    fsr6: null,
    ax: null,
    ay: null,
    az: null,
    gx: null,
    gy: null,
    gz: null,
    mpu_ok: false
  });
  const { state } = applyAlzheimerSensorPacket(
    createAlzheimerSensorState(0),
    makePacket('right', partialReading),
    1000
  );

  assert.equal(state.rightFoot.connected, true);
  assert.deepEqual(FSR_SENSOR_KEYS.map(key => state.rightFoot.fsr[key]), [77, null, null, null, null, null]);
});

test('updates IMU axes independently and maps accelerometer and gyroscope fields correctly', () => {
  let state = createAlzheimerSensorState(0);
  state = applyAlzheimerSensorPacket(state, makePacket('left'), 1000).state;
  state = applyAlzheimerSensorPacket(
    state,
    makePacket('left', makeReading({ ax: 0, ay: null, gx: null }), 1500),
    1500
  ).state;

  assert.deepEqual(state.leftFoot.imu.accel, { x: 0, y: 2, z: 3 });
  assert.deepEqual(state.leftFoot.imu.gyro, { x: 4, y: 5, z: 6 });
  assert.equal(state.leftFoot.imuLastSeen.accel.x, 1500);
  assert.equal(state.leftFoot.imuLastSeen.accel.y, 1000);
});

test('marks individual values stale and disconnects a silent device without replacing its readings', () => {
  let state = createAlzheimerSensorState(0);
  state = applyAlzheimerSensorPacket(
    state,
    makePacket('left', makeReading({ fsr1: 0 })),
    1000
  ).state;

  state = expireAlzheimerSensorState(state, 1000 + SENSOR_STALE_AFTER_MS + 1);

  assert.equal(state.leftFoot.connected, false);
  assert.equal(state.leftFoot.status, 'disconnected');
  assert.equal(state.leftFoot.fsr.sensor1, 0);
  assert.equal(state.leftFoot.fsrStale.sensor1, true);
  assert.equal(state.leftFoot.imuStale.accel.x, true);
});

test('reconnects a disconnected insole using only newly received hardware values', () => {
  let state = createAlzheimerSensorState(0);
  state = applyAlzheimerSensorPacket(state, makePacket('left'), 1000).state;
  state = expireAlzheimerSensorState(state, 1000 + SENSOR_STALE_AFTER_MS + 1);
  state = applyAlzheimerSensorPacket(
    state,
    makePacket('left', makeReading({ fsr1: 0 }), 5000),
    5000
  ).state;

  assert.equal(state.leftFoot.connected, true);
  assert.equal(state.leftFoot.status, 'connected');
  assert.equal(state.leftFoot.fsr.sensor1, 0);
  assert.equal(state.leftFoot.fsrStale.sensor1, false);
});

test('waits 18 seconds for an unconnected counterpart, then reports it disconnected', () => {
  let state = createAlzheimerSensorState(0);
  state = applyAlzheimerSensorPacket(state, makePacket('left'), 1000).state;
  assert.equal(state.rightFoot.status, 'connecting');
  assert.equal(state.rightFoot.retryUntil, 1000 + INSOLE_RETRY_WINDOW_MS);

  state = expireAlzheimerSensorState(state, 1000 + INSOLE_RETRY_WINDOW_MS);
  assert.equal(state.rightFoot.status, 'disconnected');
});

test('requires fresh complete bilateral hardware data before returning assessment samples', () => {
  let state = createAlzheimerSensorState(0);
  const leftPacket = makePacket('left');
  const rightPacket = makePacket('right');
  state = applyAlzheimerSensorPacket(state, leftPacket, 1000).state;
  assert.equal(hasCompleteBilateralSensorReadings(state, 1000), false);

  state = applyAlzheimerSensorPacket(state, rightPacket, 1000).state;
  assert.equal(hasCompleteBilateralSensorReadings(state, 1000), true);

  const samples = [
    { timestamp: 1000, deviceId: 'left-insole', source: 'esp32_wifi', leftFoot: {
      connected: true, deviceId: 'left-insole', fsr: { sensor1: 1, sensor2: 2, sensor3: 3, sensor4: 4, sensor5: 5, sensor6: 6 },
      imu: { accel: { x: 1, y: 2, z: 3 }, gyro: { x: 4, y: 5, z: 6 } }, mpuConnected: true
    } },
    { timestamp: 1000, deviceId: 'right-insole', source: 'esp32_wifi', rightFoot: {
      connected: true, deviceId: 'right-insole', fsr: { sensor1: 1, sensor2: 2, sensor3: 3, sensor4: 4, sensor5: 5, sensor6: 6 },
      imu: { accel: { x: 1, y: 2, z: 3 }, gyro: { x: 4, y: 5, z: 6 } }, mpuConnected: true
    } }
  ];
  assert.deepEqual(getRealAssessmentSensorBuffer(state, samples, 1000), samples);
  assert.equal(getRealAssessmentSensorBuffer(state, samples, 1000 + SENSOR_STALE_AFTER_MS + 1), undefined);
});

test('ignores non-hardware data and never includes it in saved assessment samples', () => {
  const initial = createAlzheimerSensorState(0);
  const simulated = applyAlzheimerSensorPacket(initial, {
    ...makePacket('left'),
    source: 'demo'
  }, 1000);
  assert.equal(simulated.state, initial);
  assert.equal(simulated.sample, null);
  assert.equal(getRealAssessmentSensorBuffer(initial, [{
    timestamp: 1000,
    deviceId: 'left-insole',
    source: 'demo'
  }], 1000), undefined);
});

test('rejects packets whose device identifier does not match the reported foot', () => {
  const initial = createAlzheimerSensorState(0);
  const result = applyAlzheimerSensorPacket(initial, {
    ...makePacket('left'),
    alzheimerUpdate: {
      side: 'left',
      deviceId: 'right-insole',
      reading: makeReading()
    }
  }, 1000);

  assert.equal(result.state, initial);
  assert.equal(result.sample, null);
});

test('reconnects the backend subscription once after a drop and start is idempotent', async () => {
  const sockets = [];
  class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 3;
    constructor(url) {
      this.url = url;
      this.readyState = FakeWebSocket.CONNECTING;
      sockets.push(this);
    }
    close() {
      this.readyState = FakeWebSocket.CLOSED;
      this.onclose?.();
    }
  }

  const stream = createAlzheimerSensorStream({
    WebSocketImpl: FakeWebSocket,
    url: 'ws://localhost/ws/sensors?assessment=alzheimers',
    reconnectDelayMs: 5,
    onData: () => {}
  });
  stream.start();
  stream.start();
  assert.equal(sockets.length, 1);
  sockets[0].readyState = FakeWebSocket.OPEN;
  sockets[0].close();
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(sockets.length, 2);
  stream.start();
  assert.equal(sockets.length, 2);
  stream.stop();
});

test('uses the Alzheimer-only component and leaves Parkinson gait on its original component', () => {
  const sharedComponent = () => 'shared';
  const alzheimerComponent = () => 'alzheimers';
  assert.equal(selectAssessmentComponent({
    assessmentId: 'gaitAnalysis',
    disorder: 'alzheimers',
    defaultComponent: sharedComponent,
    alzheimerGaitComponent: alzheimerComponent
  }), alzheimerComponent);
  assert.equal(selectAssessmentComponent({
    assessmentId: 'gaitAnalysis',
    disorder: 'parkinsons',
    defaultComponent: sharedComponent,
    alzheimerGaitComponent: alzheimerComponent
  }), sharedComponent);
});
