require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const transbankService = require('./services/transbankService');

const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    logger.info(`Iniciando servidor en modo ${ENV}`);
    
    // Inicializar conexión con el POS (no bloqueante)
    transbankService.initializeConnection()
      .then(() => {
        if (transbankService.deviceConnected) {
          logger.info('Conexión con POS establecida correctamente');
        } else if (transbankService.simulationMode) {
          logger.warn('Modo simulación activado - No hay conexión real con POS');
        } else {
          logger.error('No se pudo conectar con el POS');
        }
      })
      .catch(error => {
        logger.error('Error en conexión POS:', error);
      });

    // Iniciar servidor HTTP independientemente de la conexión con POS
    const server = app.listen(PORT, () => {
      logger.info(`Servidor Transbank POS escuchando en puerto ${PORT}`);
      logger.info(`Commerce Code: ${process.env.TBK_COMMERCE_CODE || 'No configurado'}`);
      logger.info(`Terminal ID: ${process.env.TBK_TERMINAL_ID || 'No configurado'}`);
      
      if (transbankService.simulationMode) {
        logger.warn('ADVERTENCIA: El sistema está en modo simulación');
        logger.warn('Para conectar con un POS real, establezca FORCE_HARDWARE_CONNECTION=true');
      }
    });

    const gracefulShutdown = async (signal) => {
      logger.info(`Recibida señal ${signal}. Cerrando servidor...`);
      
      try {
        // Cerrar servidor HTTP con timeout
        await Promise.race([
          new Promise(resolve => server.close(resolve)),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout cerrando servidor')), 5000)
        )]);
        
        logger.info('Servidor HTTP cerrado');
        
        // Cerrar conexión con POS si existe
        await transbankService.closeConnection();
        logger.info('Conexiones cerradas correctamente');
      } catch (error) {
        logger.error('Error durante el shutdown:', error);
      } finally {
        process.exit(0);
      }
    };

    // Manejo de señales de terminación
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Manejo de excepciones no capturadas
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('Error crítico al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Iniciar la aplicación
startServer();