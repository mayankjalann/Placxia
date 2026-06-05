import mongoose,{Schema} from "mongoose";

const collegeSchema= new Schema({
    name:{
        type: String,
        required: true,
        trim: true
    },
    code:{
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    address:{
        type: String,
        trim: true,
    },
    website:{
        type:String,
        trim: true
    },
    logo:{
        type: String
    }


},{
    timestamps: true
})

export const College=mongoose.model("College",collegeSchema);