var express = require("express");
var logger = require("morgan");
var mongoose = require("mongoose");

// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");

// Require all models
var db = require("./models");

var PORT = 3000;

// Initialize Express
var app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder
app.use(express.static("public"));

// Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

// Connect to the Mongo DB
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/strangerHeadlines";

mongoose.connect(MONGODB_URI, { useNewUrlParser: true });
// Routes

// A GET route for loading the home page with db articles
app.get("/", function(req, res) {
  db.Article.find({ "saved": false }, function(error, data) {
    var hbsOjbject = {
      article: data
    };
    console.log("Home Route success" + hbsOjbject);
    res.render("home", hbsOjbject);
  });
});

// A GET route for scraping the echoJS website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with axios
  axios.get("https://www.thestranger.com/features").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);
    
    // An empty array to save the data that we'll scrape
    // var results = [];

    // varibale to specify unique class for article div
    var articleClass = "div" + ".row" + ".article" + ".follow";
    // Now, we grab every h2 within an article tag, and do the following:
    $(articleClass).each(function(i, element) {
      // Save an empty result object
      var result = {};
      // define all our properties of our object
      // var img = $(element).children().find("div.image-container").find("img").attr("src");
      // var title = $(element).children().find("h2.headline").text().split("\n      ")[1];
      // var summary = $(element).children().find("h3.subheadline").text().split("\n        ")[1].split("\n    ")[0];
      // var link = $(element).children().find("a").attr("href");

      result.img = $(this)
        .children()
        .find("div.image-container")
        .find("img")
        .attr("src");
      result.title = $(this)
        .children()
        .find("h2.headline")
        .text()
        .split("\n      ")[1];
      result.summary = $(this)
        .children()
        .find("h3.subheadline")
        .text()
        .split("\n        ")[1]
        .split("\n    ")[0];
      result.link = $(this)
        .children()
        .find("a")
        .attr("href");

      // Save these in an object that we'll push into the results array we defined earlier
      // result.push({
      //   img: img,
      //   title: title,
      //   summary: summary,
      //   link: link
      // });

      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function(dbArticle) {
          // View the added result in the console
          console.log(dbArticle);
        })
        .catch(function(err) {
          // If an error occurred, log it
          console.log(err);
        });
    });
  
    // Send a message to the client
    res.send("Scrape Complete");
  });
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  // Grab every document in the Articles collection
  db.Article.find({})
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Start the server
app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});
