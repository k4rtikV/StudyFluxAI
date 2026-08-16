import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required."],
      trim: true,
      minlength: [2, "Full name must be at least 2 characters."],
      maxlength: [60, "Full name cannot exceed 60 characters."],
    },

    email: {
      type: String,
      required: [true, "Email is required."],
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      maxlength: [254, "Email address is too long."],
    },

    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters."],
      select: false,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },

    authProviders: {
      type: [
        {
          type: String,
          enum: ["local", "google"],
        },
      ],
      default: [],
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    learningProfileCompleted: {
      type: Boolean,
      default: false,
    },

    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
    },

    avatar: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;