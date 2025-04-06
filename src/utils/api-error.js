class ApiError extends Error {
    constructor(
        statusCode,
        message = "Something went wrong",
        data = null,
        errors = [],
        stack = ""
    ) {
        super(message);

        Object.assign(this, {
            statusCode,
            data,
            message,
            errors,
            success: false,
            stack: stack || Error.captureStackTrace(this, this.constructor),
        });
    }
}

export default ApiError;
