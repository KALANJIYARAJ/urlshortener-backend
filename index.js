const express = require("express");
const cors = require("cors");
const app = express();
const mongodb = require("mongodb");
const mongoclient = mongodb.MongoClient;
const dotenv = require("dotenv").config();
const URL = process.env.DB;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
const nodemailer = require("nodemailer");
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const URL1 = process.env.URL1

app.use(
  cors({
    orgin: "https://papaya-kataifi-4a8871.netlify.app",
  })
);

app.use(express.json());

let account = [];

//create_user
app.post("/user/register", async (req, res) => {
  try {
    const connection = await mongoclient.connect(URL);
    const db = connection.db("url_shortener");

    //hash
    var salt = await bcrypt.genSalt(10); //$2b$10$TuImFpJf327l0XDn5.Ropu
    var hash = await bcrypt.hash(req.body.password, salt); //$2b$10$h0vKL1wJUpyhf0Q2EHPbcuzeih1kCX7c891uS70nB5FFjRkBSaDHC
    // console.log(hash);

    req.body.password = hash;

    await db.collection("users").insertOne(req.body);

    const user = await db
      .collection("users")
      .findOne({ email: req.body.email });
    await connection.close();

    var transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL,
        pass: PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    var mailOptions = {
      from: EMAIL,
      to: user.email,
      subject: "Rest Password",
      text: "Hi Raj",
      html: `<h1>Hiii ${user.first_name} <a href="http://localhost:3000/activation/${user._id}">please click the link and reset your password</a> </h1>`,
    };
    transporter.sendMail(mailOptions, function (error, response) {
      if (error) {
        console.log(error);
        return;
      }
      transporter.close();
    });

    res.json({ message: "check your email for activation" });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
});

//account activation
app.put("/activation/:userId", async (req, res) => {
  try {
    const connection = await mongoclient.connect(URL);
    const db = connection.db("url_shortener");

    const user = await db
      .collection("users")
      .updateOne(
        { _id: mongodb.ObjectId(req.params.userId) },
        { $set: { activation: req.body.activation } }
      );
    await connection.close();
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: "Something went wrong" });
  }
});

//user-login
app.post("/login", async (req, res) => {
  try {
    const connection = await mongoclient.connect(URL);
    const db = connection.db("url_shortener");

    const user = await db
      .collection("users")
      .findOne({ email: req.body.email });
    await connection.close();
    if (user) {
      const compare = await bcrypt.compare(req.body.password, user.password);
      if (compare) {
        const token = jwt.sign({ _id: user._id }, JWT_SECRET, {
          expiresIn: "2m",
        });
        if (user.activation == true) {
          res.json(user);
        } else {
          res.json({ message: "Ender Vaild email id" });
        }
      } else {
        res.json({ message: "username or password incorrect" });
      }
    } else {
      res.json({ message: "username or password incorrect" });
    }
  } catch (error) {
    res.status(400).json({ message: "Something went wrong" });
  }
});

//sent msg to register email id
app.post("/forgot", async (req, res) => {
  try {
    const connection = await mongoclient.connect(URL);
    const db = connection.db("url_shortener");

    const user = await db
      .collection("users")
      .findOne({ email: req.body.email });
    await connection.close();

    if(user){

    var transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL,
        pass: PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    var mailOptions = {
      from: EMAIL,
      to: user.email,
      subject: "Rest Password",
      text: "Hi Raj",
      html: `<h1>Hiii ${user.name} <a href="http://localhost:3000/reset/${user._id}">please click the link and reset your password</a> </h1>`,
    };
    transporter.sendMail(mailOptions, function (error, response) {
      if (error) {
        console.log(error);
        return;
      }
      transporter.close();
    });

    res.json("Message sent");
  }else{
    res.json("The email id does't not registered")
  }
  } catch (error) {
    res.status(400).send({ sucess: false, msg: error.message });
  }
});

//update password from link
app.post("/reset/:userId", async (req, res) => {
  try {
    const connection = await mongoclient.connect(URL);
    const db = connection.db("url_shortener");

    var salt = await bcrypt.genSalt(10);
    var hash = await bcrypt.hash(req.body.password, salt);
    req.body.password = hash;

    const user = await db
      .collection("users")
      .updateOne(
        { _id: mongodb.ObjectId(req.params.userId) },
        { $set: { password: req.body.password } }
      );
    await connection.close();
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: "Something went wrong" });
  }
});

app.post("/create_link", async (req, res) => {
  try {
    const connection = await mongoclient.connect(URL);
    const db = connection.db("url_shortener");
    let shortUrl = generateUrl();
     await db
      .collection("links")
      .insertOne({
        longUrl: req.body.longUrl,
        shortUrl: shortUrl,
        userId:req.body.userId,
        count:0
      });

      const link =await db.collection("links").findOne({ longUrl: req.body.longUrl });
    await connection.close();
    res.json(link);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.get("/linklist/:userId", async (req, res) => {
  try {
    const connection = await mongoclient.connect(URL);
    const db = connection.db("url_shortener");
    const linklist = await db.collection("links").find({ userId:(req.params.userId)}).toArray();
    await connection.close();
    res.json(linklist);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong for user creation" });
  }
});

//delete link
app.delete("/delete/:urlId", async (req,res)=>{
  try {
    const connection = await mongoclient.connect(URL);
    const db = connection.db("url_shortener");
    const linklist = await db.collection("links").deleteOne({ _id:mongodb.ObjectId(req.params.urlId) })
    await connection.close();
    res.json(linklist);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong for user creation" });
  }
});

//redirect link
app.get("/:urlId", async (req,res)=>{
  try {
    const connection = await mongoclient.connect(URL);
    const db = connection.db("url_shortener");
    const redirectLink = await db.collection("links").findOne({ shortUrl:req.params.urlId })
    await db.collection("links").updateOne({ shortUrl:req.params.urlId },{ $inc: { count: 1 } })
    await connection.close();
   // console.log(redirectLink.longUrl);
    res.redirect(redirectLink.longUrl);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong for user creation" });
  }
})

//frond end redirect
app.get('/',function(req,res){
    res.redirect('https://papaya-kataifi-4a8871.netlify.app/');
  });


app.listen(process.env.PORT || 3003);


function generateUrl() {
  var rndResult = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;

  for (var i = 0; i < 5; i++) {
    rndResult += characters.charAt(
      Math.floor(Math.random() * charactersLength)
    );
  }
  console.log(rndResult);
  return rndResult;
}
