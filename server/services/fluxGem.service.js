import mongoose from "mongoose";

import FluxGemTransaction from "../models/FluxGemTransaction.js";
import StudySession from "../models/StudySession.js";
import User from "../models/User.js";

export class InsufficientFluxGemsError extends Error {
  constructor(required) {
    super(`You need ${required} FluxGems to generate this learning content.`);
    this.name = "InsufficientFluxGemsError";
    this.code = "INSUFFICIENT_FLUXGEMS";
    this.required = required;
  }
}

export const beginPaidStudyGeneration = async ({
  userId,
  cost,
  sessionData,
}) => {
  const mongoSession = await mongoose.startSession();

  try {
    let createdStudySession;
    let updatedUser;

    await mongoSession.withTransaction(async () => {
      updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          fluxGems: { $gte: cost },
          isActive: true,
        },
        {
          $inc: {
            fluxGems: -cost,
          },
        },
        {
          new: true,
          session: mongoSession,
        },
      );

      if (!updatedUser) {
        throw new InsufficientFluxGemsError(cost);
      }

      [createdStudySession] = await StudySession.create(
        [
          {
            ...sessionData,
            user: userId,
            cost,
            status: "generating",
            generationStage: "queued",
            generationMetrics: {
              queuedAt: new Date(),
            },
            chargedAt: new Date(),
          },
        ],
        {
          session: mongoSession,
        },
      );

      await FluxGemTransaction.create(
        [
          {
            user: userId,
            type: "spend",
            amount: -cost,
            balanceAfter: updatedUser.fluxGems,
            reason: "ai_generation",
            studySession: createdStudySession._id,
            metadata: {
              generationType: sessionData.generationType || "combined",
              sourceMode: sessionData.sourceMode,
              quizSize: sessionData.quizSize,
            },
          },
        ],
        {
          session: mongoSession,
        },
      );
    });

    return {
      studySession: createdStudySession,
      balance: updatedUser.fluxGems,
    };
  } finally {
    await mongoSession.endSession();
  }
};

export const refundFailedStudyGeneration = async ({
  userId,
  studySessionId,
  cost,
  failureCode,
  failureMessage,
}) => {
  const mongoSession = await mongoose.startSession();

  try {
    let updatedUser = null;
    let refunded = false;

    await mongoSession.withTransaction(async () => {
      const studySession = await StudySession.findOneAndUpdate(
        {
          _id: studySessionId,
          user: userId,
          status: "generating",
          refundedAt: null,
        },
        {
          $set: {
            status: "failed",
            generationStage: "failed",
            refundedAt: new Date(),
            "generationMetrics.finishedAt": new Date(),
            failureCode,
            failureMessage: String(failureMessage || "").slice(0, 500),
          },
        },
        {
          new: true,
          session: mongoSession,
        },
      );

      if (!studySession) {
        return;
      }

      updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          isActive: true,
        },
        {
          $inc: {
            fluxGems: cost,
          },
        },
        {
          new: true,
          session: mongoSession,
        },
      );

      if (!updatedUser) {
        throw new Error("Unable to refund FluxGems for the failed generation.");
      }

      await FluxGemTransaction.create(
        [
          {
            user: userId,
            type: "refund",
            amount: cost,
            balanceAfter: updatedUser.fluxGems,
            reason: "ai_generation_refund",
            studySession: studySessionId,
            metadata: {
              failureCode,
              generationType: studySession.generationType || "combined",
            },
          },
        ],
        {
          session: mongoSession,
        },
      );

      refunded = true;
    });

    return {
      refunded,
      balance: updatedUser?.fluxGems,
    };
  } finally {
    await mongoSession.endSession();
  }
};
