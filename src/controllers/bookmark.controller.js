import mongoose, { Schema, Types } from "mongoose";
import { Bookmark } from "../../models/bookmark.model.js";
import { Tweet } from "../../models/tweet.model.js";
import { APiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../../models/user.model.js";

const bookmarkTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!tweetId) throw new APiError(400, "tweetId is missing");

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) throw new APiError(422, "tweet doesn't exists");

  const isAlreadyBookmarked = await Bookmark.findOne({
    tweetId,
    bookmarkedBy: req.user?._id,
  });

  if (!isAlreadyBookmarked) {
    const bookmarkedTweet = await Bookmark.create({
      tweetId,
      bookmarkedBy: req.user?._id,
    });

    if (!bookmarkedTweet)
      throw new APiError(
        500,
        "something went wrong while bookmarking the tweet"
      );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          bookmarked: true,
        },
        "bookmarked"
      )
    );
  }

  if (isAlreadyBookmarked) {
    const unBookmarkedTweet = await Bookmark.deleteOne({
      tweetId,
      bookmarkedBy: new Schema.Types.ObjectId(req.user?._id),
    });

    if (unBookmarkedTweet.deletedCount === 0)
      throw new APiError(
        500,
        "something went wrong while bookmarking the tweet"
      );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          bookmarked: false,
        },
        "unbookmarked"
      )
    );
  }
});

const allBookMarkedTweets = asyncHandler(async (req, res) => {
  const bookmarkedTweets = await Bookmark.aggregate([
    {
      $match: {
        bookmarkedBy: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "tweets",
        localField: "tweetId",
        foreignField: "_id",
        as: "bookmarkedTweets",
      },
    },
    {
      $project: {
        _id: 0,
        bookmarkedTweets: 1,
      },
    },
    {
      $group: {
        _id: null,
        bookmarkedTweets: {
          $push: "$bookmarkedTweets",
        },
      },
    },
    {
      $project: {
        _id: 0,
        bookmarkedTweets: {
          $reduce: {
            input: "$bookmarkedTweets",
            initialValue: [],
            in: {
              $concatArrays: ["$$value", "$$this"],
            },
          },
        },
      },
    },
  ]);

  if (!bookmarkedTweets) {
    throw new APiError(500, "something went wrong while fetching the tweets");
  }
  console.log(bookmarkedTweets);

  return res
    .status(200)
    .json(
      new ApiResponse(
        201,
        bookmarkedTweets,
        "bookmarked tweets fetched successfully"
      )
    );
});

export { bookmarkTweet, allBookMarkedTweets };
