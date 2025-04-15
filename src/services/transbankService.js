const { 
  calculateLRC, 
  buildMessage, 
  parseResponse, 
  validateACKNAK,
  constants 
} = require('../utils/posUtils');
const config = require('../config/transbankConfig');
const logger = require('../utils/logger');
const { SerialPort } = require('serialport');

class TransbankService {
  constructor() {
    this.connection = null;
    this.deviceConnected = false;
    this.simulationMode = process.env.NODE_ENV === 'development' && !process.env.FORCE_HARDWARE_CONNECTION;
    this.initializeConnection();
  }

  async initializeConnection() {
    try {
      if (this.simulationMode) {
        logger.warn('Modo desarrollo: Simulando conexión con POS');
        this.deviceConnected = true;
        return;
      }

      this.connection = new SerialPort({
        path: config.portPath || '/dev/ttyUSB0',
        baudRate: config.baudRate,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false
      });

      this.connection.on('error', (err) => {
        logger.error('Error en conexión serial:', err);
        this.deviceConnected = false;
      });

      this.connection.on('open', () => {
        logger.info('Conexión serial abierta correctamente');
        this.deviceConnected = true;
      });

      this.connection.on('close', () => {
        logger.warn('Conexión serial cerrada');
        this.deviceConnected = false;
      });

      await new Promise((resolve, reject) => {
        this.connection.open((err) => {
          if (err) {
            logger.error(`Error al abrir puerto serial ${config.portPath}:`, err);
            this.deviceConnected = false;
            return reject(err);
          }
          logger.info(`Conexión establecida con POS en ${config.portPath}`);
          this.deviceConnected = true;
          resolve();
        });
      });

    } catch (error) {
      logger.error('Error al inicializar conexión:', error);
      this.deviceConnected = false;
      
      if (process.env.NODE_ENV === 'production') {
        throw new Error('No se pudo inicializar la conexión con el POS');
      }
    }
  }

  async sendToPos(message) {
    if (this.simulationMode || !this.deviceConnected) {
      logger.warn('Modo simulación: Comando enviado a POS virtual');
      return this.simulatePosResponse(message);
    }

    if (!this.connection || !this.connection.isOpen) {
      throw new Error('El POS no está conectado');
    }

    return new Promise((resolve, reject) => {
      let responseBuffer = '';
      const timeout = setTimeout(() => {
        this.connection.removeAllListeners('data');
        reject(new Error('Timeout esperando respuesta del POS'));
      }, config.timeout);

      const dataHandler = (data) => {
        responseBuffer += data.toString();
        if (responseBuffer.includes(String.fromCharCode(constants.ETX))) {
          clearTimeout(timeout);
          this.connection.removeListener('data', dataHandler);
          try {
            if (validateACKNAK(responseBuffer)) {
              if (responseBuffer.charCodeAt(0) === constants.NAK) {
                throw new Error('POS rechazó el comando (NAK recibido)');
              }
              return;
            }
            const parsed = parseResponse(responseBuffer);
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        }
      };

      this.connection.on('data', dataHandler);
      this.connection.write(message, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.connection.removeListener('data', dataHandler);
          reject(err);
        }
      });
    });
  }

  async simulatePosResponse(message) {
    const command = message.substring(1, 5); // Extraer código de comando
    const fields = message.split(constants.SEPARATOR);
    
    const baseResponse = {
      command: command + '10',
      responseCode: '00',
      commerceCode: process.env.TBK_COMMERCE_CODE || '597012345678',
      terminalId: process.env.TBK_TERMINAL_ID || 'TERM001',
      rawResponse: message
    };

    switch(command) {
      case '0200': // Venta
        return {
          ...baseResponse,
          ticketNumber: fields[2]?.trim() || 'TEST' + Math.floor(Math.random() * 10000),
          authorizationCode: Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
          amount: fields[1]?.trim() || '000000000',
          last4Digits: Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
          operationNumber: Math.floor(Math.random() * 1000).toString().padStart(6, '0'),
          cardType: Math.random() > 0.5 ? 'CR' : 'DB',
          date: new Date().toISOString()
        };
      case '0250': // Última transacción
        return {
          ...baseResponse,
          ticketNumber: 'LAST' + Math.floor(Math.random() * 1000),
          amount: '000005000',
          last4Digits: '9876',
          operationNumber: '000123',
          cardType: 'CR'
        };
      case '0500': // Cierre
        return {
          ...baseResponse,
          reportData: 'Cierre simulado exitoso'
        };
      default:
        return baseResponse;
    }
  }

  async sendSaleCommand(amount, ticketNumber, printVoucher = true, sendMessages = true) {
    try {
      const command = '0200';
      const fields = [
        amount.toString().padStart(9, '0'),
        ticketNumber.padEnd(20, ' '),
        printVoucher ? '1' : '0',
        sendMessages ? '1' : '0'
      ];
      
      const response = await this.sendToPos(buildMessage(command, fields));
      
      if (response.responseCode !== '00') {
        throw Object.assign(
          new Error(`Transacción rechazada: Código ${response.responseCode}`),
          { responseCode: response.responseCode }
        );
      }
      
      return response;
    } catch (error) {
      logger.error('Error en sendSaleCommand:', error);
      throw error;
    }
  }

  async sendCloseCommand(printReport = true) {
    try {
      const response = await this.sendToPos(buildMessage('0500', [printReport ? '1' : '0']));
      
      if (response.responseCode !== '00') {
        throw Object.assign(
          new Error(`Cierre rechazado: Código ${response.responseCode}`),
          { responseCode: response.responseCode }
        );
      }
      
      await this.closeConnection();
      return response;
    } catch (error) {
      logger.error('Error en sendCloseCommand:', error);
      throw error;
    }
  }

  async getLastTransaction() {
    try {
      const response = await this.sendToPos(buildMessage('0250', ['1']));
      
      if (response.responseCode !== '00') {
        throw Object.assign(
          new Error(`Error obteniendo última transacción: Código ${response.responseCode}`),
          { responseCode: response.responseCode }
        );
      }
      
      return response;
    } catch (error) {
      logger.error('Error en getLastTransaction:', error);
      throw error;
    }
  }

  async initializeTerminal() {
    try {
      await this.sendToPos(buildMessage('0070', []));
      return { success: true, message: 'Inicialización iniciada' };
    } catch (error) {
      logger.error('Error en initializeTerminal:', error);
      throw error;
    }
  }

  async sendRefundCommand(amount, originalOperationNumber) {
    try {
      const fields = [
        amount.toString().padStart(9, '0'),
        originalOperationNumber.padStart(6, '0'),
        '1'
      ];
      
      const response = await this.sendToPos(buildMessage('0400', fields));
      
      if (response.responseCode !== '00') {
        throw Object.assign(
          new Error(`Reversa rechazada: Código ${response.responseCode}`),
          { responseCode: response.responseCode }
        );
      }
      
      return response;
    } catch (error) {
      logger.error('Error en sendRefundCommand:', error);
      throw error;
    }
  }

  async sendPollingCommand() {
    try {
      return await this.sendToPos(buildMessage('0100', []));
    } catch (error) {
      logger.error('Error en sendPollingCommand:', error);
      throw error;
    }
  }

  async closeConnection() {
    if (this.connection && this.connection.isOpen) {
      await new Promise((resolve) => {
        this.connection.close(resolve);
      });
    }
  }
}

module.exports = new TransbankService();