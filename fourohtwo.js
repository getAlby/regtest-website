const path = require("path");
const express = require("express");
const uuid = require('uuid');
const bodyParser = require("body-parser");
const cors = require("cors");
const { boltwall, TIME_CAVEAT_CONFIGS } = require("boltwall");
const nodeFetch = require("node-fetch");
// const passport = require('passport');
// const session = require('express-session');
// const LnurlAuth = require('passport-lnurl-auth');

require("dotenv").config();

class Lnd {
  constructor(config) {
    this.config = config;
  }

  getInfo() {
    return this.request("GET", "/v1/getinfo", undefined, {});
  }

  sendPayment(args) {
    return this.request("POST", "/v2/router/send", args, {}).then((res) => {
      console.log(res);
      return res.json();
    });
  }

  makeInvoice(args) {
    return this.request("POST", "/v1/invoices", {
      memo: args.memo,
      value: args.amount,
    });
  }

  getAddress() {
    return this.request("POST", "/v2/wallet/address/next", undefined, {});
  }

  getBlockchainBalance() {
    return this.request("GET", "/v1/balance/blockchain", undefined, {});
  }

  async request(method, path, args, defaultValues) {
    let body = null;
    let query = "";
    const headers = new nodeFetch.Headers();
    headers.append("Accept", "application/json");
    if (method === "POST") {
      body = JSON.stringify(args);
      headers.append("Content-Type", "application/json");
    } else if (args !== undefined) {
      query = `?`; //`?${stringify(args)}`;
    }
    if (this.config.macaroon) {
      headers.append("Grpc-Metadata-macaroon", this.config.macaroon);
    }
    try {
      const res = await nodeFetch(this.config.url + path + query, {
        method,
        headers,
        body,
      });
      if (!res.ok) {
        let errBody;
        try {
          errBody = await res.json();
          if (!errBody.error) {
            throw new Error();
          }
        } catch (err) {
          throw {
            statusText: res.statusText,
            status: res.status,
          };
        }
        console.log("errBody", errBody);
        throw errBody;
      }
      let data = await res.json();
      if (defaultValues) {
        data = Object.assign(Object.assign({}, defaultValues), data);
      }
      return { data };
    } catch (err) {
      console.error(`API error calling ${method} ${path}`, err);
      // Thrown errors must be JSON serializable, so include metadata if possible
      if (err.code || err.status || !err.message) {
        throw err;
      }
      throw err.message;
    }
  }
}

lnd = new Lnd({
  url: process.env.LND_URL,
  macaroon: process.env.LND_MACAROON_HEX,
});

lnd.getInfo().then(console.log);

const app = express();
const lsatRouter = express.Router();
const appRouter = express.Router();

let newInvoice = null;

appRouter.get("/", async function (req, res) {
  res.render("index", { newInvoice, headers: req.headers, user: req.user });
  if (newInvoice) {
    newInvoice = null
  }
});

// invoice calls

appRouter.post("/invoice", async function (req, res) {
  if (req.body.amount && req.body.name) {
    const invoice = await lnd.makeInvoice({ amount: req.body.amount, memo: "a402" });
    const newInvoiceObj = {
      id: uuid.v4(),
      name: req.body.name,
      amount: req.body.amount,
      data: invoice.data
    }
    newInvoice = newInvoiceObj;
  }
  res.redirect('/');
});

appRouter.get("/webamp", function (req, res) {
  res.render("webamp", {});
});

// appRouter.get('/logout', function(req, res) {
//   req.session.destroy();
//   return res.redirect('/');
// });

// appRouter.get('/login',
// 	function(req, res, next) {
//     console.log('request user', req.user);
// 		if (req.user) {
// 			// Already authenticated.
// 			return res.redirect('/');
// 		}
// 		next();
// 	},
// 	new LnurlAuth.Middleware({
// 		callbackUrl: 'https://regtest-alice.herokuapp.com/login',
// 		cancelUrl: 'https://regtest-alice.herokuapp.com/'
// 	})
// );


lsatRouter.get("/", function (req, res) {
  res.json("yay, thanks");
});

lsatRouter.get("/files/:name", function (req, res) {
  let options = {
    root: path.join(__dirname, "public"),
    dotfiles: "deny",
    headers: {
      "x-timestamp": Date.now(),
      "x-sent": true,
    },
  };

  const fileName = req.params.name;
  res.sendFile(fileName, options);
});

// const map = {
// 	user: new Map(),
// };
// passport.serializeUser(function(user, done) {
// 	done(null, user.id);
// });
//
// passport.deserializeUser(function(id, done) {
// 	done(null, map.user.get(id) || null);
// });

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, 'public')))
app.use(cors());
// app.use(session({
// 	secret: 'skjldsadiufhadiwewdkasdiuc2fdcui',
// 	resave: true,
// 	saveUninitialized: true,
// }));
// app.use(passport.initialize());
// app.use(passport.session());
// passport.use(new LnurlAuth.Strategy(function(linkingPublicKey, done) {
// 	let user = map.user.get(linkingPublicKey);
// 	if (!user) {
// 		user = { id: linkingPublicKey };
// 		map.user.set(linkingPublicKey, user);
// 	}
//
//   console.log(user);
// 	done(null, user);
// }));

// app.use(passport.authenticate('lnurl-auth'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use("/lsat", boltwall({ ...TIME_CAVEAT_CONFIGS, rate: 0.1 }), lsatRouter);

app.use("/", appRouter);

const port = process.env.PORT || 3030;
console.log(`Running on ${port}`);
app.listen(port);