const { Schema, model } = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty!'],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    tour: {
      type: Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.'],
    },
    user: {
      type: Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must have a user.'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

// QUERY MIDDLEWARE ===========================================================
reviewSchema.pre(/^find/, function (next) {
  this.populate([
    {
      path: 'user',
      select: 'name photo',
    },
    // {
    //   path: 'tour',
    //   select: 'name',
    // },
  ]);
  next();
});

// this is calculated on route /tours/:id/reviews
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
  console.log(stats);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    // Reset Tour value defaults
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

// Calls this after a NEW review has been created
reviewSchema.post('save', function () {
  // this points to the current review
  this.constructor.calcAverageRatings(this.tour);
});

// 1) SAVE review document reference...
reviewSchema.pre(/^findOneAnd/, async function (next) {
  // retrieve current document from database and save that document entity in a
  // variable so that it can be referenced later
  this.r = await this.findOne();
  // console.log(this.r);
  next();
});

// 2) Use the review document reference to calculate the average rating value
reviewSchema.post(/^findOneAnd/, async function () {
  // await this.findOne(); does NOT work here, query has already executed
  await this.r.constructor.calcAverageRatings(this.r.tour);
});

module.exports = model('Review', reviewSchema);
