import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { Company } from "../models/company.model.js";
import { College } from "../models/college.model.js";
import { Admin } from "../models/admin.model.js";
import { AllowedStudent } from "../models/allowedStudent.model.js";
import { Student } from "../models/student.model.js";
import jwt from "jsonwebtoken"
import { uploadOnCloudinary, deleteFromCloudinary, getSignedCloudinaryUrl } from "../utils/cloudinary.js";

const generateAccessAndRefreshTokens= async(userId)=>{
  try{
       const user= await User.findById(userId)
       
       if (!user) {
        throw new ApiError(404, "User not found");
      }

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

    const { email, password, name, industry, website, description, requestedColleges } = req.body
  
    if (!email || !password || !name || !industry || !requestedColleges) {
      throw new ApiError(400, "Email, password, name, industry, and requestedColleges are required")
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
      requestedColleges,
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
    console.log("Looking for email:", email)
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

     let loggedInUser = await User.findById(user._id).select("-password -refreshToken").lean();
     
     // CHEAT CODE: Manually "populate" the profile based on the role so Redux has their name!
     if (loggedInUser.role === "STUDENT") {
         const student = await Student.findOne({ user: user._id }).lean();
         loggedInUser.studentProfile = student;
         loggedInUser.name = student.name; // Attach name directly for easy access
     } else if (loggedInUser.role === "COMPANY") {
         const company = await Company.findOne({ user: user._id }).lean();
         loggedInUser.companyProfile = company;
         loggedInUser.name = company.name;
     } else if (loggedInUser.role === "ADMIN") {
         const admin = await Admin.findOne({ user: user._id }).lean();
         loggedInUser.adminProfile = admin;
         loggedInUser.name = admin.name;
     }

     const options={
          httpOnly: true,
          secure: true,
          sameSite: 'none'
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

const logoutUser=asyncHandler(async (req,res)=>{
  await User.findByIdAndUpdate(
    req.user._id,
    {
        $unset: { refreshToken: 1 }
    },
    { new: true }
);

// 2. clear cookies
const options = {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
};

return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "Logged out successfully")
    );
})

const changePassword=asyncHandler(async(req,res)=>{
  const { oldPassword,newPassword }=req.body;

  if(!oldPassword || !newPassword){
    throw new ApiError(400, "Old and new password required");
  }

  const user=await User.findById(req.user?._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isCorrect= await user.isPasswordCorrect(oldPassword);

  if(!isCorrect){
    throw new ApiError(401, "Old password is incorrect");
  }

  user.password=newPassword;
  user.refreshToken=null;

  await user.save({ validateBeforeSave: true }); //pre-save hook will hash it

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  return res.status(200).json(
    new ApiResponse(200, {}, "Password changed successfully")
  );

})

const updateStudentProfile = asyncHandler(async (req, res) => {

  const student = await Student.findOne({ user: req.user._id });

  if (!student) {
      throw new ApiError(404, "Student profile not found");
  }

  // Handle Resume Upload (Bypassing Cloudinary due to PDF corruption on free tier)
  if (req.file) {
      // Instead of Cloudinary, we will just use the local file path that Multer already saved!
      // The file is saved at: public/temp/filename.pdf
      // We will generate a local URL so the frontend can access it directly from our Express server.
      const localUrl = `http://localhost:8000/temp/${req.file.filename}`;
      
      student.resumeUrl = localUrl;
      student.resumePublicId = "local"; // No public ID needed for local files
  }

  const allowedFields = [
      "name",
      "phone",
      "branch",
      "batch",
      "cgpa",
      "tenthPercentage",
      "twelfthPercentage",
      "skills",
      "linkedinUrl",
      "githubUrl",
      "resumeUrl",
      "resumePublicId"
  ];

  allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
          student[field] = req.body[field];
      }
  });

  await student.save();

  return res.status(200).json(
      new ApiResponse(200, student, "Student profile updated successfully")
  );
});

const updateCompanyProfile = asyncHandler(async (req, res) => {

  const company = await Company.findOne({ user: req.user._id });

  if (!company) {
      throw new ApiError(404, "Company profile not found");
  }

  // Handle Logo Upload
  if (req.file) {
      const uploadResult = await uploadOnCloudinary(req.file.path);
      if (!uploadResult) {
          throw new ApiError(500, "Failed to upload logo to Cloudinary");
      }
      
      // Delete old logo if it exists
      if (company.logoPublicId) {
          await deleteFromCloudinary(company.logoPublicId);
      }
      
      company.logoUrl = uploadResult.url;
      company.logoPublicId = uploadResult.public_id;
  }

  const allowedFields = [
      "name",
      "industry",
      "website",
      "description",
      "logoUrl",
      "logoPublicId",
      "contactPerson",
      "contactEmail",
      "contactPhone"
  ];

  allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
          company[field] = req.body[field];
      }
  });

  await company.save();

  return res.status(200).json(
      new ApiResponse(200, company, "Company profile updated successfully")
  );
});


const updateAdminProfile = asyncHandler(async (req, res) => {

  const admin = await Admin.findOne({ user: req.user._id });

  if (!admin) {
      throw new ApiError(404, "Admin profile not found");
  }

  const allowedFields = [
      "name",
      "phone",
      "designation",
      "department"
  ];

  allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
          admin[field] = req.body[field];
      }
  });

  await admin.save();

  return res.status(200).json(
      new ApiResponse(200, admin, "Admin profile updated successfully")
  );
});

const getCurrentUser = asyncHandler(async (req, res) => {

  let user = await User.findById(req.user._id)
      .select("-password -refreshToken").lean();

  if (user.role === "STUDENT") {
      const student = await Student.findOne({ user: user._id }).lean();
      user.studentProfile = student;
      user.name = student.name;
  } else if (user.role === "COMPANY") {
      const company = await Company.findOne({ user: user._id }).lean();
      user.companyProfile = company;
      user.name = company.name;
  } else if (user.role === "ADMIN") {
      const admin = await Admin.findOne({ user: user._id }).lean();
      user.adminProfile = admin;
      user.name = admin.name;
  }

  return res.status(200).json(
      new ApiResponse(200, user, "User fetched successfully")
  );
});

const refreshAccessToken = asyncHandler(async (req, res) => {

  const incomingRefreshToken =
      req.cookies?.refreshToken ||
      req.body?.refreshToken;

  if (!incomingRefreshToken) {
      throw new ApiError(401, "Refresh token missing");
  }

  let decodedToken;

  try {
      decodedToken = jwt.verify(
          incomingRefreshToken,
          process.env.REFRESH_TOKEN_SECRET
      );
  } catch (error) {
      throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(decodedToken._id);

  if (!user) {
      throw new ApiError(404, "User not found");
  }

  // 🔐 security check: token must match DB token
  if (user.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Refresh token is expired or reused");
  }

  // 🔄 generate new tokens
  const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

  const options = {
      httpOnly: true,
      secure: true,
      sameSite: 'none'
  };

  return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
          new ApiResponse(
              200,
              { accessToken, refreshToken: newRefreshToken },
              "Access token refreshed successfully"
          )
      );
});

const getAllColleges = asyncHandler(async (req, res) => {
  const colleges = await College.find({}).select("name _id");
  return res.status(200).json(
      new ApiResponse(200, colleges, "Colleges fetched successfully")
  );
});

export {
    registerStudent,
    registerCompany,
    loginUser,
    logoutUser,
    changePassword,
    updateStudentProfile,
    updateCompanyProfile,
    updateAdminProfile,
    getCurrentUser,
    refreshAccessToken,
    getAllColleges
};