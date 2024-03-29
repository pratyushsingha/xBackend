import mongoose from "mongoose";
import { Comment } from "../../models/comment.model.js";
import { Like } from "../../models/like.model.js";
import { Tweet } from "../../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const disLikeTweet = asyncHandler(async (req, res, tweetId) => {
  const dislikedTweet = await Like.findOneAndDelete({
    tweetId,
    likedBy: req.user?._id,
  });
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
  if (!dislikedTweet) throw new ApiError(500, "unable to dislike the tweet");

  return res
    .status(201)
    .json(new ApiResponse(201, tweet, "tweet disliked successfully"));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  if (!tweetId) throw new ApiError(400, "tweet id is missing");

  const tweetExists = await Tweet.findById(tweetId);

  if (!tweetExists) throw new ApiError(400, "tweet doesn't exists");
  const isAlreadyLiked = await Like.findOne({
    tweetId,
    likedBy: req.user?._id,
  });
  //   console.log(isAlreadyLiked);
  if (!isAlreadyLiked) {
    const likedTweet = await Like.create({
      tweetId,
      likedBy: req.user._id,
    });

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

    if (!likedTweet) throw new ApiError(500, "unable to like the tweet");
    return res
      .status(200)
      .json(new ApiResponse(201, tweet, "tweet liked successfully"));
  }

  if (isAlreadyLiked) {
    await disLikeTweet(req, res, tweetId);
  }
});

const disLikeComment = asyncHandler(async (req, res, commentId) => {
  const dislikedComment = await Like.deleteOne({
    commentId,
    likedBy: req.user?._id,
  });
  if (!dislikedComment) throw new ApiError(500, "unable to dislike the tweet");

  const comment = await Comment.aggregate([
    [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(commentId),
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
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "commentId",
          as: "likes",
        },
      },
      {
        $unwind: {
          path: "$ownerDetails",
        },
      },
      {
        $addFields: {
          likeCount: {
            $size: "$likes",
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
          ownerDetails: 1,
          likeCount: 1,
          isLiked: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ],
  ]);

  return res
    .status(201)
    .json(new ApiResponse(201, comment, "comment disliked successfully"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!commentId) throw new ApiError(400, "comment id is required");
  const comment = await Comment.findById(commentId);

  if (!comment) throw new ApiError(400, "comment doesn't exists");

  const isAlreadyLiked = await Like.findOne({
    commentId,
    likedBy: req.user?._id,
  });
  if (!isAlreadyLiked) {
    const likedComment = await Like.create({
      commentId,
      likedBy: req.user?._id,
    });
    if (!likedComment) throw new ApiError(500, "unable to like the comment");

    const comment = await Comment.aggregate([
      [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(commentId),
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
          $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "commentId",
            as: "likes",
          },
        },
        {
          $unwind: {
            path: "$ownerDetails",
          },
        },
        {
          $addFields: {
            likeCount: {
              $size: "$likes",
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
            ownerDetails: 1,
            likeCount: 1,
            isLiked: 1,
            createdAt: 1,
            updatedAt: 1,

          },
        },
      ],
    ]);

    return res
      .status(200)
      .json(new ApiResponse(201, comment, "liked successfully"));
  }

  await disLikeComment(req, res, commentId);
});

const likedTweets = asyncHandler(async (req, res) => {
  const tweets = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "tweets",
        localField: "tweetId",
        foreignField: "_id",
        as: "likedTweets",
        pipeline: [
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
        ],
      },
    },
    {
      $group: {
        _id: null,
        likedTweets: {
          $push: "$likedTweets",
        },
      },
    },
    {
      $project: {
        _id: 0,
        likedTweets: {
          $reduce: {
            input: "$likedTweets",
            initialValue: [],
            in: {
              $concatArrays: ["$$value", "$$this"],
            },
          },
        },
      },
    },
  ]);

  if (!tweets)
    throw new ApiError(
      500,
      "something went wrong while fetching the liked tweets"
    );

  return res
    .status(200)
    .json(new ApiResponse(201, tweets, "liked tweets fetched successfully"));
});

export { toggleTweetLike, toggleCommentLike, likedTweets };
