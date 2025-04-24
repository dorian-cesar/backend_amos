// Archivo: utils/posHealthMonitor.js

const transbankService = require('../services/transbankService');
const logger = require('../utils/logger');

const POLLING_INTERVAL_MS = 1000000; 

let monitorActive = false;

async function pollPOSHealth() {
  if (monitorActive) return;
  monitorActive = true;

  logger.info('🔄 Iniciando monitor de salud del POS');

  setInterval(async () => {
    try {
      if (!transbankService.deviceConnected) {
        logger.warn('📉 POS desconectado. Intentando reconexión...');
        await transbankService.connectToPort(process.env.TBK_PORT_PATH);
        logger.info('✅ POS reconectado exitosamente');
      } else {
        logger.info('✅ POS saludable y conectado');
      }
    } catch (error) {
      logger.error(`❌ Error durante verificación o reconexión del POS: ${error.message}`);
    }
  }, POLLING_INTERVAL_MS);
}

module.exports = pollPOSHealth;
