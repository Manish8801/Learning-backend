class ApiResponse {
    constructor(statusCode, data = null, message = "Success") {
        Object.assign(this, {
            statusCode,
            data,
            message,
            success: statusCode < 400,
        });
    }
}
export default ApiResponse;
