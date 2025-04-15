const express = require('express');
const router = express.Router();
const transbankService = require('../services/transbankService');
const { handleResponse } = require('../utils/responseHandler');

router.post('/init', async (req, res) => {
  try {
    const { amount, buyOrder } = req.body;
    
    // Validaciones básicas
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Monto inválido' });
    }
    
    const sessionId = `session_${Date.now()}`;
    const returnUrl = `${req.protocol}://${req.get('host')}/api/payment/confirm`;
    
    const result = await transbankService.createTransaction(
      amount,
      buyOrder,
      sessionId,
      returnUrl
    );
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json({
      token: result.token,
      url: result.url,
      redirectUrl: `${result.url}?token_ws=${result.token}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/confirm', async (req, res) => {
  try {
    const { token_ws } = req.body;
    
    if (!token_ws) {
      return res.redirect('/?error=missing_token');
    }
    
    const result = await transbankService.commitTransaction(token_ws);
    
    if (result.success) {
      // Redirigir a página de éxito con datos de la transacción
      return res.redirect(`/?success=true&authorizationCode=${result.response.authorizationCode}`);
    } else {
      return res.redirect(`/?error=transaction_failed`);
    }
  } catch (error) {
    res.redirect(`/?error=${encodeURIComponent(error.message)}`);
  }
});

router.get('/status/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await transbankService.statusTransaction(token);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;