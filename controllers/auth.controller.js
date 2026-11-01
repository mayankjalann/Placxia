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
import { readFile, unlink } from "node:fs/promises";
import { extname } from "node:path";
import mongoose from "mongoose";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";

const getRequestOrigin = (req) => {
  const protocol = req.get("x-forwarded-proto")?.split(",")[0] || req.protocol;
  return protocol + "://" + req.get("host");
};

const getStudentResumeUrl = (req) => getRequestOrigin(req) + "/api/v1/auth/resume";

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
    const {email,password,name,phone,college}=req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if(!normalizedEmail || !password){
        throw new ApiError(400,"Email and password are required");
    }
    if(password.length < 6){
        throw new ApiError(400,"Password must be at least 6 characters long");
    }

    const allowedStudent=await AllowedStudent.findOne({ email: normalizedEmail });

    if(!allowedStudent){
        throw new ApiError(403, "You are not registered in this college system")
    }

    if (allowedStudent.isRegistered) {
        throw new ApiError(409, "Account already exists. Please login")
    }

    if (college && college.toString() !== allowedStudent.college.toString()) {
        throw new ApiError(403, "The selected college does not match your authorized student record");
    }

    const existingUser= await User.findOne({email: normalizedEmail});

    if(existingUser){
        throw new ApiError(409, "User already exists with this email")
    }

    let user;
    let student;
    try {
        user=await User.create({
            email: normalizedEmail,
            password,
            role: "STUDENT",
            college: allowedStudent.college,
            isVerified: true
        });

        student = await Student.create({
            user: user._id,
            college: allowedStudent.college,
            rollNo: allowedStudent.rollNo,
            branch: allowedStudent.branch,
            batch: allowedStudent.batch,
            name: name?.trim() || normalizedEmail.split("@")[0],
            phone: phone?.trim() || undefined,
        });
          
        // also mark as registered
        allowedStudent.isRegistered = true;
        await allowedStudent.save();

        const createdUser= await User.findById(user._id).select("-password -refreshToken");

        return res
        .status(201)
        .json(
            new ApiResponse(
            201,
            { user: createdUser, student },
            "Student registered successfully"
            )
        )
    } catch (error) {
        if (student?._id) {
            await Student.deleteOne({ _id: student._id }).catch(() => {});
        }
        if (user?._id) {
            await User.deleteOne({ _id: user._id }).catch(() => {});
        }
        allowedStudent.isRegistered = false;
        await allowedStudent.save().catch(() => {});
        throw error;
    }


})

const registerCompany = asyncHandler(async (req, res) => {
    const { email, password, name, industry, website, description, requestedColleges } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const allowedIndustries = ["TECH", "FINANCE", "CORE", "CONSULTING", "ECOMMERCE", "OTHER"];

    if (!normalizedEmail || !password || !name || !industry || !website || !description) {
        throw new ApiError(400, "Email, password, company name, industry, website, and description are required");
    }
    if (password.length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters long");
    }
    if (!allowedIndustries.includes(industry)) {
        throw new ApiError(400, "Please select a valid industry");
    }
    if (!Array.isArray(requestedColleges) || requestedColleges.length === 0) {
        throw new ApiError(400, "Request at least one college to partner with");
    }
    const uniqueRequestedColleges = [...new Set(requestedColleges.map(String))];
    if (!uniqueRequestedColleges.every(mongoose.isValidObjectId)) {
        throw new ApiError(400, "One or more requested colleges are invalid");
    }
    const matchingColleges = await College.countDocuments({
        _id: { $in: uniqueRequestedColleges }
    });
    if (matchingColleges !== uniqueRequestedColleges.length) {
        throw new ApiError(400, "One or more requested colleges could not be found");
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
        const existingCompany = await Company.findOne({ user: existingUser._id });
        if (existingCompany) {
            const approvedRequestedColleges = existingCompany.requestedColleges.filter((requestedId) =>
                existingCompany.approvedColleges.some(
                    (approvedId) => approvedId.toString() === requestedId.toString()
                )
            );

            if (approvedRequestedColleges.length === 0) {
                throw new ApiError(409, "Your company application is already submitted and waiting for college approval. Please sign in to check its status.");
            }

            throw new ApiError(409, "A company account already exists for this email. Please sign in to check its approval status.");
        }

        throw new ApiError(409, "An account with this email already exists. Please sign in.");
    }

    const user = await User.create({
        email: normalizedEmail,
        password,
        role: "COMPANY",
        college: null,
        isVerified: true,
    });

    let company;
    try {
        company = await Company.create({
            user: user._id,
            name,
            industry,
            website,
            description,
            requestedColleges: uniqueRequestedColleges,
        });
    } catch (error) {
        // Avoid leaving a login account behind if the company profile cannot be created.
        await User.deleteOne({ _id: user._id });
        throw error;
    }

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    return res.status(201).json(
        new ApiResponse(
            201,
            { user: createdUser, company },
            "Company registered successfully. Wait for admin approval."
        )
    );
});

