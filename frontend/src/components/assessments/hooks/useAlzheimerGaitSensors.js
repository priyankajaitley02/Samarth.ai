import { useEffect, useRef, useState } from 'react';
import {
  applyAlzheimerSensorPacket,
  createAlzheimerSensorState,
  createAlzheimerSensorStream,
  expireAlzheimerSensorState,
  MAX_SENSOR_PACKETS
} from '../alzheimerGaitSensors.js';

const RECONNECT_DELAY_MS = 1000;
const SENSOR_STATUS_INTERVAL_MS = 500;

export const useAlzheimerGaitSensors = ({
  enabled,
  isRecordingRef,
  sensorBufferRef
}) => {
  const [sensorData, setSensorData] = useState(() => createAlzheimerSensorState());
  const [streamConnected, setStreamConnected] = useState(false);
  const sensorDataRef = useRef(sensorData);

  useEffect(() => {
    if (!enabled) return undefined;

    let active = true;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname || 'localhost';
    const stream = createAlzheimerSensorStream({
      WebSocketImpl: WebSocket,
      url: `${protocol}://${host}:5000/ws/sensors?assessment=alzheimers`,
      reconnectDelayMs: RECONNECT_DELAY_MS,
      onStatus: connected => {
        if (active) setStreamConnected(connected);
      },
      onData: data => {
        const { state, sample } = applyAlzheimerSensorPacket(
          sensorDataRef.current,
          data,
          Date.now()
        );
        if (state !== sensorDataRef.current) {
          sensorDataRef.current = state;
          setSensorData(state);
        }
        if (sample && isRecordingRef.current) {
          sensorBufferRef.current.push(sample);
          if (sensorBufferRef.current.length > MAX_SENSOR_PACKETS) {
            sensorBufferRef.current.shift();
          }
        }
      }
    });

    stream.start();
    const statusTimer = window.setInterval(() => {
      const current = sensorDataRef.current;
      const next = expireAlzheimerSensorState(current, Date.now());
      if (next !== current) {
        sensorDataRef.current = next;
        setSensorData(next);
      }
    }, SENSOR_STATUS_INTERVAL_MS);

    return () => {
      active = false;
      stream.stop();
      window.clearInterval(statusTimer);
    };
  }, [enabled, isRecordingRef, sensorBufferRef]);

  return {
    sensorData,
    streamConnected
  };
};
