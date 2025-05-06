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
    logger.js              # Exporta logger()
    posUtils.js
   
    responseHandler.js     # Exporta responseHandler()
    
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

🔁 Pagos
1. POST /payment
Descripción: Inicia una transacción de venta.

Body:
{
  "amount": 1000,
  "ticketNumber": "A12345678",
  "printVoucher": true
}

Respuesta exitosa:
{
  "success": true,
  "message": "Conexión exitosa",
  "data": {
    "operationNumber": "123456",
    "voucherText": "Texto del voucher para imprimir...",
    ...
  }
}

2. POST /refund
Descripción: Realiza una reversa de una transacción anterior.

Body:
{
  "amount": 1000,
  "originalOperationNumber": "123456"
}
Respuesta exitosa:
{
  "success": true,
  "message": "Reversa exitosa",
  "data": {
    "operationNumber": "654321",
    ...
  }
}

3. GET /terminal/last-transaction
Descripción: Devuelve la última transacción realizada por el POS.

Respuesta exitosa:
{
  "success": true,
  "message": "Última transacción obtenida",
  "data": {
    "operationNumber": "123456",
    ...
  }
}

⚙️ Terminal POS
4. POST /terminal/loadKeys
Descripción: Carga las llaves del POS (debe ejecutarse al iniciar el día o al conectar por primera vez).

Respuesta:
{
  "success": true,
  "message": "Terminal inicializado",
  "data": {
    "message": "Llaves cargadas correctamente"
  }
}

5. POST /terminal/close
Descripción: Realiza el cierre de terminal.

Body:
{
  "printReport": true
}

6. GET /terminal/status
Descripción: Consulta si el POS está conectado.

Respuesta:
{
  "status": "success",
  "connected": true,
  "port": "/dev/ttyACM0"
}

7. GET /terminal/ports
Descripción: Lista los puertos disponibles para conexión.

Respuesta:
{
  "status": "success",
  "ports": [
    {
      "path": "/dev/ttyACM0",
      "manufacturer": "Pax",
      "isCurrent": true,
      "recommended": true
    },
    ...
  ]
}

8. POST /terminal/connect
Descripción: Conecta al POS usando un puerto específico.

Body:
{
  "portPath": "/dev/ttyACM0"
}

9. POST /terminal/reconnect
Descripción: Reconecta automáticamente usando el puerto por defecto en .env.

✅ Health Check
10. GET /health
Descripción: Verifica que el servidor esté funcionando.

Respuesta:
{
  "status": "OK",
  "environment": "development"
}


📌 Notas para el Frontend
Todos los endpoints responden en JSON.

Asegúrate de enviar el Content-Type: application/json.

Los errores incluyen un code y mensaje descriptivo.

La impresión del voucher se controla con printVoucher: true.


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

# 1. Generar clave privada SIN contraseña
openssl genrsa -out key.pem 2048

# 2. Generar certificado autofirmado válido por 365 días
openssl req -new -x509 -key key.pem -out cert.pem -days 365