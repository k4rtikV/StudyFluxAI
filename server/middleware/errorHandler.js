const errorHandler = (err, req, res, next) => {
  const statusCode =
    err.statusCode ||
    err.status ||
    (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  const response = {
    success: false,
    message: err.message || "Something went wrong.",
  };

  if (err.code) response.code = err.code;

  if (process.env.NODE_ENV !== "production") {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;