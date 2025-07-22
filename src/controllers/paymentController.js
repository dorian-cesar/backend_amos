const transbankService = require('../services/transbankService');
const responseHandler = require('../utils/responseHandler');
const axios = require('axios');

exports.processPayment = function (req, res) {
  const body = req.body;
  const amount = body.amount;
  const ticketNumber = body.ticketNumber;

  if (!amount || isNaN(amount) || amount <= 0) {
    return responseHandler.error(res, 'Monto inválido', 400, 'INVALID_AMOUNT');
  }

  if (!ticketNumber || typeof ticketNumber !== 'string') {
    return responseHandler.error(res, 'Número de ticket/boleta inválido', 400, 'INVALID_TICKET');
  }

  console.log('Iniciando transacción - Monto: ' + amount + ', Ticket: ' + ticketNumber);

  transbankService.enviarVenta(amount, ticketNumber)
    .then(function (result) {
      var responseCode = result && result.responseCode;

      responseHandler.success(res, 'Resultado operación', Object.assign({}, result));
    })
    .catch(function (error) {
      var messageLower = (error.message || '').toLowerCase();
      var isUserCancelled = messageLower.indexOf('cancelada') !== -1 || messageLower.indexOf('cancelado') !== -1;
      var isPosDisconnected = messageLower.indexOf('no se pudo conectar') !== -1 ||
                              messageLower.indexOf('pos no conectado') !== -1 ||
                              messageLower.indexOf('pos desconectado') !== -1;

      var statusCode = (isUserCancelled || isPosDisconnected) ? 400 : 500;
      var errorCode = 'UNKNOWN';
      var userMessage = 'Ocurrió un problema al procesar el pago';

      if (isUserCancelled) {
        errorCode = 'USER_CANCELLED';
        userMessage = 'Transacción cancelada por el usuario';
      } else if (isPosDisconnected) {
        errorCode = 'POS_DISCONNECTED';
        userMessage = 'El POS no está conectado';
      } else if (error.responseCode) {
        errorCode = error.responseCode;
      }

      console[isUserCancelled || isPosDisconnected ? 'warn' : 'error'](
        'Transacción ' + (isUserCancelled ? 'cancelada' : isPosDisconnected ? 'fallida por desconexión' : 'fallida') + ': ' + error.message,
        isUserCancelled || isPosDisconnected ? undefined : { stack: error.stack }
      );

      var meta = {};
      if (process.env.NODE_ENV === 'development') {
        meta.detail = error.message;
        meta.stack = error.stack;
      }

      responseHandler.error(res, userMessage, statusCode, errorCode, meta);
    });
};

exports.processRefund = function (req, res) {
  const body = req.body;
  const amount = body.amount;
  const originalOperationNumber = body.originalOperationNumber;

  if (!amount || isNaN(amount) || amount <= 0) {
    return responseHandler.error(res, 'Monto inválido', 400, 'INVALID_AMOUNT');
  }

  if (!originalOperationNumber) {
    return responseHandler.error(res, 'Número de operación original requerido', 400, 'MISSING_ORIGINAL_OPERATION');
  }

  console.log('Iniciando reversa - Monto: ' + amount + ', Operación original: ' + originalOperationNumber);

  transbankService.enviarVentaReversa(amount, originalOperationNumber)
    .then(function (result) {
      console.log('Reversa exitosa - Operación: ' + result.operationNumber);
      responseHandler.success(res, 'Reversa exitosa', result);
    })
    .catch(function (error) {
      console.error('Error en reversa: ' + error.message, { stack: error.stack });
      responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
    });
};
