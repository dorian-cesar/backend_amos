require('express-async-errors'); 
const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./utils/logger');
const path = require('path');

const paymentController = require('./controllers/paymentController');
const terminalController = require('./controllers/terminalController');
const transbankService = require('./services/transbankService');

const app = express();

// Middleware CORS según entorno
var corsOptions = process.env.NODE_ENV === 'development'
  ? { origin: '*', credentials: false }
  : {
      origin: (process.env.ALLOWED_ORIGINS || '').split(','),
      credentials: true
    };

app.use(cors(corsOptions));

app.use(bodyParser.json({
  limit: '10mb',
  verify: function (req, res, buf) {
    req.rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({ extended: true }));

// Rutas de pagos
app.post('/api/payment', paymentController.processPayment);
app.post('/api/refund', paymentController.processRefund);

// Rutas del terminal POS
app.post('/api/terminal/cierre-diario', terminalController.closeTerminal);
app.post('/api/terminal/loadKeys', terminalController.loadKey);
app.get('/api/terminal/last-transaction', terminalController.getLastTransaction);
app.get('/api/terminal/ports', terminalController.listPorts);
app.post('/api/terminal/connect', terminalController.conectarPuerto);
app.get('/api/terminal/status', terminalController.statusPos); 
app.post('/api/terminal/start-monitor', terminalController.startHealthMonitor);

app.post('/api/terminal/release-port', function (req, res) {
  transbankService.closeConnection()
    .then(function () {
      res.status(200).json({ status: 'success', message: 'Puerto liberado manualmente' });
    })
    .catch(function (error) {
      res.status(500).json({ status: 'error', message: error.message, code: 'PORT_RELEASE_FAILED' });
    });
});

app.get('/tester', function (req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta de health check
app.get('/health', function (req, res) {
  res.status(200).json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta simple de monitoreo del servidor
app.get('/monitor', function (req, res) {
  res.json({ success: true, server: true });
});

// Manejo de errores generales
app.use(function (err, req, res, next) {
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
app.use(function (req, res) {
  res.status(404).json({
    error: 'Endpoint no encontrado'
  });
});

// Captura errores fatales para evitar que caiga el servidor
process.on('uncaughtException', function (err) {
  logger.error('❌ uncaughtException:', err);
});

process.on('unhandledRejection', function (reason, promise) {
  logger.error('❌ unhandledRejection:', reason);
});

module.exports = app;
