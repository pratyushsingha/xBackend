import mongoose, { isValidObjectId } from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Tweet } from "../../models/tweet.model.js";
import { User } from "../../models/user.model.js";
import { getMongoosePaginationOptions } from "../utils/helper.js";
import { cloudinaryUpload } from "../utils/cloudinary.js";

const createTweet = asyncHandler(async (req, res) => {
  const { content, isAnonymous } = req.body;
  if (!content) {
    throw new ApiError(400, "tweet can't be empty");
  }
  let imagesLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.images) &&
    req.files.images.length > 0
  ) {
    imagesLocalPath = req.files.images.map((file) => file.path);
  }
  // console.log(imagesLocalPath);

  let uploadImages = [];
  if (imagesLocalPath && imagesLocalPath.length > 0) {
    for (let path of imagesLocalPath) {
      const uploadedImage = await cloudinaryUpload(path);
      uploadImages.push(uploadedImage.url);
    }
  }

  const tweet = await Tweet.create({
    content,
    images: uploadImages,
    isAnonymous,
    owner: req.user._id,
  });
  if (!tweet) {
    throw new ApiError(500, "unable to create tweet");
  }

  return res
    .status(200)
    .json(new ApiResponse(201, tweet, "tweet created successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;
  if (!tweetId) {
    throw new ApiError(400, "tweetId is required");
  }

  const existingTweet = await Tweet.findById(tweetId);
  if (!existingTweet) {
    throw new ApiError(400, "tweet doesn't exist");
  }

  const verifyUser =
    existingTweet.owner?._id.toString() === req.user?._id.toString();
  if (!verifyUser) {
    throw new ApiError(400, "unauthorized access");
  }

  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content,
      },
    },
    { new: true }
  );

  if (!updatedTweet) {
    throw new ApiError(500, "unable to update the tweet");
  }
  return res
    .status(200)
    .json(new ApiResponse(201, updatedTweet, "tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  const existingTweet = await Tweet.findById(tweetId);
  if (!existingTweet) {
    throw new ApiError(400, "tweet doesn't exist");
  }

  const verifyUser =
    existingTweet.owner?._id.toString() === req.user?._id.toString();
  if (!verifyUser) {
    throw new ApiError(400, "unauthorized access");
  }
  const deletedTweet = await Tweet.findByIdAndDelete(tweetId);
  if (!deletedTweet) {
    throw new ApiError(500, "unable to delte the tweet");
  }
  return res
    .status(200)
    .json(new ApiResponse(201, "tweet deleted successfully"));
});

const myTweets = asyncHandler(async (req, res) => {
  const userTweets = await Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$ownerDetails",
      },
    },

    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweetId",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "tweetId",
        as: "comments",
      },
    },
    {
      $lookup: {
        from: "bookmarks",
        localField: "_id",
        foreignField: "tweetId",
        as: "bookmarks",
      },
    },
    {
      $addFields: {
        likeCount: {
          $size: "$likes",
        },
        commentCount: {
          $size: "$comments",
        },
        isLiked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$likes.likedBy"],
            },
            then: true,
            else: false,
          },
        },
        isBookmarked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$bookmarks.bookmarkedBy"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        content: 1,
        images: 1,
        isAnonymous: 1,
        createdAt: 1,
        updatedAt: 1,
        ownerDetails: 1,
        likeCount: 1,
        commentCount: 1,
        isLiked: 1,
        isBookmarked: 1,
      },
    },
  ]);

  if (!userTweets)
    throw new ApiError(500, "something went wrong while fetching ur tweets");

  return res
    .status(200)
    .json(new ApiResponse(201, userTweets, "tweets fetched successfully"));
});

