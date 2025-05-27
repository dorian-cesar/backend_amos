const transbankService = require('../services/transbankService');
const responseHandler = require('../utils/responseHandler');
const autoReconnectPOS = require('../utils/posReconnect');
const logger = require('../utils/logger');

const POLLING_INTERVAL_MS = 600000; // 10 minutos

let monitorActive = false;

async function startPOSMonitor() {
  if (monitorActive) return;
  monitorActive = true;

  setInterval(async () => {
    try {
      if (!transbankService.deviceConnected) {
        await autoReconnectPOS();
      }
    } catch (error) {
      
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
    const portPath = req.body.portPath || process.env.TBK_PORT_PATH2;

    if (!portPath) {
      return responseHandler.error(res, 'Debe proporcionar un puerto válido', 400, 'MISSING_PORT');
    }

    // 1. Forzar cierre de conexión previa si existe
    if (transbankService.deviceConnected) {
      await transbankService.closeConnection();
      logger.warn(`Conexión previa cerrada forzosamente para reconectar a ${portPath}`);
    }

    // 2. Intentar reconexión (con reintentos)
    let retries = 3;
    let lastError = null;

    while (retries > 0) {
      try {
        const result = await transbankService.connectToPort(portPath);
        return responseHandler.success(res, `Conectado al puerto ${portPath}`, result);
      } catch (error) {
        lastError = error;
        retries--;
        logger.warn(`Fallo conexión a ${portPath}. Reintentos restantes: ${retries}`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
      }
    }

    // 3. Si falla después de reintentos
    throw new Error(`No se pudo reconectar a ${portPath}: ${lastError.message}`);
  } catch (error) {
    logger.error('Error al conectar al puerto:', error);
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