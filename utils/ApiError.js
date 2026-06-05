class ApiError extends Error{
    constructor(
        statusCode,
        message= "Something went wrong",
        errors=[],
        stack=""
    ){
        super(message)
        this.statusCode=statusCode
        this.data=null
        this.message=message
        this.success=false;
        this.errors=errors

        if(stack){
            this.stack=stack
        }else{
            Error.captureStackTrace(this,this.constructor) //acha sa stack trace banao but mera ye class ko include mat krlio
        }
    }
}

export {ApiError}