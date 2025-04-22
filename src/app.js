const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./utils/logger');

const paymentController = require('./controllers/paymentController');
const terminalController = require('./controllers/terminalController');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({ extended: true }));

// Logging de requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Rutas de pagos
app.post('/api/payment', paymentController.processPayment);
app.post('/api/refund', paymentController.processRefund);

// Rutas del terminal POS
app.post('/api/terminal/close', terminalController.closeTerminal);
app.post('/api/terminal/initialize', terminalController.initializeTerminal);
app.get('/api/terminal/last-transaction', terminalController.getLastTransaction);
app.get('/api/terminal/ports', terminalController.listPorts);
app.post('/api/terminal/reconnect', terminalController.reconnectPOS);
app.post('/api/terminal/connect', terminalController.connectToSpecificPort);
app.get('/api/terminal/status', terminalController.checkConnectionStatus);

// Ruta de health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Manejo de errores generales
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    body: req.body
  });

  res.status(500).json({
    error: err.message || 'Algo salió mal',
    code: err.responseCode || 'INTERNAL_ERROR'
  });
});

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado'
  });
});

module.exports = app;
