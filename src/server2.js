const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const fs = require('fs');
//const POS = require('transbank-pos-sdk');
const { POSAutoservicio } = require('transbank-pos-sdk');

const POS = new POSAutoservicio();

const app = express();
const port = 3000;

// Cargar certificados
const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

app.use(cors());
app.use(bodyParser.json());

// Auto-conexión + poll + loadKeys
POS.autoconnect()
  .then((response) => {
    console.log('POS Autoconectado:', response);
    return POS.poll();
  })
  .then((pollResponse) => {
    console.log('Poll ejecutado después de autoconectar:', pollResponse);
    return POS.loadKeys();
  })
  .then((loadKeysResponse) => {
    console.log('LoadKeys ejecutado después de poll:', loadKeysResponse);
  })
  .catch((error) => {
    console.error('Error durante la autoconexión, poll o carga de llaves:', error);
  });

// (Aquí vienen todas las rutas /vender, /desconectar, etc.)


// Ruta para realizar una venta
app.post('/api/payment', (req, res) => {
  const { monto, ticket } = req.body;

  if (!monto || !ticket) {
    return res.status(400).json({ error: 'Monto y ticket son requeridos' });
  }

  POS.sale(monto, ticket)
    .then((response) => {
      console.log('Respuesta de venta del POS:', response);
      res.json(response);
    })
    .catch((error) => {
      console.error('Error al realizar la venta:', error);
      res.status(500).json({ error: 'Error al procesar la venta', details: error });
    });
});

// Ruta para desconectar el POS
app.post('/api/desconectar', (req, res) => {
  POS.disconnect()
    .then((response) => {
      console.log('Puerto desconectado correctamente');
      res.json({ message: 'Puerto desconectado correctamente', response });
    })
    .catch((err) => {
      console.error('Ocurrió un error inesperado', err);
      res.status(500).json({ error: 'Ocurrió un error inesperado', details: err });
    });
});

// Ruta para ejecutar poll
app.post('/api/poll', (req, res) => {
  POS.poll()
    .then((response) => {
      console.log('Poll ejecutado. Respuesta: ', response);
      res.json({ message: 'Poll ejecutado correctamente', response });
    })
    .catch((err) => {
      console.error('Ocurrió un error inesperado', err);
      res.status(500).json({ error: 'Ocurrió un error inesperado', details: err });
    });
});

// Ruta para ejecutar loadKeys
app.post('/api/loadKeys', (req, res) => {
  POS.loadKeys()
    .then((response) => {
      console.log('LoadKeys ejecutado. Respuesta: ', response);
      res.json({ message: 'LoadKeys ejecutado correctamente', response });
    })
    .catch((err) => {
      console.error('Ocurrió un error inesperado', err);
      res.status(500).json({ error: 'Ocurrió un error inesperado', details: err });
    });
});

// Ruta para ejecutar closeDay
app.post('/api/closeDay', (req, res) => {
  POS.closeDay()
    .then((response) => {
      console.log('CloseDay ejecutado. Respuesta: ', response);
      res.json({ message: 'CloseDay ejecutado correctamente', response });
    })
    .catch((err) => {
      console.error('Ocurrió un error inesperado', err);
      res.status(500).json({ error: 'Ocurrió un error inesperado', details: err });
    });
});

// Ruta para obtener la última venta
app.post('/api/getLastSale', (req, res) => {
  POS.getLastSale()
    .then((response) => {
      console.log('GetLastSale ejecutado. Respuesta: ', response);
      res.json({ message: 'GetLastSale ejecutado correctamente', response });
    })
    .catch((err) => {
      console.error('Ocurrió un error inesperado', err);
      res.status(500).json({ error: 'Ocurrió un error inesperado', details: err });
    });
});

// Ruta para obtener los totales
app.post('/api/getTotals', (req, res) => {
  POS.getTotals()
    .then((response) => {
      console.log('GetTotals ejecutado. Respuesta: ', response);
      res.json({ message: 'GetTotals ejecutado correctamente', response });
    })
    .catch((err) => {
      console.error('Ocurrió un error inesperado', err);
      res.status(500).json({ error: 'Ocurrió un error inesperado', details: err });
    });
});


// Iniciar servidor HTTPS
https.createServer(options, app).listen(port, () => {
    console.log(`Servidor HTTPS escuchando en el puerto ${port}`);

});