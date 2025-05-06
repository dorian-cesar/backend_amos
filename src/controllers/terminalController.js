const transbankService = require('../services/transbankService');
const responseHandler = require('../utils/responseHandler');
const autoReconnectPOS = require('../utils/posReconnect');
const logger = require('../utils/logger');

const POLLING_INTERVAL_MS = 150000; 

let monitorActive = false;

async function startPOSMonitor() {
  if (monitorActive) return;
  monitorActive = true;

  logger.info('🔄 Iniciando monitor de salud del POS');

  setInterval(async () => {
    try {
      if (!transbankService.deviceConnected) {
        logger.warn('📉 POS desconectado. Intentando reconexión...');
        const reconnected = await autoReconnectPOS();
        if (!reconnected) {
          logger.error('❌ Falló la reconexión automática del POS');
        }
      } else {
        logger.info('✅ POS saludable y conectado');
      }
    } catch (error) {
      logger.error(`❌ Error durante verificación o reconexión del POS: ${error.message}`);
    }
  }, POLLING_INTERVAL_MS);
}

exports.startHealthMonitor = async (req, res) => {
  try {
    await startPOSMonitor();
    responseHandler.success(res, 'Monitor de salud del POS iniciado');
  } catch (error) {
    logger.error('Error al iniciar monitor de salud:', error);
    responseHandler.error(res, error.message, 500, 'MONITOR_START_ERROR');
  }
};

exports.startPOSMonitor = startPOSMonitor;

exports.closeTerminal = async (req, res) => {
  try {
    const { printReport = true } = req.body;
    const result = await transbankService.sendCloseCommand(printReport);
    responseHandler.success(res, 'Cierre de terminal exitoso', result);
  } catch (error) {
    logger.error('Error en cierre de terminal:', error);
    responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
  }
};

exports.loadKey = async (req, res) => {
  try {
    const result = await transbankService.loadKey();
    responseHandler.success(res, 'Inicialización del terminal completada', result);
  } catch (error) {
    logger.error('Error inicializando terminal:', error);
    responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
  }
};

exports.getLastTransaction = async (req, res) => {
  try {
    const result = await transbankService.getLastTransaction();
    responseHandler.success(res, 'Última transacción obtenida', result);
  } catch (error) {
    logger.error('Error obteniendo última transacción:', error);
    responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
  }
};

exports.listPorts = async (req, res) => {
  try {
    const ports = await transbankService.listAvailablePorts();
    responseHandler.success(res, 'Puertos disponibles', ports);
  } catch (error) {
    logger.error('Error al listar puertos:', error);
    responseHandler.error(res, error.message, 500, 'PORTS_LIST_ERROR');
  }
};

exports.conectarPuerto = async (req, res) => {
  try {
    if (transbankService.deviceConnected && transbankService.connection) {
      return responseHandler.error(res, 'El POS ya está conectado', 400, 'POS_ALREADY_CONNECTED');
    }

    const portPath = req.body.portPath || process.env.TBK_PORT_PATH;

    if (!portPath) {
      return responseHandler.error(res, 'Debe proporcionar un puerto válido', 400, 'MISSING_PORT');
    }

    const result = await transbankService.connectToPort(portPath);
    responseHandler.success(res, `Conectado al puerto ${portPath}`, result);
  } catch (error) {
    logger.error('Error al conectar al puerto especificado:', error);
    responseHandler.error(res, error.message, 500, 'PORT_CONNECT_ERROR');
  }
};

exports.statusPos = async (req, res) => {
  try {
    responseHandler.success(res, 'Estado del POS', {
      connected: transbankService.deviceConnected,
      port: transbankService.connection?.path || null
    });
  } catch (error) {
    logger.error('Error al obtener estado de conexión:', error);
    responseHandler.error(res, error.message, 500, 'STATUS_ERROR');
  }
};

exports.autoReconnectPOS = autoReconnectPOS;
