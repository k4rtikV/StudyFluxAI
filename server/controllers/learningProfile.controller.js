import mongoose from "mongoose";

import LearningProfile from "../models/LearningProfile.js";
import User from "../models/User.js";
import { validateLearningProfile } from "../utils/learningProfileValidation.js";

const serializeProfile = (profile) => ({
  id: profile._id,
  educationLevel:
    profile.educationLevel,
  institutionType:
    profile.institutionType,
  institutionState:
    profile.institutionState || "",
  institutionId:
    profile.institutionId || "",
  institutionCategory:
    profile.institutionCategory || "",
  institutionSector:
    profile.institutionSector || "",
  institutionKey:
    profile.institutionKey,
  institutionName:
    profile.institutionName,
  programKey:
    profile.programKey || "",
  program:
    profile.program || "",
  streamKey:
    profile.streamKey || "",
  stream:
    profile.stream || "",
  createdAt:
    profile.createdAt,
  updatedAt:
    profile.updatedAt,
});

export const getLearningProfile = async (
  req,
  res,
  next,
) => {
  try {
    const profile =
      await LearningProfile.findOne({
        user: req.user._id,
      }).lean();

    return res.status(200).json({
      success: true,
      data: {
        profile: profile
          ? serializeProfile(profile)
          : null,
        completed: Boolean(
          req.user
            .learningProfileCompleted &&
            profile,
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const saveLearningProfile = async (
  req,
  res,
  next,
) => {
  const validation =
    validateLearningProfile(req.body);

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message:
        "Please correct the highlighted fields.",
      errors: validation.errors,
    });
  }

  const session =
    await mongoose.startSession();

  try {
    let savedProfile;

    await session.withTransaction(
      async () => {
        savedProfile =
          await LearningProfile.findOneAndUpdate(
            {
              user: req.user._id,
            },
            {
              $set: {
                ...validation.values,
              },
              $setOnInsert: {
                user: req.user._id,
              },
            },
            {
              new: true,
              upsert: true,
              runValidators: true,
              session,
            },
          );

        await User.updateOne(
          {
            _id: req.user._id,
            isActive: true,
          },
          {
            $set: {
              learningProfileCompleted:
                true,
            },
          },
          {
            session,
          },
        );
      },
    );

    if (!savedProfile) {
      return res.status(500).json({
        success: false,
        message:
          "Your learning profile could not be saved. Please try again.",
      });
    }

    req.user.learningProfileCompleted =
      true;

    return res.status(200).json({
      success: true,
      message:
        "Learning profile saved successfully.",
      data: {
        profile:
          serializeProfile(
            savedProfile,
          ),
        user: {
          id: req.user._id,
          fullName:
            req.user.fullName,
          email: req.user.email,
          role: req.user.role,
          avatar: req.user.avatar,
          isEmailVerified:
            req.user
              .isEmailVerified,
          learningProfileCompleted:
            true,
          authProviders:
            req.user.authProviders,
        },
        nextStep: "dashboard",
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        code:
          "LEARNING_PROFILE_CONFLICT",
        message:
          "A learning profile already exists for this account. Please try again.",
      });
    }

    next(error);
  } finally {
    await session.endSession();
  }
};