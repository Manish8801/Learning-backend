import { Schema, model } from "mongoose";

const subscriptionSchema = new Schema(
    {
        subscriber: { type: Schema.Types.ObjectId, ref: "User" },
        channel: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

const Subscription = model("Subscription", new subscriptionSchema());

export default Subscription;
