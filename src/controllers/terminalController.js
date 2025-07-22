const transbankService = require('../services/transbankService');
const responseHandler = require('../utils/responseHandler');
const autoReconnectPOS = require('../utils/posReconnect');
const logger = require('../utils/logger');

const POLLING_INTERVAL_MS = 600000; // 10 minutos

let monitorActive = false;

function startPOSMonitor() {
  if (monitorActive) return Promise.resolve();
  monitorActive = true;

  setInterval(function () {
    if (!transbankService.deviceConnected) {
      autoReconnectPOS().catch(function (err) {
        logger.error('Error en autoReconnectPOS:', err);
      });
    }
  }, POLLING_INTERVAL_MS);

  return Promise.resolve();
}

exports.startHealthMonitor = function (req, res) {
  startPOSMonitor()
    .then(function () {
      responseHandler.success(res, 'Monitor de salud del POS iniciado');
    })
    .catch(function (error) {
      logger.error('Error al iniciar monitor de salud:', error);
      responseHandler.error(res, error.message, 500, 'MONITOR_START_ERROR');
    });
};

exports.startPOSMonitor = startPOSMonitor;

exports.closeTerminal = function (req, res) {
  var printReport = (req.body && typeof req.body.printReport !== 'undefined') ? req.body.printReport : true;

  transbankService.sendCloseCommand(printReport)
    .then(function (result) {
      responseHandler.success(res, 'Cierre de terminal exitoso', result);
    })
    .catch(function (error) {
      logger.error('Error en cierre de terminal:', error);
      responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
    });
};

exports.loadKey = function (req, res) {
  transbankService.loadKey()
    .then(function (result) {
      responseHandler.success(res, 'Inicialización del terminal completada', result);
    })
    .catch(function (error) {
      logger.error('Error inicializando terminal:', error);
      responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
    });
};

exports.getLastTransaction = function (req, res) {
  transbankService.getLastTransaction()
    .then(function (result) {
      responseHandler.success(res, result.message, result.data);
    })
    .catch(function (error) {
      logger.error('Error:', error);
      responseHandler.error(res, 'Error al obtener la transacción', 500);
    });
};

exports.listPorts = function (req, res) {
  transbankService.listAvailablePorts()
    .then(function (ports) {
      responseHandler.success(res, 'Puertos disponibles', ports);
    })
    .catch(function (error) {
      logger.error('Error al listar puertos:', error);
      responseHandler.error(res, error.message, 500, 'PORTS_LIST_ERROR');
    });
};

exports.conectarPuerto = function (req, res) {
  var portPath = (req.body && req.body.portPath) || process.env.TBK_PORT_PATH;

  if (!portPath) {
    return responseHandler.error(res, 'Debe proporcionar un puerto válido', 400, 'MISSING_PORT');
  }

  Promise.resolve()
    .then(function () {
      if (transbankService.deviceConnected) {
        return transbankService.closeConnection();
      }
    })
    .then(function () {
      return transbankService.connectToPort(portPath);
    })
    .then(function (result) {
      responseHandler.success(res, 'Conectado al puerto ' + portPath, result);
    })
    .catch(function (error) {
      logger.error('Error al conectar al puerto:', error);

      var errorCode = 'PORT_CONNECT_ERROR';
      var userMessage = error.message;

      if (error.message && error.message.indexOf('permission denied') !== -1) {
        errorCode = 'PORT_PERMISSION_DENIED';
        userMessage = 'Error de permisos en el puerto. Contacte al administrador';
      } else if (error.message && error.message.indexOf('not found') !== -1) {
        errorCode = 'PORT_NOT_FOUND';
        userMessage = 'Puerto no encontrado. Verifique la conexión física del POS';
      }

      responseHandler.error(res, userMessage, 500, errorCode);
    });
};

exports.statusPos = function (req, res) {
  try {
    var portPath = null;
    if (transbankService.connection && transbankService.connection.path) {
      portPath = transbankService.connection.path;
    }
    responseHandler.success(res, 'Estado del POS', {
      connected: !!transbankService.deviceConnected,
      port: portPath
    });
  } catch (error) {
    logger.error('Error al obtener estado de conexión:', error);
    responseHandler.error(res, error.message, 500, 'STATUS_ERROR');
  }
};

exports.autoReconnectPOS = autoReconnectPOS;
