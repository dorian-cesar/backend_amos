function handleResponse(res, result) {
    if (result.success) {
      res.json({
        success: true,
        data: result.data || result.response,
        message: result.message || 'Operación exitosa'
      });
    } else {
      res.status(result.statusCode || 500).json({
        success: false,
        error: result.error || 'Error desconocido',
        message: result.message || 'Error en la operación'
      });
    }
  }
  
  module.exports = { handleResponse };