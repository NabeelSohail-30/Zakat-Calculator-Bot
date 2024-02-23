import express from "express";
import path from "path";
import cors from "cors";
import session from "express-session";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import mongoose from "mongoose";
import dialogflow from "dialogflow";
import { WebhookClient } from "dialogflow-fulfillment";
import { parseArgs } from "util";

const app = express();

app.use(express.json());
app.use(cors());
app.use(morgan("dev"));
app.use(cookieParser());
app.use(
  session({
    secret: "testing123",
    resave: true,
    saveUninitialized: true,
    cookie: { secure: true },
  })
);

app.get("/", (req, res) => {
  res.sendStatus(200);
});

app.get("/ping", (req, res) => {
  res.send("ping back");
});

const port = process.env.PORT || 5001;

/*---------------------Dialogflow Webhook--------------------------*/

app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;
    const session = body.session.split("/").pop(); // Extract session ID from the provided format
    console.log("Session: ", session);

    // Check if session exists in the database, if not, create a new entry
    const existingSession = Zakat.findOne({ session: session });
    console.log("Existing Session: ", existingSession);
    if (!existingSession) {
      console.log("Creating new session");
      const newSession = new Zakat({
        session: session,
      });
      console.log("New Session: ", newSession);
      newSession.save();
      console.log("Session saved");
    }

    const intentName = body.queryResult.intent.displayName;
    const params = body.queryResult.parameters;

    let gold, silver, cash, loan;

    switch (intentName) {
      case "Default Welcome Intent": {
        res.send({
          fulfillmentMessages: [
            {
              text: {
                text: [
                  "Hello There, Welcome to Zakat Calculator. Enter Zakat to continue.",
                ],
              },
            },
          ],
        });
        break;
      }

      case "Gold": {
        res.send({
          fulfillmentMessages: [
            {
              text: {
                text: [
                  "Okay to Calculate Your Zakat Amount, you need to answer some questions. Let's start. How much gold do you have in grams? If you don't have any, just say 0.",
                ],
              },
            },
          ],
          outputContexts: [
            {
              name: `${body.session}/contexts/Gold-followup`,
              lifespanCount: 2, // Adjust the lifespanCount as needed
            },
          ],
        });
        break;
      }

      case "Gold - Silver": {
        if (
          body.queryResult.outputContexts.some((context) =>
            context.name.endsWith("gold-followup")
          )
        ) {
          gold = params.Gold;
          console.log("Gold: ", gold);

          res.send({
            fulfillmentMessages: [
              {
                text: {
                  text: [
                    "Okay, how much silver do you have in grams? If you don't have any, just say 0.",
                  ],
                },
              },
            ],
            outputContexts: [
              {
                name: `${body.session}/contexts/gold-silver-followup`,
                lifespanCount: 2, // Adjust the lifespanCount as needed
              },
            ],
          });
        } else {
          res.send({
            fulfillmentMessages: [
              {
                text: {
                  text: ["Sorry, I didn't get that. Please try again."],
                },
              },
            ],
          });
        }
        break;
      }

      case "Silver-Cash": {
        if (
          body.queryResult.outputContexts.some((context) =>
            context.name.endsWith("gold-silver-followup")
          )
        ) {
          silver = params.Silver;
          console.log("Silver: ", silver);

          res.send({
            fulfillmentMessages: [
              {
                text: {
                  text: [
                    "Okay, how much total cash and bank balance do you have? If you don't have any, just say 0.",
                  ],
                },
              },
            ],
            outputContexts: [
              {
                name: `${body.session}/contexts/silver-cash-followup`,
                lifespanCount: 2, // Adjust the lifespanCount as needed
              },
            ],
          });
        } else {
          res.send({
            fulfillmentMessages: [
              {
                text: {
                  text: ["Sorry, I didn't get that. Please try again."],
                },
              },
            ],
          });
        }
        break;
      }

      case "Cash-Loan": {
        if (
          body.queryResult.outputContexts.some((context) =>
            context.name.endsWith("silver-cash-followup")
          )
        ) {
          cash = params.Cash;
          console.log("Cash: ", cash);

          res.send({
            fulfillmentMessages: [
              {
                text: {
                  text: [
                    "Okay, how much loan do you have to pay? If you don't have any, just say 0.",
                  ],
                },
              },
            ],
            outputContexts: [
              {
                name: `${body.session}/contexts/cash-loan-followup`,
                lifespanCount: 2, // Adjust the lifespanCount as needed
              },
            ],
          });
        } else {
          res.send({
            fulfillmentMessages: [
              {
                text: {
                  text: ["Sorry, I didn't get that. Please try again."],
                },
              },
            ],
          });
        }
        break;
      }

      case "Loan-End": {
        if (
          body.queryResult.outputContexts.some((context) =>
            context.name.endsWith("cash-loan-followup")
          )
        ) {
          loan = params.Loan;
          console.log("Gold: ", gold);
          console.log("Silver: ", silver);
          console.log("Cash: ", cash);
          console.log("Loan: ", loan);

          let assets = gold + silver + cash;
          let liabilities = loan;
          let netAssets = assets - liabilities;
          let zakatAmount = netAssets * 0.025;

          res.send({
            fulfillmentMessages: [
              {
                text: {
                  text: [
                    "Okay, I have all the information I need. Let me calculate your Zakat amount. Please wait a moment.",
                  ],
                },
              },
              {
                text: {
                  text: [`Total Payable Zakat Amount: ${zakatAmount}`],
                },
              },
            ],
          });
        } else {
          res.send({
            fulfillmentMessages: [
              {
                text: {
                  text: ["Sorry, I didn't get that. Please try again."],
                },
              },
            ],
          });
        }
        break;
      }

      case "Default Fallback Intent": {
        res.send({
          fulfillmentMessages: [
            {
              text: {
                text: ["Sorry, I didn't get that. Please try again."],
              },
            },
          ],
        });
        break;
      }

      default: {
        res.send({
          fulfillmentMessages: [
            {
              text: {
                text: ["Sorry, I didn't get that. Please try again."],
              },
            },
          ],
        });
      }
    }
  } catch (err) {
    console.log(err);
    res.send({
      fulfillmentMessages: [
        {
          text: {
            text: ["Something is wrong in server, please try again"],
          },
        },
      ],
    });
  }
});

/*--------------------Schema--------------------------*/
const zakatSchema = new mongoose.Schema({
  session: String,
  gold: Number,
  silver: Number,
  cash: Number,
  loan: Number,
});

const Zakat = mongoose.model("Zakat", zakatSchema);

/*---------------------Database--------------------------*/
let dbURI =
  "mongodb+srv://NabeelSohail:Nabeel30@cluster0.lidnkc6.mongodb.net/?retryWrites=true&w=majority";
mongoose.connect(dbURI);

mongoose.connection.on("connected", () => {
  console.log("Mongoose is connected");
});

mongoose.connection.on("error", (err) => {
  console.log("Mongoose connection error: ", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose is disconnected");
});

process.on("SIGINT", () => {
  mongoose.connection.close(() => {
    console.log("Mongoose is disconnected due to application termination");
    process.exit(0);
  });
});

/*---------------------Static Files--------------------------*/

const __dirname = path.resolve();
app.get("/", express.static(path.join(__dirname, "/Web/index.html")));
app.use("/", express.static(path.join(__dirname, "/Web")));

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
