const transbankService = require('../services/transbankService');
const responseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

exports.closeTerminal = async (req, res) => {
  try {
    const result = await transbankService.sendCloseCommand();
    responseHandler.success(res, 'Cierre de terminal exitoso', result);
  } catch (error) {
    logger.error('Error en cierre de terminal:', error);
    responseHandler.error(res, error.message, 500);
  }
};

exports.initializeTerminal = async (req, res) => {
  try {
    const result = await transbankService.initializeTerminal();
    responseHandler.success(res, 'Inicialización iniciada', result);
  } catch (error) {
    logger.error('Error inicializando terminal:', error);
    responseHandler.error(res, error.message, 500);
  }
};

exports.getLastTransaction = async (req, res) => {
  try {
    const result = await transbankService.getLastTransaction();
    responseHandler.success(res, 'Última transacción obtenida', result);
  } catch (error) {
    logger.error('Error obteniendo última transacción:', error);
    responseHandler.error(res, error.message, 500);
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