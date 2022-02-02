const express = require("express");
const app = express();
const passport = require("passport");
const flash = require("express-flash");
const bcrypt = require("bcrypt");
const session = require("cookie-session");
const methodOverride = require("method-override");
const mysql = require("mysql");
const formidable = require("express-formidable");
const path = require("path");
const fs = require('fs') 

const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('./db.sql');


// db.all(`SELECT * FROM offers`, (err, res) => {
//   console.log(res)
// })



// db.run("CREATE TABLE `offers`( 	id int AUTO_INCREMENT, brand varchar(30),   model varchar(40),  title varchar(256),   price int,   year_made int,    kilometers_driven int,  transmission varchar(10),   phone_number varchar(20), description varchar(256),   image_blob longblob,    created_by varchar(256),   email varchar(256),      PRIMARY KEY(id) );")
// db.run("DROP TABLE `offers`", (err, res) => {
//   console.log('sucexs', res)
// })


// da dov users

let users = []

db.all('SELECT * FROM users', (err, res) => {
  users = res;    
})

const initializePassport = require("./passport-config");
initializePassport(
  passport,
  (email) => users.find((user) => user.email === email),
  (id) => users.find((user) => user.id === id)
);
app.set("view-engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(express.static("public"));
app.use(
  session({
    secret: "skiski",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "Vicauto")));

app.get("/", (req, res) => {
  const database = require("./public/database");
  let indexOffers = []
  db.all(`SELECT * FROM offers ORDER BY price DESC LIMIT 8`, (err, result) => {
    indexOffers = result;
    res.render("index.ejs", { result: indexOffers, database: database, });   
  })
});

let fields = null;
app.post("/", (req, res) => {
  fields = req.body;
  if (fields.brand == "Any") fields.brand = "";
  res.redirect("/offers");
});

app.get("/create_offer", checkAuthenticated, (req, res) => {
  
  const database = require("./public/database");
  res.render("createOffer.ejs", { user: req.user, database: database });
});

app.post("/create_offer", checkAuthenticated, (req, res) => {
    let insert = db.prepare(`INSERT INTO offers VALUES (${Math.floor(Math.random()*100000000)}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insert.run(Object.values({
      ...req.body,
      ...{
        created_by: req.user.name,
        email: req.user.email,
      }})); 
    res.redirect("/my_offers");
});

app.get("/login", checkNotAuthenticated, (req, res) => {
  db.all('SELECT * FROM users', (err, res) => {
    users = res;    
  })
  let c = 0;
  for (rawHeader of req.rawHeaders) {
    if (rawHeader.split("/")[rawHeader.split("/").length - 1] == "login") {
      c++;
      break;
    }
  }
  if (c) {
    res.render("login.ejs", { incorrectPassword: " " });
  } else {
    res.render("login.ejs");
  }
});

app.post(
  "/login",
  checkNotAuthenticated,
  passport.authenticate("local", {
    successRedirect: "/my_offers",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/register", checkNotAuthenticated, (req, res) => {
  res.render("register.ejs", { alreadyInTheSystem: "" });
});


app.post("/register", checkNotAuthenticated, async (req, res) => {

  const pw = await bcrypt.hash(req.body.password, 10);
  try {
    const user = {
      id: parseInt(Date.now().toString()),
      name: req.body.name,
      email: req.body.email,
      password: pw,
    };

    // var stmt = db.prepare('INSERT INTO use VALUES (?, ?, ?, ?)');  
    // stmt.run(Object.values(user))
    // stmt.finalize();
    
              
          if(users.map(usr=>usr.email).includes(req.body.email)){
            res.render("register.ejs", {
              alreadyInTheSystem: "A user with this email already exists.",
            });
          } else if (users.map(usr=>usr.name).includes(req.body.name)) {
            res.render("register.ejs", {
              alreadyInTheSystem: "Username is already taken.",
            });
          } else {
            let insert = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?)");
            insert.run(Object.values(user));
            res.redirect("/login");
          }



  } catch {
    res.redirect("/register");
  }



  
});

app.get("/offers", (req, res) => {
  let conditions = {
    brand: [null, "brand = "],
    model: [null, "model = "],
    year: [null, "year_made >= "],
    kilometers_driven: [null, "kilometers_driven <= "],
    price: [null, "price <= "],
  };

  for (field of Object.keys(fields)) {
    conditions[field].shift();
    if (field === "brand" && !fields[field] === "") {
      conditions[field] = [`"'${fields[field]}'"`, ...conditions[field]];
    } else if (field === "model")
      conditions[field] = [fields[field], ...conditions[field]];
    else conditions[field] = [fields[field], ...conditions[field]];
  }
  let criteria_count = Object.values(conditions).filter(
    (condition) => condition[0]
  ).length;

  let filters = [];
  for (let filter of Object.values(conditions).filter(
    (condition) => condition[0]
  )) {
    if (filter[1] === "brand = " || filter[1] === "model = ") {
      filters.push(filter[1] + '"' + filter[0] + '"');
    } else filters.push(filter[1] + filter[0]);
  }
  let sql = `SELECT * FROM offers `;
  if (criteria_count == 0) {
    const x = null;
  } else {
    sql += `WHERE ${filters.join(" and ")}`;
  }

  let offers = []
  db.all(sql, (e, r) => {
    offers = r
    res.render("offers.ejs", { offers: offers});   
  })
});


//OSTANA SAMO SINGLE OFFER


app.get("/offer/:title/:id", (req, res) => {
  let sql = `SELECT * FROM offers WHERE id='${req.params.id}'`;
    // res.render("singleOffer.ejs", {offer: re, youMayLike: [], actualLocation: `/offer/${re.title
    //               .split(" ")
    //               .join("-")
    //               .split("'")
    //               .join("")
    //               .toLowerCase()}/${re.id}`})
  db.all(sql, (err, result) => {
    if (result.length) {
      if (err) throw err;
      let youMayLike = []
      db.all(
        `SELECT * FROM offers WHERE NOT id='${
          req.params.id
        }' AND ((price BETWEEN ${(result[0].price * 8) / 10} AND ${
          (result[0].price * 12.5) / 10
        }) OR (brand='${result[0].brand}'))`,
        (err1, otherOffers) => {
          youMayLike = otherOffers;
          res.render("singleOffer.ejs", {
            offer: result[0],
            youMayLike: youMayLike,
            actualLocation: `/offer/${result[0].title
              .split(" ")
              .join("-")
              .split("'")
              .join("")
              .toLowerCase()}/${result[0].id}`,
          });
        }
      );
    } else {
      res.sendStatus(404);
    }
  });
});

app.get("/my_offers", checkAuthenticated, (req, res) => {
  let myOffers = []
  db.all(`SELECT * FROM offers where created_by='${req.user.name}'`, (err, result) => {
    myOffers = result
    res.render("myOffers.ejs", { myOffers: myOffers });   
  })
});

app.get("/offer/edit/:offername/:id", checkAuthenticated, (req, res) => {
  const database = require("./public/database");
  let sql = `SELECT * FROM offers WHERE id='${req.params.id}'`;
  db.each(sql, (err, result) => {
    try {
      if (req.user["email"] == result.email) {
        res.render("editOffer.ejs", {
          user: req.user,
          offer: result,
          database: database,
        });
      } else {
        res.sendStatus(404);
      }
    } catch {
      res.stat;//kvo stava tuka opravi go
    }
  });
});

app.post("/offer/edit/:offername/:id", checkAuthenticated, (req, res) => {
  const updates = {};
  const toChange = []
  const toChangeVal = []
  for (update of ['id', 'brand', 'model', 'title', 'price', 'year_made', 'kilometers_driven', 'transmission', 'phone_number', 'description', 'image_blob', 'created_by', 'email']) {
    if(Object.keys(req.body).includes(update)) {
      updates[update] = req.body[update]
      if(req.body[update] != ''){
        toChange.push(`${update}=?`)
        toChangeVal.push(req.body[update])
      }
    } else {
      updates[update] = ''
    }
  }
  let sql = "UPDATE offers SET " + toChange.join(', ') + ` WHERE id=${req.params.id}`;

  db.run(sql, toChangeVal);
  res.redirect("/my_offers");
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});

app.delete("/my_offers", (req, res) => {
  db.run(`DELETE FROM offers WHERE id='${req.body.id}'`, (err, resut) => {
    let myOffers = []
    db.all(`SELECT * FROM offers where created_by='${req.user.name}'`, (err, result) => {
      myOffers = result
      res.render("myOffers.ejs", { myOffers: myOffers, success: true });   
    })
  });
});

app.use(function (req, res, next) {
  res.sendStatus(404);
  next();
});

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  res.redirect("/login");
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}

app.listen(process.env.PORT || 3000);

// taka create i edit offer redesign i rename

// VIC_AUTO CREATE TABLE `vic_auto`( 	id int AUTO_INCREMENT,   title varchar(256),   price int,   brand varchar(30),   model varchar(40),   description varchar(256),   kilometers_driven int,   year_made int,   created_by varchar(256),   email varchar(256),   phone_number varchar(256),   image_blob longblob,   transmission varchar(10),   PRIMARY KEY(id) );

// CREATE TABLE `users` ( id varchar(40), name varchar(40), email varchar(60), password varchar(60))