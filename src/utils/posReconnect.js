const transbankService = require('../services/transbankService');
const logger = require('./logger'); // asegúrate que logger esté aquí

function autoReconnectPOS() {
  var preferredPort = process.env.TBK_PORT_PATH;

  return transbankService.connectToPort(preferredPort)
    .then(function(port) {
      logger.info('✅ POS reconectado exitosamente en puerto preferido: ' + port.path);
      return true;
    })
    .catch(function(err) {
      logger.warn('⚠️ Falló reconexión en puerto preferido (' + preferredPort + '): ' + err.message);

      return transbankService.listAvailablePorts()
        .then(function(ports) {
          var acmPorts = [];
          for (var i = 0; i < ports.length; i++) {
            if (ports[i].path.indexOf('ACM') !== -1) {
              acmPorts.push(ports[i]);
            }
          }

          function tryConnect(index) {
            if (index >= acmPorts.length) {
              return Promise.resolve(false);
            }
            var port = acmPorts[index];
            return transbankService.connectToPort(port.path)
              .then(function(result) {
                logger.info('✅ POS reconectado exitosamente en puerto alternativo: ' + port.path);
                return true;
              })
              .catch(function(err) {
                logger.warn('❌ No se pudo reconectar por ' + port.path + ': ' + err.message);
                return tryConnect(index + 1);
              });
          }

          return tryConnect(0);
        })
        .catch(function(error) {
          logger.error('❌ Error listando puertos para reconexión: ' + error.message);
          return false;
        });
    });
}

module.exports = autoReconnectPOS;
