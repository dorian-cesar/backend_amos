const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { configureIntegration } = require('./config/transbankConfig');

const app = express();

// Configurar Transbank
configureIntegration();

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rutas
app.use('/api/payment', require('./controllers/paymentController'));

module.exports = app;