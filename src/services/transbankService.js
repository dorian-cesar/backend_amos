const { POSAutoservicio } = require('transbank-pos-sdk');
const autoReconnectPOS = require('../utils/posReconnect');
const logger = require('../utils/logger');

function TransbankService() {
  this.pos = new POSAutoservicio();
  this.connectedPort = null;

  // Deshabilitar mensajes de debug e intermedios
  this.pos.setDebug(false);
}

TransbankService.prototype.connectToPort = function (portPath) {
  var self = this;
  return this.pos.connect(portPath).then(function (response) {
    self.connectedPort = Object.assign({ path: portPath }, response);
    logger.info('Conectado manualmente al puerto ' + portPath);
    return response;
  });
};

TransbankService.prototype.listAvailablePorts = function () {
  return this.pos.listPorts().then(function (ports) {
    return ports.map(function (port) {
      return {
        path: port.path,
        manufacturer: port.manufacturer || 'Desconocido'
      };
    });
  });
};

TransbankService.prototype.enviarVenta = function (amount, ticketNumber) {
  var self = this;
  var sendSale = function () {
    var ticket = (ticketNumber + '').padEnd(20, '0').substring(0, 20);
    return self.pos.sale(amount, ticket).then(function (response) {
      logger.info('Venta enviada - Operación: ' + response.operationNumber);
      return response;
    });
  };

  if (!self.deviceConnected()) {
    logger.warn('POS desconectado al intentar enviar venta. Intentando reconexión previa...');
    return autoReconnectPOS().then(function (reconnected) {
      if (!reconnected) {
        throw new Error('No se pudo reconectar al POS');
      }
      return sendSale();
    });
  } else {
    return sendSale();
  }
};

TransbankService.prototype.enviarVentaReversa = function (amount, originalOperationNumber) {
  var self = this;
  var ticket = (originalOperationNumber + '').padEnd(20, '0').substring(0, 20);
  return self.pos.refund(amount, ticket, false)
    .then(function (response) {
      logger.info('Reversa exitosa - Operación: ' + response.operationNumber);
      return response;
    })
    .catch(function (error) {
      logger.error('Error durante la reversa:', error);
      throw error;
    });
};

TransbankService.prototype.getLastTransaction = function () {
  var self = this;
  return self.pos.getLastSale()
    .then(function (response) {
      logger.debug('Respuesta completa del POS:', JSON.stringify(response, null, 2));
      return {
        success: true,
        message: 'Transacción obtenida correctamente',
        data: {
          approved: response.successful,
          responseCode: response.responseCode === 0 ? '00' : 'UNKNOWN',
          operationNumber: response.operationNumber,
          amount: response.amount,
          cardNumber: response.last4Digits ? '••••' + response.last4Digits : null,
          authorizationCode: response.authorizationCode,
          timestamp: (response.realDate && response.realTime) ? response.realDate + ' ' + response.realTime : null,
          cardType: response.cardType,
          cardBrand: response.cardBrand,
          rawData: response
        }
      };
    })
    .catch(function (error) {
      logger.error('Error al obtener última transacción:', error);
      throw error;
    });
};

TransbankService.prototype.sendCloseCommand = function (printReport) {
  var self = this;
  if (typeof printReport === 'undefined') printReport = true;
  return self.pos.closeDay({ printOnPos: printReport }, false)
    .then(function (response) {
      logger.info('Cierre de terminal exitoso');
      return response;
    })
    .catch(function (error) {
      logger.error('Error durante el cierre de terminal:', error);
      throw error;
    });
};

TransbankService.prototype.loadKey = function () {
  var self = this;
  return self.pos.loadKeys()
    .then(function () {
      logger.info('Inicialización del terminal completada (llaves cargadas)');
      return { success: true, message: 'Llaves cargadas correctamente' };
    })
    .catch(function (error) {
      logger.error('Error al inicializar terminal (cargar llaves):', error);
      throw error;
    });
};

TransbankService.prototype.deviceConnected = function () {
  return this.connectedPort !== null;
};

TransbankService.prototype.connection = function () {
  return this.connectedPort;
};

TransbankService.prototype.closeConnection = function () {
  var self = this;
  if (self.connectedPort) {
    return self.pos.disconnect()
      .then(function () {
        logger.info('Conexión con POS cerrada correctamente');
        self.connectedPort = null;
      })
      .catch(function (error) {
        logger.error('Error al cerrar conexión con POS:', error.message);
        self.connectedPort = null;
      });
  } else {
    logger.warn('No hay conexión activa que cerrar');
    return Promise.resolve();
  }
};

module.exports = new TransbankService();
