var STX = 0x02;
var ETX = 0x03;
var ACK = 0x06;
var NAK = 0x15;
var SEPARATOR = '|';

// Códigos intermedios del POS
var INTERMEDIATE_STATUS_CODES = {
  '81': 'Solicitando ingreso de clave',
  '82': 'Enviando transacción al autorizador',
  '83': 'Selección menú crédito/Redcompra',
  '84': 'Opere tarjeta',
  '85': 'Selección de cuotas',
  '86': 'Ingreso de cuotas',
  '87': 'Confirmación de cuotas',
  '88': 'Aceptar consulta cuotas',
  '93': 'Consultando cuota al autorizador'
};

function calculateLRC(data) {
  var lrc = 0;
  for (var i = 0; i < data.length; i++) {
    lrc ^= data.charCodeAt(i);
  }
  return String.fromCharCode(lrc);
}

function buildMessage(command, fields) {
  var data = [command].concat(fields).join(SEPARATOR);
  var message = String.fromCharCode(STX) + data + String.fromCharCode(ETX);
  return message + calculateLRC(data + String.fromCharCode(ETX));
}

function parseResponse(response) {
  if (!response || typeof response !== 'string' || response.length < 5) {
    throw new Error('Respuesta inválida del POS');
  }

  // Manejo de mensajes intermedios (0900)
  var intermediatePrefix = String.fromCharCode(STX) + '0900';
  if (response.indexOf(intermediatePrefix) === 0) {
    var parts = response.split(SEPARATOR);
    return {
      command: '0900',
      responseCode: parts[1],
      statusMessage: INTERMEDIATE_STATUS_CODES[parts[1]] || 'Estado desconocido',
      rawResponse: response
    };
  }

  // Verificar STX al inicio y LRC al final
  if (response.charCodeAt(0) !== STX) {
    throw new Error('Formato de respuesta incorrecto - Falta STX');
  }

  var receivedLRC = response.charCodeAt(response.length - 1);
  var messageWithoutLRC = response.substring(0, response.length - 1);
  var calculatedLRC = calculateLRC(messageWithoutLRC.substring(1)); // Excluye STX

  if (receivedLRC !== calculatedLRC.charCodeAt(0)) {
    throw new Error('Error de integridad (LRC no coincide)');
  }

  var messageContent = messageWithoutLRC.substring(1); // Remover STX
  var etxPos = messageContent.indexOf(String.fromCharCode(ETX));
  if (etxPos === -1) {
    throw new Error('Formato de respuesta incorrecto - Falta ETX');
  }

  var dataPart = messageContent.substring(0, etxPos);
  var fields = dataPart.split(SEPARATOR);

  return {
    command: fields[0],
    responseCode: fields[1],
    commerceCode: fields[2],
    terminalId: fields[3],
    ticketNumber: fields[4],
    authorizationCode: fields[5],
    amount: fields[6],
    last4Digits: fields[7],
    operationNumber: fields[8],
    cardType: fields[9],
    rawResponse: response
  };
}

function validateACKNAK(response) {
  if (!response) return false;
  var code = response.charCodeAt(0);
  return code === ACK || code === NAK;
}

module.exports = {
  INTERMEDIATE_STATUS_CODES: INTERMEDIATE_STATUS_CODES,
  calculateLRC: calculateLRC,
  buildMessage: buildMessage,
  parseResponse: parseResponse,
  validateACKNAK: validateACKNAK,
  constants: {
    STX: STX,
    ETX: ETX,
    ACK: ACK,
    NAK: NAK,
    SEPARATOR: SEPARATOR
  }
};
