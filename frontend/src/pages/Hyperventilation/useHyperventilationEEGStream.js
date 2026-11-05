import { useEffect, useRef, useState } from 'react';

// Vite env for stream URL
const WS_URL = import.meta.env.VITE_HV_WS || 'ws://localhost:5000/tests/hyperventilation/stream';

const clampArray = (arr, maxLen) => (arr.length > maxLen ? arr.slice(arr.length - maxLen) : arr);

export default function useHyperventilationEEGStream(testId) {
  const wsRef = useRef(null);
  const lastPacketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [eegData, setEegData] = useState([]);
  const [ecgData, setEcgData] = useState([]);
  const [hr, setHr] = useState(0);
  const [bands, setBands] = useState({ delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 });
  const [spikeDetected, setSpikeDetected] = useState(false);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const connect = (overrideTestId) => {
    if (wsRef.current) wsRef.current.close();
    lastPacketRef.current = null;
    const idToUse = overrideTestId || testId;
    const ws = new WebSocket(WS_URL + (idToUse ? `?testId=${idToUse}` : ''));
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = (e) => console.error('HV WS error', e);
    ws.onmessage = (evt) => {
      try {
        const d = JSON.parse(evt.data);
        if (Array.isArray(d.eeg_raw)) {
          const samples = d.eeg_raw.map(Number).filter(Number.isFinite);
          const packetKey = `${d.timestamp ?? ''}:${samples.length}:${samples[samples.length - 1] ?? ''}`;
          if (samples.length > 0 && packetKey !== lastPacketRef.current) {
            lastPacketRef.current = packetKey;
            setEegData(prev => clampArray(prev.concat(samples), 1024));
          }
        }
        if (Array.isArray(d.ecg_raw)) {
          const samples = d.ecg_raw.map(Number).filter(Number.isFinite);
          setEcgData(prev => clampArray(prev.concat(samples), 1024));
        }
        if (d.bands) setBands(d.bands);
        if (typeof d.hr !== 'undefined') setHr(d.hr);
        if (d.spikeDetected) {
          setSpikeDetected(true);
          setTimeout(() => setSpikeDetected(false), 800);
        }
      } catch (e) { console.error('hv ws parse', e); }
    };
  };

  const disconnect = () => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) { }
      wsRef.current = null;
    }
    setConnected(false);
  };

  return { eegData, ecgData, hr, bands, spikeDetected, connected, connect, disconnect };
}
