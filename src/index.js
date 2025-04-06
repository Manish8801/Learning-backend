import "dotenv/config";
import connectDB from "./db/index.js";
import app from "./app.js";
import { PORT } from "./constants.js";

(async () => {
  try {
    await connectDB();
    app.on("error", (err) => {
      console.log("Error while listening to the server");
      throw err;
    });

    app.listen(PORT, () => {
      console.log(`Listening on port ${PORT}`);
    });
  } catch (err) {
    console.log(err.message);
  }
})();
