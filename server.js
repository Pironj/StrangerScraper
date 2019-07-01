var express = require("express");
var logger = require("morgan");
var mongoose = require("mongoose");
// require('dotenv').config()

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
mongoose.set('useFindAndModify', false);
var MONGODB_URI = "mongodb://heroku_3r17pc0g:s5651051vc1ips9b6g2bc9ao2j@ds221405.mlab.com:21405/heroku_3r17pc0g" || "mongodb://localhost/strangerHeadlines";

mongoose.connect(MONGODB_URI, { useNewUrlParser: true });
// Routes

// A GET route for loading the home page with db articles
app.get("/", function(req, res) {
  db.Article.find({ "saved": false }, function(error, data) {
    console.log(data);
    if (error) {
      console.log(error)
    }
    var hbsObject = {
      article: data
    };
    console.log("Home Route success");
    res.render("home", hbsObject);
  });
});

// Get route to display saved articles on saved.handlebars page
app.get("/saved", function(req, res) {
  db.Article.find({ "saved": true }, function(error, data) {
      if (error) {
        console.log(error);
      }
    })
    .populate("note")
    .then(function(data){
      console.log(data);
      var hbsObject = {
        article: data
      };
      res.render("saved", hbsObject);
    });
});

// A GET route for scraping the echoJS website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with axios
  axios.get("https://www.thestranger.com/features").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);
    console.log($);
    // An empty array to save the data that we'll scrape
    // var results = [];

    // varibale to specify unique class for article div
    var articleClass = "div" + ".row" + ".article" + ".follow";
    // Now, we grab every h2 within an article tag, and do the following:
    $(articleClass).each(function(i, element) {
      // Save an empty result object
      var result = {};
      // define all our properties of our object
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
  });
  res.redirect("/");
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

// route to updated saved boolean to true
app.post("/articles/saved/:id", function(req, res) {
  db.Article.findOneAndUpdate({ "_id": req.params.id }, {$set: { "saved": true }})
  .then(function(error, data) {
    if (error) {
      console.log(error);
    } else {
      res.json(data);
    }
  });
  res.render("home");
});
// route to updated saved boolean to true
app.post("/articles/delete/:id", function(req, res) {
  db.Article.findOneAndUpdate({ "_id": req.params.id }, {$set: {"saved": false}}
  // db.Note.find
  )
  .then(function(error, data) {
    if (error) {
      console.log(error);
    } else {
      res.json(data);
    }
  });
  res.render("saved");
});

// Route for saving/updating an Article's associated Note
app.post("/note/save/:id", function(req, res) {
  db.Note.create(req.body)
    .then(function(dbNote) {
      console.log(dbNote);
      return db.Article.findOneAndUpdate({ _id: req.params.id }, {$push: { note: dbNote }}, { new: true });
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
// Delete note from article route
app.post("/note/delete/:noteId", function(req, res) {
  db.Note.findOneAndRemove({ _id: req.params.noteId }, function(error, res) {
    if (error) {
      console.log(error);
      res.send(error);
    } else {
      db.Article.findOneAndUpdate({ "note": req.params.noteId }, { $pull: {"note": req.params.noteId } })
      .then(function(error) {
        if (error) {
          console.log(error);
        } else {
          res.send("Delete Successful");
        }
      })
    }
  });
  res.render("saved");
});

// Start the server
app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});
