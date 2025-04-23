require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const transbankService = require('./services/transbankService');
const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    logger.info(`Iniciando servidor en modo ${ENV}`);
    
    try {
      const port = await transbankService.connectToPort(process.env.TBK_PORT_PATH);
      logger.info(`POS conectado a puerto fijo: ${port.path}`);
      logger.info(`Commerce Code: ${process.env.TBK_COMMERCE_CODE}`);
      logger.info(`Terminal ID: ${process.env.TBK_TERMINAL_ID}`);
    } catch (connectError) {
      logger.error('No se pudo conectar al puerto configurado del POS:', connectError.message);
    }

    // Iniciar servidor HTTP
    const server = app.listen(PORT, () => {
      logger.info(`Servidor Transbank POS escuchando en puerto ${PORT}`);
    });

    // Iniciar ngrok si está activado
    if (ENV === 'development' || process.env.ENABLE_NGROK === 'true') {
      try {
        const ngrok = require('@ngrok/ngrok');
        const listener = await ngrok.connect({
          addr: PORT,
          authtoken: process.env.NGROK_AUTHTOKEN
        });
        logger.info(`ngrok disponible en: ${listener.url()}`);
      } catch (ngrokError) {
        logger.error('Error al iniciar ngrok:', ngrokError.message);
      }
    }

    // Rutas de diagnóstico y control
    app.get('/api/terminal/ports', async (req, res) => {
      try {
        const ports = await transbankService.listAvailablePorts();
        res.status(200).json({
          status: 'success',
          ports: ports.map(port => ({
            ...port,
            isCurrent: transbankService.connection?.path === port.path,
            recommended: port.manufacturer?.includes('Pax') || port.path.includes('ACM')
          })),
          baudRate: process.env.TBK_BAUD_RATE
        });
      } catch (error) {
        logger.error('Error al listar puertos:', error.message);
        res.status(500).json({ status: 'error', message: 'No se pudieron listar los puertos', code: 'PORTS_LIST_ERROR' });
      }
    });

    app.post('/api/terminal/reconnect', async (req, res) => {
      try {
        const port = await transbankService.connectToPort(process.env.TBK_PORT_PATH);
        res.status(200).json({ status: 'success', message: `Reconectado a POS en ${port.path}`, port: port.path });
      } catch (error) {
        res.status(500).json({ status: 'error', message: error.message, code: 'RECONNECT_ERROR' });
      }
    });

    app.get('/api/terminal/status', (req, res) => {
      res.status(200).json({
        status: 'success',
        connected: transbankService.deviceConnected,
        port: transbankService.connection?.path,
        message: transbankService.deviceConnected ? 'POS operativo' : 'POS desconectado'
      });
    });

    // Apagado elegante
    const gracefulShutdown = async (signal) => {
      logger.info(`Recibida señal ${signal}. Cerrando servidor...`);
      try {
        await Promise.race([
          new Promise(resolve => server.close(resolve)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout cerrando servidor')), 5000))
        ]);
        logger.info('Servidor HTTP cerrado');
        await transbankService.closeConnection();
        logger.info('Conexión con POS cerrada correctamente');
      } catch (error) {
        logger.error('Error durante el shutdown:', error.message);
      } finally {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      if (error.message.includes('POS') || error.message.includes('serialport')) {
        transbankService.closeConnection();
      }
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (fatalError) {
    logger.error('Error crítico al iniciar el servidor:', fatalError.message);
    process.exit(1);
  }
}

startServer();