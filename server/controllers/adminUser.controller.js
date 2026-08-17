import {
  getAdminUserDetails,
  getAdminUserOverview,
  listAdminUsers,
  updateAdminUserStatus,
} from "../services/adminUser.service.js";

export const getUserOverview = async (req, res, next) => {
  try {
    const overview = await getAdminUserOverview();
    return res.status(200).json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const result = await listAdminUsers({
      query: req.query.q,
      status: req.query.status,
      provider: req.query.provider,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const details = await getAdminUserDetails(req.params.userId);
    return res.status(200).json({ success: true, data: details });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const user = await updateAdminUserStatus({
      userId: req.params.userId,
      isActive: req.body?.isActive,
    });

    return res.status(200).json({
      success: true,
      message: user.isActive
        ? "Student account reactivated."
        : "Student account deactivated.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};
