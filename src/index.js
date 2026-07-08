import "dotenv/config";
import app from "./app.js"
import connectDB from "../db/index.js";

connectDB()
.then(()=>{
    if (process.env.NODE_ENV !== 'production') {
        app.listen(process.env.PORT || 8000,()=>{
            console.log(`Server running on ${process.env.PORT}`)
        })
    }
})
.catch((err)=>{
    console.log(err.message);
})

export default app;
