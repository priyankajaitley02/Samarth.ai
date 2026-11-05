import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import expressWs from 'express-ws';
import userRoutes from './routes/user.js';
import { registerNeuroWs, registerDeviceWs } from './routes/neuroAssessment.js';
import neuroRouter from './routes/neuroAssessment.js';
import tremorRouter, { registerTremorWs } from './routes/tremor.js';
import * as hvWs from './controllers/hyperventilationWebSocket.js';
import neuroService from './services/neuroService.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import specializedAssessmentRoutes from './routes/specialized-assessments.js';
import authRoutes from './routes/auth.js';
import diagnosticRoutes from './routes/diagnosticRoutes.js';
import apiRoutes from './routes/api.js';
import { requestLogger } from './middleware/requestLogger.js';
import { startSimulator } from './services/neuroSimulator.js';
import neuroBotRoutes from './routes/neuroBot.routes.js';
import { gaitAnalysisController } from './controllers/gaitAnalysisController.js';
import { esp32SensorSerialService } from './services/esp32SensorSerial.service.js';
import { tremorService } from './services/tremorService.js';
import {
  parseEsp32CsvLine,
  normalizeEsp32JsonPacket,
  createGaitSensorState,
  applyGaitSensorUpdate
} from './services/esp32SensorSerial.service.js';

// Wordlist processing now runs in-process via `services/wordlistWorker.js`

const app = express();

// attach express-ws so routers can define websocket endpoints (keeps integration minimal)
expressWs(app);

// Store WebSocket clients for sensor data broadcasting
const sensorClients = new Set();
const gaitDisconnectTimers = { left: null, right: null };
let gaitSensorState = createGaitSensorState();
const SENSOR_HEARTBEAT_INTERVAL_MS = 30000;

function broadcastGaitSensorUpdate(update) {
  const side = update.side;
  if (!gaitSensorState[side]) return;

  gaitSensorState = applyGaitSensorUpdate(gaitSensorState, update);

  if (gaitDisconnectTimers[side]) clearTimeout(gaitDisconnectTimers[side]);
  if (update.reading || update.connected) {
    gaitDisconnectTimers[side] = setTimeout(() => {
      broadcastGaitSensorUpdate({
        side,
        deviceId: update.deviceId,
        connected: false,
        timestamp: Date.now()
      });
    }, 2500);
  }

  broadcastGaitSensorState(update.source || "esp32", update.deviceId, update.timestamp);
}

function broadcastGaitSensorState(source, deviceId, timestamp = Date.now()) {
  const payload = {
    type: "esp32_insole_data",
    source,
    deviceId,
    leftFoot: gaitSensorState.left,
    rightFoot: gaitSensorState.right,
    timestamp
  };

  sensorClients.forEach((client) => {
    if (client.readyState === 1 && !client.isSensorProducer) {
      try {
        client.send(JSON.stringify(payload));
      } catch (error) {
        console.error("Error broadcasting Gait sensor data:", error.message);
      }
    }
  });
}

