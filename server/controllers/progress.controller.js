import { getProgressOverview } from "../services/progression.service.js";

export const getMyProgressOverview = async (req, res, next) => {
  try {
    const overview = await getProgressOverview(req.user._id);

    return res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error) {
    next(error);
  }
};
