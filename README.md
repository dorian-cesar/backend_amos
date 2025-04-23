# 🔌 Transbank IM30 Integration Backend

Este proyecto es un backend desarrollado en **Node.js** para la integración directa con el **terminal POS autoservicio IM30** de Transbank, utilizando el SDK oficial `transbank-pos-sdk`. Está diseñado para funcionar en entornos de autoservicio como tótems, kioscos o sistemas sin intervención humana directa.

## Características

- Comunicación serial robusta (USB o RS232) con el terminal POS.
- Soporte para:
  - **Venta (sale)**
  - **Reversa (refund)**
  - **Cierre de terminal**
  - **Inicialización (carga de llaves)**
  - **Obtención de la última transacción**
- Reintentos automáticos ante errores de comunicación (`NAK`).
- Manejo de estados intermedios (clave, cuotas, operación de tarjeta).
- Logs detallados con `winston`.
- Manejo de errores críticos (`heap`, `uncaughtException`, `shutdown`).
- Compatible con entornos **Linux**.

------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Estructura del Proyecto
backTransbank
/src
  /config
    transbankConfig.js     # Exporta configureIntegration()
  /controllers
    paymentController.js
    terminalController.js
  /services
    transbankService.js    # Exporta el modelo new transbankService()
  /utils
    posUtils.js
    responseHandler.js     # Exporta responseHandler()
    logger.js              # Exporta logger()
  app.js                   # Usa configureIntegration()
  server.js
.env  

sequenceDiagram
  Frontend->>Backend: POST /api/payment {amount, ticketId}
  Backend->>POS: Envía 0200 (Venta)
  POS-->>Backend: 0900 (Estado intermedio)
  Backend->>Frontend: 200 OK {message: "Opere tarjeta"}
  POS-->>Backend: 0210 (Resultado final)
  Backend->>Frontend: 200 OK {success: true, ...}

------------------------------------------------------------------------------------------------------------------------------------------------------------------------
## Endpoints

Pagos
POST /api/payment
→ Ejecuta una venta.
Requiere: { amount, ticketNumber, printVoucher (opcional) }

POST /api/refund
→ Ejecuta una reversa.
Requiere: { amount, originalOperationNumber }

Terminal POS
POST /api/terminal/close

POST /api/terminal/initialize

GET /api/terminal/last-transaction

GET /api/terminal/ports

POST /api/terminal/reconnect

POST /api/terminal/connect

GET /api/terminal/status

Health check
GET /health

------------------------------------------------------------------------------------------------------------------------------------------------------------------------

🌐 Configuración de Entorno (.env)
Este proyecto utiliza un archivo .env para definir variables de entorno críticas, incluyendo la conexión al POS de Transbank y el control de acceso CORS desde el frontend.

🔧 Cambio de entorno
Para alternar entre desarrollo y producción, cambia el valor de la variable NODE_ENV en el archivo .env:

# Modo desarrollo (por defecto)
NODE_ENV=development

# Modo producción (descomenta para usar en despliegue)
#NODE_ENV=production
🔐 Acceso CORS según entorno
El backend permite solicitudes CORS dependiendo del entorno:

Desarrollo (development): acepta todas las IPs y dominios (origin: '*') para facilitar pruebas locales.

Producción (production): restringe el acceso solo a los orígenes definidos en ALLOWED_ORIGINS.

Ejemplo:

# CORS para producción (separados por coma, sin espacios)
ALLOWED_ORIGINS=https://miweb.com,https://admin.miweb.com
⚠️ En modo desarrollo, este valor será ignorado.

------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## ¿Qué es el LRC?
El LRC es un mecanismo de verificación de integridad usado en comunicaciones serie, como la que tiene lugar entre tu backend y el terminal POS IM30. Sirve para asegurarse de que un mensaje no fue alterado o corrompido durante la transmisión.

¿Cómo funciona?
El LRC se calcula aplicando una operación XOR a cada byte del mensaje (excepto el carácter de inicio STX, y a veces también se excluye el ETX).

Ejemplo:

function calculateLRC(data) {
  let lrc = 0;
  for (let i = 0; i < data.length; i++) {
    lrc ^= data.charCodeAt(i);
  }
  return String.fromCharCode(lrc);
}
Este valor final se adjunta al mensaje enviado. El receptor recalcula el LRC del mensaje recibido y compara ambos. Si no coinciden, significa que el mensaje fue dañado, y el receptor responde con NAK (Negative Acknowledgment).

------------------------------------------------------------------------------------------------------------------------------------------------------------------------