// WebSocket route for sensor data streaming
app.ws('/ws/sensors', (ws, req) => {
  console.log('✅ Sensor WebSocket client connected');
  sensorClients.add(ws);
  let serialBuffer = '';
  let deviceId = req.query?.deviceId || req.headers['x-device-id'] || null;
  let deviceSide = String(deviceId || '').toLowerCase().includes('right')
    ? 'right'
    : String(deviceId || '').toLowerCase().includes('left')
      ? 'left'
      : null;
  ws.isSensorProducer = Boolean(deviceSide);
  ws.isAlive = true;

  const heartbeatTimer = setInterval(() => {
    if (ws.isAlive === false) {
      console.warn('Terminating unresponsive sensor WebSocket client', {
        deviceId: deviceId || 'unknown'
      });
      ws.terminate();
      return;
    }

    ws.isAlive = false;
    ws.ping();
  }, SENSOR_HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  if (!ws.isSensorProducer) {
    broadcastGaitSensorState("esp32_state", deviceId);
  }
  
  ws.on('message', (msg) => {
    try {
      const text = typeof msg === 'string' ? msg : msg.toString('utf8');

      if (text.trim().startsWith('{')) {
        let packet;
        try {
          packet = normalizeEsp32JsonPacket(JSON.parse(text), deviceId);
        } catch (error) {
          console.warn('Ignoring malformed sensor JSON:', error.message);
          return;
        }

        if (!packet) {
          console.warn('Ignoring sensor JSON with unknown device or no sensor values');
          return;
        }

        if (!deviceSide) {
          deviceId = packet.deviceId;
          deviceSide = packet.side;
          ws.isSensorProducer = true;
          console.log('Identified sensor WebSocket client', {
            deviceId,
            side: deviceSide
          });
        }

        broadcastGaitSensorUpdate({
          side: packet.side,
          deviceId: packet.deviceId,
          reading: packet.reading,
          source: "esp32_wifi",
          timestamp: packet.timestamp
        });
        return;
      }

      serialBuffer += text;
      const lines = serialBuffer.split(/\r?\n/);
      serialBuffer = lines.pop() || '';

      for (const line of lines) {
        const parsed = parseEsp32CsvLine(line);
        if (parsed === 'header') continue;
        if (!parsed) {
          console.warn('Ignoring invalid sensor CSV message');
          continue;
        }
        if (!deviceSide) {
          console.warn('Ignoring sensor CSV without left/right deviceId');
          continue;
        }
        broadcastGaitSensorUpdate({
          side: deviceSide,
          deviceId,
          reading: parsed,
          source: "esp32_wifi",
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error processing sensor data:', error);
    }
  });

  ws.on('close', () => {
    console.log('❌ Sensor WebSocket client disconnected');
    clearInterval(heartbeatTimer);
    sensorClients.delete(ws);
    if (deviceSide) {
      broadcastGaitSensorUpdate({
        side: deviceSide,
        deviceId,
        connected: false,
        source: "esp32_wifi",
        timestamp: Date.now()
      });
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(heartbeatTimer);
    sensorClients.delete(ws);
    if (deviceSide) {
      broadcastGaitSensorUpdate({
        side: deviceSide,
        deviceId,
        connected: false,
        source: "esp32_wifi",
        timestamp: Date.now()
      });
    }
  });
});

// Register neuro WS route now that express-ws has been attached
registerNeuroWs(app);
// Register device WS route so ESP32 devices can stream directly
registerDeviceWs(app);
// Register tremor WS route (smart glove devices + viewers)
registerTremorWs(app);

// Register hyperventilation WS route so HV frontend clients can connect
if (typeof app.ws === 'function') {
  app.ws('/tests/hyperventilation/stream', function(ws, req) {
    console.log('[index.js] HV WebSocket connection attempt, URL:', req.url);
    try { 
      let testId = req.query?.testId;
      if (!testId && req.url) {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        testId = urlParams.get('testId');
          console.log('[index.js] Fallback URL parsing, extracted testId:', testId);
      }
      console.log('[HV WS] Client connecting with testId:', testId, 'from URL:', req.url);
      // Hard reject connections without a testId to avoid null saves
      if (!testId) {
        console.error('[HV WS] ERROR: No testId provided; closing connection to prevent data loss');
        try { ws.send(JSON.stringify({ error: 'testId parameter required' })); } catch (e) {}
        try { ws.close(); } catch (e) {}
        return;
      }
      hvWs.addClient(ws, testId); 
    } catch (e) { 
      console.error('[HV WS] Failed to add HV WS client:', e); 
    }
  });
} else {
  console.warn('express-ws not initialized, cannot register hyperventilation WS route');
}

// Bridge neuroService broadcasts to hyperventilation WS clients as well
try {
  const _origBroadcast = neuroService.broadcast.bind(neuroService);
  neuroService.broadcast = (payload) => {
    try { _origBroadcast(payload); } catch (e) { console.error('neuroService broadcast error', e); }
    try { 
      hvWs.broadcast(payload); 
    } catch (e) { 
      console.error('[index.js] hvWs.broadcast error:', e);
    }
  };
} catch (e) {
  console.warn('Failed to bridge neuroService broadcasts to hyperventilation WS', e);
}

// Mount neuro REST routes (provides /api/assessment/start, /api/assessment/stop, etc.)
app.use('/api/assessment', neuroRouter);
// Mount tremor REST routes
app.use('/api/tremor', tremorRouter);

// Middleware
app.use(cors({
  origin: ['https://samarth-app.vercel.app', 'http://localhost:5173'], // Fix CORS issue
  credentials: true
}));

// Request logger middleware
app.use(requestLogger);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Root route - moved above 404 middleware to prevent "GET /" 404 errors
app.get("/", (req, res) => {
  res.send("Server is running.");
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/specialized-assessments', specializedAssessmentRoutes);
// Mount the central API routes (tests, specialized endpoints)
app.use('/api', apiRoutes);
// Diagnostic routes (keep after main API routes)
app.use('/api', diagnosticRoutes);
// NeuroBot routes
app.use('/api/neurobot', neuroBotRoutes);  

// 404 Middleware (Handles unknown routes)
app.use((req, res, next) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.url}`
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/samarth") // Added fallback for local dev
  .then(async () => {
    console.log('Connected to MongoDB');
    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces for ESP32 connections
    
    // Get network interfaces before starting server
    const os = await import('os');
    const nets = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(`${name}: ${net.address}`);
        }
      }
    }
    
    app.listen(PORT, HOST, () => {
      console.log(`Server is running on ${HOST}:${PORT}`);
      console.log('✅ WebSocket /ws/sensors endpoint ready for gait sensor streaming');
      console.log('\n📡 Available network interfaces for ESP32:');
      addresses.forEach(addr => console.log(`  ✓ ${addr}`));
      console.log('\n⚠️  Update ESP32 firmware ws_host to one of the above IPs\n');
      
      // Optionally start the neuro data simulator for demos
      if (process.env.NEURO_SIMULATOR === 'true') {
        startSimulator();
      }

      esp32SensorSerialService.start(
        (payload) => tremorService.broadcastSensorData(payload),
        broadcastGaitSensorUpdate
      );
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false,
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : undefined
  });
});

export default app;
