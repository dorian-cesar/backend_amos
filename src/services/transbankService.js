const { POSAutoservicio } = require('transbank-pos-sdk');
const logger = require('../utils/logger');

class TransbankService {
  constructor() {
    this.pos = new POSAutoservicio();
    this.connectedPort = null;

    this.pos.setDebug(true);
  }

  async connectToPort(portPath) {
    const response = await this.pos.connect(portPath);
    this.connectedPort = { path: portPath, ...response };
    logger.info(`Conectado manualmente al puerto ${portPath}`);
    return response;
  }

  async listAvailablePorts() {
    const ports = await this.pos.listPorts();
    return ports.map(port => ({
      path: port.path,
      manufacturer: port.manufacturer || 'Desconocido'
    }));
  }

  async sendSaleCommand(amount, ticketNumber) {
    try {
      const ticket = ticketNumber.padEnd(20, '0').substring(0, 20);
      const response = await this.pos.sale(amount, ticket, true, false); // sendVoucher: true, sendStatus: false

      // Si no viene operationNumber, lo creamos usando timestamp
      // if (!response.operationNumber) {
      //   const now = Date.now();
      //   // tomar los últimos 3 dígitos de Date.now() y rellenar con ceros si es necesario
      //   const id3 = (now % 1000).toString().padStart(3, '0');
      //   response.operationNumber = id3;
      //   logger.warn(`operationNumber no existía; asignado: ${id3}`);
      // }

      // Registramos la respuesta completa (incluido el operationNumber recién añadido)
      logger.info(`Respuesta venta - Operación: ${JSON.stringify(response)}`);
      logger.info(`Venta exitosa - Operación: ${response.operationNumber}`);

      return response;
    } catch (error) {
      logger.error('Error durante la venta:', error);
      throw error;
    }
  }

  async sendRefundCommand(amount, originalOperationNumber) {
    try {
      const ticket = originalOperationNumber.padEnd(20, '0').substring(0, 20);
      const response = await this.pos.refund(amount, ticket);
      logger.info(`Reversa exitosa - Operación: ${response.operationNumber}`);
      return response;
    } catch (error) {
      logger.error('Error durante la reversa:', error);
      throw error;
    }
  }

  async getLastTransaction() {
    try {
      const response = await this.pos.lastSale(true, false); // sendVoucher: true
      logger.info(`Última transacción obtenida - Operación: ${response.operationNumber}`);
      return response;
    } catch (error) {
      logger.error('Error al obtener última transacción:', error);
      throw error;
    }
  }

  async sendCloseCommand(printReport = true) {
    try {
      const response = await this.pos.closeDay({ printOnPos: printReport });
      logger.info('Cierre de terminal exitoso');
      return response;
    } catch (error) {
      logger.error('Error durante el cierre de terminal:', error);
      throw error;
    }
  }

  async initializeTerminal() {
    try {
      await this.pos.loadKeys();
      logger.info('Inicialización del terminal completada (llaves cargadas)');
      return { success: true, message: 'Llaves cargadas correctamente' };
    } catch (error) {
      logger.error('Error al inicializar terminal (cargar llaves):', error);
      throw error;
    }
  }

  get deviceConnected() {
    return this.connectedPort !== null;
  }

  get connection() {
    return this.connectedPort;
  }

  async closeConnection() {
    if (this.connectedPort) {
      try {
        await this.pos.disconnect();
        console.log('Conexión con POS cerrada correctamente');
      } catch (error) {
        console.error('Error al cerrar conexión con POS:', error.message);
      } finally {
        this.connectedPort = null;
      }
    } else {
      console.warn('No hay conexión activa que cerrar');
    }
  }
}

module.exports = new TransbankService();