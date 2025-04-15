const { Options, WebpayPlus } = require('transbank-sdk');

module.exports = {
  configureIntegration: () => {
    WebpayPlus.configureForTesting(); // Para desarrollo
    // En producción usar:
    // WebpayPlus.configureForProduction(commerceCode, apiKey);
  },

  getPOSConfig: () => ({
    commerceCode: process.env.TBK_COMMERCE_CODE || '597055555532',
    apiKey: process.env.TBK_API_KEY || '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C',
    environment: process.env.TBK_ENVIRONMENT || 'TEST'
  })
};