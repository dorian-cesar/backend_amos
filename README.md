# backTransbank
Backend para integracion de POS transbank a un totem android

Instrucciones para el Frontend

1. Configuración Inicial del Proyecto Vue 2
    Variables de Entorno:

    Crea un archivo .env en la raíz del proyecto frontend:

        VUE_APP_API_URL=http://localhost:3000/api
        VUE_APP_POS_TIMEOUT=45000  // Tiempo de espera para transacciones (ms)
        VUE_APP_SIMULATION_MODE=true  // Habilitar en desarrollo

    Dependencias:

    Instala axios para llamadas HTTP:
    
        npm install axios


2. Servicio API (transbank.js)
    Funcionalidades Clave:

        processPayment(amount, ticketNumber):

        Envía una solicitud POST a /api/payment con el monto formateado (9 dígitos + decimales, ej: "00015000.00").

        Maneja códigos de error específicos (ej: 01 = Rechazado, 81 = Ingrese PIN).


        Manejo de Respuestas Intermedias:

            Usa interceptores de axios para detectar códigos 8X (ej: 84 = "Opere tarjeta").

            Implementa reintentos automáticos (2 veces) para errores de comunicación.

        Ejemplo:
            async processPayment(amount) {
                try {
                    const response = await axios.post('/api/payment', {
                    amount: amount.toFixed(2).padStart(9, '0'),
                    ticketNumber: '0'.padEnd(20, ' '), // Opcional
                    printVoucher: true
                    });
                    return response.data;
                } catch (error) {
                    if (error.response?.data?.code === '84') {
                    throw new Error('Por favor, inserte o acerque su tarjeta');
                    }
                    throw error;
                }
            }

