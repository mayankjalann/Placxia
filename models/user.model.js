import mongoose,{Schema} from "mongoose"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

const userSchema = new Schema(
    {
      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },
      password: {
        type: String,
        required: true,
        minlength: 6,
      },
      role: {
        type: String,
        enum: ["STUDENT", "ADMIN", "COMPANY"],
        required: true,
      },
      college: {
        type: Schema.Types.ObjectId,
        ref: "College",
        default: null,
      },
      refreshSessions: [{
        sessionId: { type: String, required: true },
        role: { type: String, enum: ["STUDENT", "ADMIN", "COMPANY"], required: true },
        refreshToken: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        lastUsedAt: { type: Date, default: Date.now },
      }],
      isVerified: {
        type: Boolean,
        default: false,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
      lastLogin: {
        type: Date,
      },
    },
    { timestamps: true }
  );

  userSchema.pre("save",async function(){
    if(!this.isModified("password")) return;

    this.password=await bcrypt.hash(this.password,10);
  })

  userSchema.methods.generateAccessToken = function (sessionId) {
    return jwt.sign(
      {
        _id: this._id,
        email: this.email,
        role: this.role,
        sid: sessionId,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
  };

  userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
      {
        _id: this._id,
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
  };

  userSchema.methods.isPasswordCorrect=async function(password){
    return await bcrypt.compare(password,this.password);
  }

export const User=mongoose.model("User",userSchema);
