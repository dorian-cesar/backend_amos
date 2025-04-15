require('dotenv').config(); // Carga variables de entorno desde .env
const app = require('./app');
const { configureIntegration } = require('./config/transbankConfig');
const logger = require('./utils/logger'); // Asumiendo que crearemos un logger

// Configuración inicial de Transbank
configureIntegration();

// Manejo de excepciones no capturadas
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Configuración del puerto
const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';

// Iniciar servidor
const server = app.listen(PORT, () => {
  logger.info(`Servidor Transbank POS corriendo en modo ${ENV}`);
  logger.info(`Escuchando en puerto ${PORT}`);
  logger.info(`Configuración Commerce Code: ${process.env.TBK_COMMERCE_CODE}`);
});

// Manejo elegante de shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido. Cerrando servidor...');
  server.close(() => {
    logger.info('Servidor cerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT recibido. Cerrando servidor...');
  server.close(() => {
    logger.info('Servidor cerrado');
    process.exit(0);
  });
});

// Exportar para testing (si es necesario)
module.exports = server;