const loginUser= asyncHandler(async (req,res)=>{
    const {email,password}=req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if(!normalizedEmail || !password){
        throw new ApiError(400,"Email and password required");
    }
    const user=await User.findOne({email: normalizedEmail});

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
         if (!student) throw new ApiError(404, "Student profile not found");
         loggedInUser.studentProfile = student;
         if (student.resumeUrl === "/api/v1/auth/resume") {
             student.resumeUrl = getStudentResumeUrl(req);
         } else if (student.resumeUrl?.startsWith("http://localhost:")) {
             student.resumeUrl = null;
         }
         loggedInUser.name = student.name;
     } else if (loggedInUser.role === "COMPANY") {
         const company = await Company.findOne({ user: user._id }).lean();
         if (!company) throw new ApiError(409, "Company profile is missing. Please contact support.");
         loggedInUser.companyProfile = company;
         loggedInUser.name = company.name;
     } else if (loggedInUser.role === "ADMIN") {
         const admin = await Admin.findOne({ user: user._id }).lean();
         if (!admin) throw new ApiError(409, "Admin profile is missing. Please contact support.");
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
                    user: loggedInUser
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
      if (req.file?.path) await unlink(req.file.path).catch(() => {});
      throw new ApiError(404, "Student profile not found");
  }

  if (req.file) {
      if (req.file.mimetype !== "application/pdf" || extname(req.file.originalname).toLowerCase() !== ".pdf") {
          await unlink(req.file.path).catch(() => {});
          throw new ApiError(400, "Resume must be a PDF file");
      }

      try {
          student.resumeData = await readFile(req.file.path);
      } finally {
          await unlink(req.file.path).catch(() => {});
      }
      student.resumeContentType = "application/pdf";
      student.resumeUrl = "/api/v1/auth/resume";
      student.resumePublicId = undefined;
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
      "githubUrl"
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

const getStudentResume = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user._id })
      .select("+resumeData +resumeContentType");
  if (!student?.resumeData) {
      throw new ApiError(404, "No resume has been uploaded");
  }

  return res
      .type(student.resumeContentType || "application/pdf")
      .set("Content-Disposition", `inline; filename="resume-${student._id}.pdf"`)
      .set("Cache-Control", "private, no-store")
      .send(student.resumeData);
});

const updateCompanyProfile = asyncHandler(async (req, res) => {

  const company = await Company.findOne({ user: req.user._id });

  if (!company) {
      if (req.file?.path) await unlink(req.file.path).catch(() => {});
      throw new ApiError(404, "Company profile not found");
  }

  let uploadedLogo;
  const oldLogoPublicId = company.logoPublicId;
  if (req.file) {
      if (!req.file.mimetype.startsWith("image/")) {
          await unlink(req.file.path).catch(() => {});
          throw new ApiError(400, "Company logo must be an image");
      }
      const uploadResult = await uploadOnCloudinary(req.file.path);
      if (!uploadResult) {
          throw new ApiError(500, "Failed to upload logo to Cloudinary");
      }
      uploadedLogo = uploadResult;
      company.logoUrl = uploadResult.secure_url;
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

  try {
      await company.save();
  } catch (error) {
      if (uploadedLogo?.public_id) {
          await deleteFromCloudinary(uploadedLogo.public_id, "image");
      }
      throw error;
  }

  if (uploadedLogo && oldLogoPublicId) {
      await deleteFromCloudinary(oldLogoPublicId, "image");
  }

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
      if (!student) throw new ApiError(404, "Student profile not found");
      user.studentProfile = student;
      if (student.resumeUrl === "/api/v1/auth/resume") {
          student.resumeUrl = getStudentResumeUrl(req);
      } else if (student.resumeUrl?.startsWith("http://localhost:")) {
          student.resumeUrl = null;
      }
      user.name = student.name;
  } else if (user.role === "COMPANY") {
      const company = await Company.findOne({ user: user._id }).lean();
      if (!company) throw new ApiError(409, "Company profile is missing. Please contact support.");
      user.companyProfile = company;
      user.name = company.name;
  } else if (user.role === "ADMIN") {
      const admin = await Admin.findOne({ user: user._id }).lean();
      if (!admin) throw new ApiError(409, "Admin profile is missing. Please contact support.");
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
              {},
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
    getStudentResume,
    refreshAccessToken,
    getAllColleges
};
