import { getSupportConfig, submitSupportRequest } from "../services/support.service.js";

export const getConfig = async (req, res, next) => {
  try {
    const config = await getSupportConfig();
    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

export const submitRequest = async (req, res, next) => {
  try {
    const request = await submitSupportRequest({ user: req.user, payload: req.body || {} });
    return res.status(201).json({
      success: true,
      message: "Your support request was sent to the StudyFluxAI administrator.",
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};
