const express = require("express");
const app = express();
const PORT = process.env.PORT || 8080;
const mongoUtil = require("./connect");
const bodyParser = require("body-parser");
const emailUtil = require("./email");
const { Db } = require("mongodb");

const PROF_SEARCH_LIMIT = 10;

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

mongoUtil.connectToServer((err, client) => {
  if (err) console.log("Profesy server: 🛑 Error Connecting to Server");
  console.log("Profesy server: ✅ Server Connected");
  const profs = mongoUtil.getDb().collection("professors");
  const users = mongoUtil.getDb().collection("Users");

  app.use(bodyParser.urlencoded({ extended: true }));

  app.get("/professors", function (req, res) {
    let name = req.query.name;
    const regex = new RegExp(escapeRegex(req.query.name), "gi");

    profs
      .find({ name: regex })
      .limit(PROF_SEARCH_LIMIT)
      .toArray((err, results) => {
        res.send({ professors: results });
      });
  });
  app.get("/", (req, res) => {
    res.send("Hello from Profesi server!");
  });

  app.get("/login", (req, res) => {
    let user = req.query.username;
    let pw = req.query.password;
    let loggedIn = false;
    users.findOne({ username: user }, (err, results) => {
      console.log(results);
      res.send({
        message: results,
        loggedIn: results !== null && results.password === req.query.password,
      });
    });
  });

  app.get("/signup", (req, res) => {
    //add new users
    //TODO:
    // - determine if user exists
    // - add user to database otherwise send back fail status (look at login)
    // - send back confirmation as well as user object
    // - add sha256 encryption for both login in sign up.
    //      - this can be done on the front end. the passwords should never leave the front end without being
    //        encrypted, i've already import a library called js-sha256
    let user = req.query.username;
    let pw = req.query.password;
    let email = req.query.email;
    let name = req.query.name;
    let emailExists = false;
    let usernameExists = false;
    users.findOne(
      { $or: [{ username: user }, { email: email }] },
      (err, results) => {
        if (results) {
          if (results.email === email) emailExists = true;
          if (results.username === user) usernameExists = true;
        }

        if (!emailExists && !usernameExists) {
          users.insertOne(
            {
              username: user,
              password: pw,
              email: email,
              name: name,
              favProfs: [],
            },
            (err, data) => {
              res.send({
                userInsert: 1,
                name: name,
                username: user,
                email: email,
              });

              return;
            }
          );
        } else {
          res.send({
            userInsert: 0,
            emailExists: emailExists,
            usernameExists: usernameExists,
          });
          console.log("USER CREATED");
        }
      }
    );
  });

  app.get("/resetPass", (req, res) => {
    const emailAddress = req.query.email;
    const code = emailUtil.sendEmail(emailAddress);
    res.send({ code: code });
  });

  app.get("/changePass", (req, res) => {
    const username = req.query.username;
    const password = req.query.password;

    users.updateOne(
      { username: username },
      { $set: { password: password } },
      (err, data) => {
        if (err) res.send({ message: "error" });
        else res.send({ message: "Password successfully updated!" });
      }
    );
  });

  app.get("/profsByCourse", (req, res) => {
    const course = req.query.course;

    profs
      .aggregate([
        { $unwind: "$courses" },
        { $match: { "courses.course": { $in: [course] } } },
        { $group: { _id: null, profList: { $addToSet: "$name" } } },
      ])
      .toArray((err, results) => {
        if (err) console.error(err);
        else res.send({ message: results });
      });
  });

  app.get("/courses", (req, res) => {
    const course = req.query.course;
    const regex = new RegExp(escapeRegex(course), "gi");

    profs
      .aggregate([
        { $unwind: "$courses" },
        { $match: { "courses.course": { $in: [regex] } } },
        { $group: { _id: null, courseList: { $addToSet: "$courses.course" } } },
      ])
      .toArray((err, results) => {
        if (err) console.error(err);
        else res.send({ message: results });
      });
  });

  app.listen(PORT, () => {
    console.log(`Profesy server: 🦧 started on http://localhost:${PORT}`);
  });
});
