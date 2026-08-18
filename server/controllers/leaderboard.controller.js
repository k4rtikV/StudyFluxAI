import { getLeaderboard } from "../services/leaderboard.service.js";

export const getMyLeaderboard = async (req, res, next) => {
  try {
    const leaderboard = await getLeaderboard({
      board: req.query.board,
      currentUserId: req.user._id,
      limit: req.query.limit,
      exposeUserId: false,
    });

    return res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    next(error);
  }
};
