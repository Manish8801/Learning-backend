// const asyncHandler = (fn) => async (req, res, next) => {
//   try {
//     await fn(req, res, next);
//   } catch (err) {
//     res.status(err.code || 500).json({ sucess: false, message: err.message });
//   }
// };

const asyncHandler = (fn) => {
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => next(err));
  };
};

export default asyncHandler;
