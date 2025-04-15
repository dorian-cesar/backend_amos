const config = {
  protocol: process.env.TBK_PROTOCOL || 'USB',
  portPath: process.env.TBK_PORT_PATH || '/dev/ttyUSB0', 
  baudRate: parseInt(process.env.TBK_BAUD_RATE) || 115200,
  timeout: parseInt(process.env.TBK_TIMEOUT) || 30000,
  merchantCode: process.env.TBK_COMMERCE_CODE,
  terminalId: process.env.TBK_TERMINAL_ID,
  enableLogs: process.env.TBK_ENABLE_LOGS === 'true',
  maxRetries: parseInt(process.env.TBK_MAX_RETRIES) || 3
};

module.exports = config; 