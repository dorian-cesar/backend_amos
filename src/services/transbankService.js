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
    
    // Intenta conectar automáticamente al iniciar
    this.autoconnect().catch(err => {
      logger.error('Error en conexión inicial con POS:', err);
      // No activamos modo simulación, solo registramos el error
    });
  }
  
  async autoconnect() {
    try {
      const ports = await this.listAvailablePorts(true);
      const posPorts = ports.filter(port => {
        return port.manufacturer?.includes('Pax') || 
               port.path.includes('ACM') || 
               port.path.includes('USB');
      });
  
      if (posPorts.length === 0) {
        throw new Error('No se encontraron puertos con POS conectado');
      }
  
      posPorts.sort((a, b) => {
        const aPriority = a.path.includes('USB') ? 1 : 0;
        const bPriority = b.path.includes('USB') ? 1 : 0;
        return bPriority - aPriority;
      });
  
      for (const port of posPorts) {
        try {
          await this.connectToPort(port.path);
          logger.info(`Conexión exitosa con POS en ${port.path}`);
          return port;
        } catch (error) {
          logger.warn(`Fallo conexión con ${port.path}: ${error.message}`);
          continue;
        }
      }
  
      throw new Error('No se pudo establecer conexión con ningún puerto');
      
    } catch (error) {
      logger.error('Error en autoconnect:', error);
      this.deviceConnected = false;
      throw error; // Propagar el error en lugar de activar modo simulación
    }
  }

  async connectToPort(portPath) {
    return new Promise((resolve, reject) => {
      // Cerrar conexión existente si hay
      if (this.connection && this.connection.isOpen) {
        this.connection.close();
      }
  
      this.connection = new SerialPort({
        path: portPath,
        baudRate: config.baudRate,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false
      });
  
      // Configurar eventos
      this.connection.on('error', (err) => {
        logger.error(`Error en conexión con ${portPath}:`, err);
        this.deviceConnected = false;
        reject(err);
      });
  
      this.connection.on('open', () => {
        logger.info(`Conexión establecida con POS en ${portPath}`);
        this.deviceConnected = true;
        resolve();
      });
  
      this.connection.on('close', () => {
        logger.warn(`Conexión cerrada con ${portPath}`);
        this.deviceConnected = false;
      });
  
      // Abrir puerto
      this.connection.open();
    });
  }

  async sendToPos(message) {
    if (!this.deviceConnected) {
      throw new Error('El POS no está conectado');
    }

    if (!this.connection || !this.connection.isOpen) {
      throw new Error('La conexión con el POS no está activa');
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

  async sendSaleCommand(amount, ticketNumber, printVoucher = true, sendMessages = true) {
    const command = '0200';
    const fields = [
      amount.toString().padStart(9, '0'),
      ticketNumber.padEnd(20, ' '),
      printVoucher ? '1' : '0',
      sendMessages ? '1' : '0'
    ];
    
    const response = await this.sendToPos(buildMessage(command, fields));
    
    if (response.responseCode !== '00') {
      throw new Error(`Transacción rechazada: Código ${response.responseCode}`);
    }
    
    return response;
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

  async listAvailablePorts() {
    try {
      const ports = await SerialPort.list();
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || 'Desconocido',
        status: 'Disponible'
      }));
    } catch (error) {
      logger.error('Error al listar puertos:', error);
      throw new Error('No se pudieron listar los puertos. Verifique permisos.');
    }
  }

}

module.exports = new TransbankService();