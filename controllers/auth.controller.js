import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { Company } from "../models/company.model.js";
import { AllowedStudent } from "../models/AllowedStudent.model.js";
import { Student } from "../models/student.model.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens= async(userId)=>{
  try{
       const user= await User.findById(userId)
       const accessToken=user.generateAccessToken();
       const refreshToken=user.generateRefreshToken();
       user.refreshToken=refreshToken
       await user.save({validateBeforeSave: false});
       return {accessToken,refreshToken};
  }
  catch(error){
       throw new ApiError(500,"Something went wrong");
  }
}

const registerStudent=asyncHandler(async(req,res)=>{
    const {email,password}=req.body;

    if(!email || !password){
        throw new ApiError(400,"email and password are required");
    }

    const allowedStudent=await AllowedStudent.findOne({ email });

    if(!allowedStudent){
        throw new ApiError(403, "You are not registered in this college system")
    }

    if (allowedStudent.isRegistered) {
        throw new ApiError(409, "Account already exists. Please login")
    }

    const existingUser= await User.findOne({email});

    if(existingUser){
        throw new ApiError(409, "User already exists with this email")
    }

    const user=await User.create({
        email,
        password,
        role: "STUDENT",
        college: allowedStudent.college,
        isVerified: true
    });

    const student = await Student.create({
        user: user._id,
        college: allowedStudent.college,
        rollNo: allowedStudent.rollNo,
        branch: allowedStudent.branch,
        batch: allowedStudent.batch,
        name: email.split("@")[0], // temp name from email
      });
      
      // also mark as registered
      allowedStudent.isRegistered = true
      await allowedStudent.save()

      const createdUser= await User.findById(user._id).select("-password -refreshToken")

      return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { user: createdUser, student },
          "Student registered successfully"
        )
      )


})

const registerCompany = asyncHandler(async (req, res) => {

    const { email, password, name, industry, website, description } = req.body
  
    if (!email || !password || !name || !industry) {
      throw new ApiError(400, "Email, password, name and industry are required")
    }
  
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      throw new ApiError(409, "Company already registered with this email")
    }
  
    const user = await User.create({
      email,
      password,
      role: "COMPANY",
      college: null,
      isVerified: true,
    })
  
    const company = await Company.create({
      user: user._id,
      name,
      industry,
      website,
      description,
      isApproved: false,
    })
  
    const createdUser = await User.findById(user._id).select("-password -refreshToken")
  
    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { user: createdUser, company },
          "Company registered successfully. Wait for admin approval."
        )
      )
  })

const loginUser= asyncHandler(async (req,res)=>{
    const {email,password}=req.body;

    if(!email || !password){
        throw new ApiError(400,"Email and password required");
    }

    const user=await User.findOne({email});

    if(!user){
        throw new ApiError(404, "User does not exist");
    }

    if(!user.isActive){
        throw new ApiError(403, "Account is disabled. Contact admin")
    }

    const isPasswordCorrect=await user.isPasswordCorrect(password);

    if(!isPasswordCorrect){
      throw new ApiError(401, "Invalid credentials");
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id);

     const loggedInUser= await User.findById(user._id).select("-password -refreshToken")
     // kyunki purana reference h humare paas toh dikkat h usme refresh token nai h
     //aur cookies mein hume password bhi nai bhejna

     const options={
          httpOnly: true,
          secure: true
     } //ensures cookies non modifiable by frontend

     return res
     .status(200)
     .cookie("accessToken",accessToken,options)
     .cookie("refreshToken",refreshToken,options)
     .json(
          new ApiResponse(
               200,{
                    user: loggedInUser,accessToken,refreshToken
               },
               "User logged In Successful"
          )
     )



})

export {registerStudent, registerCompany, loginUser};