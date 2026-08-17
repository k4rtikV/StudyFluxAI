export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      code: "ADMIN_REQUIRED",
      message: "Administrator access is required.",
    });
  }

  next();
};