const publicTweets = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username.trim()) throw new ApiError(422, "username is required");

  const tweets = await User.aggregate([
    {
      $match: {
        username,
      },
    },
    {
      $lookup: {
        from: "tweets",
        localField: "_id",
        foreignField: "owner",
        as: "allTweets",
        pipeline: [
          {
            $lookup: {
              from: "likes",
              localField: "_id",
              foreignField: "tweet",
              as: "likes",
            },
          },
          {
            $lookup: {
              from: "comments",
              localField: "_id",
              foreignField: "tweet",
              as: "comments",
            },
          },
          {
            $addFields: {
              likeCount: {
                $size: "$likes",
              },
              commentCount: {
                $size: "$comments",
              },
              isLiked: {
                $cond: {
                  if: {
                    $in: [req.user?._id, "$likes.likedBy"],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              _id: 1,
              content: 1,
              images: 1,
              isAnonymous: 1,
              createdAt: 1,
              updatedAt: 1,
              likeCount: 1,
              commentCount: 1,
              isLiked: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        publicTweets: {
          $filter: {
            input: "$allTweets",
            as: "tweets",
            cond: {
              $eq: ["$$tweets.isAnonymous", false],
            },
          },
        },
      },
    },
    {
      $project: {
        username: 1,
        avatar: 1,
        publicTweets: 1,
      },
    },
  ]);

  if (!tweets)
    throw new ApiError(
      500,
      "something went wrong while fetching all the tweets"
    );

  return res
    .status(200)
    .json(new ApiResponse(201, tweets, "public tweets fetched successfully"));
});

const toggleIsAnonymous = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  if (!tweetId) throw new ApiError(422, "tweetId is required");

  if (!isValidObjectId(tweetId)) throw new ApiError(409, "invalid tweetId");

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) throw new ApiError(409, "tweet doesn't exist");

  if (!(tweet.owner.toString() === req.user?._id.toString()))
    throw new ApiError(409, "unAuthorized request");
  let toggleStatus;
  if (tweet.isAnonymous === true) {
    toggleStatus = await Tweet.findByIdAndUpdate(
      tweetId,
      {
        $set: {
          isAnonymous: false,
        },
      },
      { new: true }
    );
    if (!toggleStatus)
      throw new ApiError(500, "something went wrong while updating the status");

    return res.status(200).json(
      new ApiResponse(
        201,
        {
          isAnonymous: false,
        },
        "tweet set to public"
      )
    );
  }

  toggleStatus = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        isAnonymous: true,
      },
    },
    { new: true }
  );

  if (!toggleStatus)
    throw new ApiError(500, "something went wrong while updating the status");

  return res.status(200).json(
    new ApiResponse(
      201,
      {
        isAnonymous: true,
      },
      "tweet set to private"
    )
  );
});

const feedTweets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const tweetAggregate = Tweet.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$ownerDetails",
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweetId",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "tweetId",
        as: "comments",
      },
    },
    {
      $lookup: {
        from: "bookmarks",
        localField: "_id",
        foreignField: "tweetId",
        as: "bookmarks",
      },
    },
    {
      $addFields: {
        likeCount: {
          $size: "$likes",
        },
        commentCount: {
          $size: "$comments",
        },
        isLiked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$likes.likedBy"],
            },
            then: true,
            else: false,
          },
        },
        isBookmarked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$bookmarks.bookmarkedBy"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        likes: 0,
        comments: 0,
        bookmarks: 0,
      },
    },
  ]);

  const tweets = await Tweet.aggregatePaginate(
    tweetAggregate,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalTweets",
        docs: "tweets",
      },
    })
  );

  if (!tweets)
    throw new ApiError(500, "something went wrong while fetching the feed");

  return res
    .status(200)
    .json(new ApiResponse(201, tweets, "tweets fetched successfully"));
});

const getTweetById = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  if (!tweetId) throw new ApiError(422, "tweetId is missing");

  if (!isValidObjectId(tweetId)) throw new ApiError(409, "tweetId is invalid");

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) throw new ApiError(409, "tweet doesn't exists");

  return res
    .status(200)
    .json(new ApiResponse(201, tweet, "tweet fetched successfully"));
});

const tweetDetails = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!tweetId) throw new ApiError(422, "tweetId is required");

  if (!isValidObjectId(tweetId))
    throw new ApiError(422, "tweetId is not valid");

  const tweet = await Tweet.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(tweetId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$ownerDetails",
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweetId",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "tweetId",
        as: "comments",
      },
    },
    {
      $lookup: {
        from: "bookmarks",
        localField: "_id",
        foreignField: "tweetId",
        as: "bookmarks",
      },
    },
    {
      $addFields: {
        likeCount: {
          $size: "$likes",
        },
        commentCount: {
          $size: "$comments",
        },
        isLiked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$likes.likedBy"],
            },
            then: true,
            else: false,
          },
        },
        isBookmarked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$bookmarks.bookmarkedBy"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        likes: 0,
        comments: 0,
        bookmarks: 0,
      },
    },
  ]);

  if (!tweet)
    throw new ApiError(
      500,
      "something went wrong while fetching tweet Details"
    );

  return res
    .status(200)
    .json(new ApiResponse(201, tweet, "tweet fetched successfully"));
});

export {
  createTweet,
  updateTweet,
  deleteTweet,
  myTweets,
  toggleIsAnonymous,
  feedTweets,
  getTweetById,
  publicTweets,
  tweetDetails,
};
