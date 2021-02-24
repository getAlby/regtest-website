const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { boltwall, TIME_CAVEAT_CONFIGS } = require("boltwall");
const nodeFetch = require("node-fetch");
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

appRouter.get("/", async function (req, res) {
  const invoice = await lnd.makeInvoice({ amount: 100, memo: "a402" });
  res.render("index", { invoice: invoice.data, headers: req.headers });
});

appRouter.post("/invoice", async function (req, res) {
  const invoice = await lnd.makeInvoice({ amount: 100, memo: "a402" });
  res.json({ payment_request: invoice.data.payment_request });
});

appRouter.get("/webamp", function (req, res) {
  res.render("webamp", {});
});

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

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/lsat", boltwall({ ...TIME_CAVEAT_CONFIGS, rate: 10 }), lsatRouter);
app.use("/", appRouter);

const port = process.env.PORT || 3030;
console.log(`Running on ${port}`);
app.listen(port);
