const responseHandler = {
  success: (res, message, data = {}, status = 200) => {
    res.status(status).json({
      success: true,
      message,
      data
    });
  },
  
  error: (res, message, status = 500, code = 'INTERNAL_ERROR') => {
    res.status(status).json({
      success: false,
      error: message,
      code
    });
  }
};

module.exports = responseHandler;