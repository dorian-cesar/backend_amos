const transbankService = require('../services/transbankService');
const responseHandler = require('../utils/responseHandler');
const axios = require('axios');

exports.processPayment = async (req, res) => {
  try {
    const { amount, ticketNumber } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('Monto inválido');
    }

    if (!ticketNumber || typeof ticketNumber !== 'string') {
      throw new Error('Número de ticket/boleta inválido');
    }

    console.log(`Iniciando transacción - Monto: ${amount}, Ticket: ${ticketNumber}`);

    const result = await transbankService.sendSaleCommand(amount, ticketNumber);

    responseHandler.success(res, 'Conexión exitosa', {
      ...result
    });
  } catch (error) {
    const messageLower = (error.message || '').toLowerCase();
    const isUserCancelled = messageLower.includes('cancelada') || messageLower.includes('cancelado');

    const statusCode = isUserCancelled ? 400 : 500;
    const errorCode = isUserCancelled ? 'USER_CANCELLED' : (error.responseCode || 'UNKNOWN');
    const userMessage = isUserCancelled
      ? 'Transacción cancelada por el usuario'
      : 'Ocurrió un problema al procesar el pago';

    console[isUserCancelled ? 'warn' : 'error'](
      `Transacción ${isUserCancelled ? 'cancelada' : 'fallida'}: ${error.message}`,
      isUserCancelled ? undefined : { stack: error.stack }
    );

    const meta = process.env.NODE_ENV === 'development' ? {
      detail: error.message,
      stack: error.stack
    } : {};

    responseHandler.error(res, userMessage, statusCode, errorCode, meta);
  }
};

exports.processRefund = async (req, res) => {
  try {
    const { amount, originalOperationNumber } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('Monto inválido');
    }

    if (!originalOperationNumber) {
      throw new Error('Número de operación original requerido');
    }

    console.log(`Iniciando reversa - Monto: ${amount}, Operación original: ${originalOperationNumber}`);

    const result = await transbankService.sendRefundCommand(amount, originalOperationNumber);

    console.log(`Reversa exitosa - Operación: ${result.operationNumber}`);
    responseHandler.success(res, 'Reversa exitosa', result);
  } catch (error) {
    console.error(`Error en reversa: ${error.message}`, { stack: error.stack });
    responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
  }
};


exports.closeTerminal = async (req, res) => {
  try {
    const { printReport = true } = req.body;

    console.log('Iniciando cierre de terminal');
    const result = await transbankService.sendCloseCommand(printReport);

    console.log('Cierre de terminal completado exitosamente');
    responseHandler.success(res, 'Cierre de terminal exitoso', result);
  } catch (error) {
    console.error(`Error en cierre de terminal: ${error.message}`, { stack: error.stack });
    responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
  }
};

exports.initializeTerminal = async (req, res) => {
  try {
    console.log('Iniciando carga de llaves del terminal');
    const result = await transbankService.initializeTerminal();

    console.log('Terminal inicializado exitosamente');
    responseHandler.success(res, 'Terminal inicializado', result);
  } catch (error) {
    console.error(`Error inicializando terminal: ${error.message}`, { stack: error.stack });
    responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
  }
};