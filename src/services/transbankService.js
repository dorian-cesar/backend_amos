const { WebpayPlus } = require('transbank-sdk');
const { getPOSConfig } = require('../config/transbankConfig');

class TransbankService {
  constructor() {
    this.commerceCode = getPOSConfig().commerceCode;
    this.apiKey = getPOSConfig().apiKey;
  }

  async createTransaction(amount, buyOrder, sessionId, returnUrl) {
    try {
      const response = await WebpayPlus.Transaction.create(
        buyOrder,
        sessionId,
        amount,
        returnUrl
      );
      
      return {
        success: true,
        token: response.token,
        url: response.url
      };
    } catch (error) {
      console.error('Error creating transaction:', error);
      return { success: false, error: error.message };
    }
  }

  async commitTransaction(token) {
    try {
      const response = await WebpayPlus.Transaction.commit(token);
      return {
        success: true,
        response: {
          amount: response.amount,
          status: response.status,
          authorizationCode: response.authorization_code,
          paymentType: response.payment_type_code,
          transactionDate: response.transaction_date
        }
      };
    } catch (error) {
      console.error('Error committing transaction:', error);
      return { success: false, error: error.message };
    }
  }

  async statusTransaction(token) {
    try {
      const response = await WebpayPlus.Transaction.status(token);
      return { success: true, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TransbankService();