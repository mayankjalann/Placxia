import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Offer } from "../models/offer.model.js";
import { Application } from "../models/application.model.js";
import { Company } from "../models/company.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Student } from "../models/student.model.js";

const createOffer=asyncHandler(async (req,res)=>{
    const {applicationId}=req.params;

    const{offeredCtc,joiningDate}=req.body;

    if(!offeredCtc){
        throw new ApiError(400, "Offered CTC is required");
    }

    const company= await Company.findOne({user: req.user._id});

    if(!company){
        throw new ApiError(404, "Company profile not found");
    }

    const application= await Application.findById(applicationId)
    .populate("job");

    if(application.job.company.toString() !== company._id.toString()){
        throw new ApiError(403, "You cannot make an offer for this job");
    }

    if(application.status !== "SELECTED"){
        throw new ApiError(400, "Student must be 'SELECTED' before generating an offer");
    }

    const existingOffer= await Offer.findOne({application: application._id});

    if(existingOffer){
        throw new ApiError(400, "An offer has already been made for this application");
    }

    const offer= await Offer.create({
        student: application.student,
        company: company._id,
        job: application.job._id,
        application: application._id,
        offeredCtc,
        joiningDate,
        status: "PENDING" 
    });

    return res.status(201).json(
        new ApiResponse(201, offer, "Offer successfully sent to the student!")
    );
})

const respondToOffer= asyncHandler(async(req,res)=>{
    const {offerId}=req.params;
    const {status}=req.body;

    if (status !== "ACCEPTED" && status !== "DECLINED") {
        throw new ApiError(400, "Status must be either ACCEPTED or DECLINED");
    }

    const student=await Student.findOne({user: req.user._id});

    if(!student){
        throw new ApiError(404, "Student profile not found");
    }

    const offer= await Offer.findById(offerId);

    if(!offer){
        throw new ApiError(404, "Offer not found");
    }

    if(offer.student.toString() !== student._id.toString()){
        throw new ApiError(403, "You do not have permission to respond to this offer");
    }

    if (offer.status !== "PENDING") {
        throw new ApiError(400, `You have already ${offer.status.toLowerCase()} this offer`);
    }

    offer.status=status;

    await offer.save();

    if(status=="ACCEPTED"){
        student.placementStatus="PLACED";
        student.placedAt= new Date();
        student.placedInJob=offer.job;

        await student.save();
    }

    return res.status(200).json(
        new ApiResponse(200, offer, `Successfully ${status.toLowerCase()} the offer!`)
    );


})

const getStudentOffers = asyncHandler(async (req, res) => {
    // 1. Find the student
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
        throw new ApiError(404, "Student profile not found");
    }

    // 2. Fetch all offers for this student
    const offers = await Offer.find({ student: student._id })
        .populate("company", "name logoUrl industry") // Get company name & logo
        .populate("job", "title location")           // Get job title
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new ApiResponse(200, offers, "Offers fetched successfully")
    );
});

const getCompanyOffers = asyncHandler(async (req, res) => {
    // 1. Find the company
    const company = await Company.findOne({ user: req.user._id });
    if (!company) {
        throw new ApiError(404, "Company profile not found");
    }
    // 2. Fetch all offers made by this company
    const offers = await Offer.find({ company: company._id })
        .populate({
            path: "student",
            select: "name branch cgpa rollNo" // Get the student details
        })
        .populate("job", "title") // Get the job title
        .sort({ createdAt: -1 });
    return res.status(200).json(
        new ApiResponse(200, offers, "Company offers fetched successfully")
    );
});

export {createOffer, 
    respondToOffer, 
    getStudentOffers, 
    getCompanyOffers};