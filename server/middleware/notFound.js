const notFound = (_req, res) => {
  res.status(404).json({
    success: false,
    code: "ROUTE_NOT_FOUND",
    message: "Route not found.",
  });
};

export default notFound;
