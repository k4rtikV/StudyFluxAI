import {
  getLeaderboard,
  getLeaderboardAdminStatus,
  rebuildLeaderboardCache,
} from "../services/leaderboard.service.js";

export const getAdminLeaderboard = async (req, res, next) => {
  try {
    const leaderboard = await getLeaderboard({
      board: req.query.board,
      limit: req.query.limit || 50,
      exposeUserId: true,
    });
    const status = await getLeaderboardAdminStatus();

    return res.status(200).json({
      success: true,
      data: { leaderboard, status },
    });
  } catch (error) {
    next(error);
  }
};

export const rebuildAdminLeaderboard = async (req, res, next) => {
  try {
    const result = await rebuildLeaderboardCache({ emit: true });

    return res.status(200).json({
      success: true,
      message: result.redisActive
        ? "Leaderboard cache rebuilt from MongoDB."
        : "Leaderboard recalculated from MongoDB. Redis is currently unavailable, so reads will use the MongoDB fallback.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
