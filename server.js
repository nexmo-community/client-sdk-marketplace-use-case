require('dotenv').config();
const express = require("express");
const cors = require("cors");
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(cors());

// create a Nexmo client
const Nexmo = require('nexmo');
const nexmo = new Nexmo({
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET,
    applicationId: process.env.APP_ID,
    // privateKey: process.env.PRIVATE_KEY
    privateKey: __dirname + process.env.PRIVATE_KEY
}, {debug: true});

// the client calls this endpoint to request a JWT, passing it a username
app.post('/getJWT', function(req, res) {
    const jwt = nexmo.generateJwt({
        application_id: process.env.APP_ID,
        sub: req.body.name,
        exp: Math.round(new Date().getTime()/1000)+86400,
        acl: {
            "paths": {
                "/*/users/**":{},
                "/*/conversations/**":{},
                "/*/sessions/**":{},
                "/*/devices/**":{},
                "/*/image/**":{},
                "/*/media/**":{},
                "/*/applications/**":{},
                "/*/push/**":{},
                "/*/knocking/**":{}
            }
        }
    });
    res.send({jwt: jwt});
});

// the client calls this endpoint to create a new user in the Nexmo application,
// passing it a username and optional display name
app.post('/createUser', function(req, res) {
    nexmo.users.create({
        name: req.body.name,
        display_name: req.body.display_name || req.body.name,
        image_url: req.body.image_url,
        properties: req.body.properties
    },(err, response) => {
        if (err) {
            res.sendStatus(500);
        } else {
            res.send({id: response.id});
        }
    });
});


app.post('/getConversations', function(req, res) {
    nexmo.conversations.get({page_size: req.body.page_size},(err, response) => {
        if (err) {
            res.sendStatus(500);
        } else {
            res.send(response._embedded);
        }
    });
});


app.post('/createConversation', function(req, res) {
    nexmo.conversations.create({
        name: req.body.name,
        display_name: req.body.display_name || req.body.name,
        properties: req.body.properties
    },(err, response) => {
        if (err) {
            res.sendStatus(500);
        } else {
            res.send({id: response.id});
        }
    });
});


// Create a mock Stripe API Response Reference: https://stripe.com/docs/api/charges/create
app.post('/stripePayment', function(req, res) {
    res.send({
        response: {
            "id": "ch_1FSNhf2eZvKYlo2CodbBPmwQ",
            "object": "charge",
            "amount": req.body.amount,
            "amount_refunded": 0,
            "application": null,
            "application_fee": null,
            "application_fee_amount": null,
            "balance_transaction": "txn_19XJJ02eZvKYlo2ClwuJ1rbA",
            "billing_details": {
                "address": {
                    "city": null,
                    "country": null,
                    "line1": null,
                    "line2": null,
                    "postal_code": null,
                    "state": null
                },
                "email": null,
                "name": null,
                "phone": null
            },
            "captured": false,
            "created": 1570798723,
            "currency": req.body.currency,
            "customer": null,
            "description": req.body.description,
            "destination": null,
            "dispute": null,
            "failure_code": null,
            "failure_message": null,
            "fraud_details": {},
            "invoice": null,
            "livemode": false,
            "metadata": {},
            "on_behalf_of": null,
            "order": null,
            "outcome": null,
            "paid": true,
            "payment_intent": null,
            "payment_method": "card_1FSNha2eZvKYlo2CtZjDglzU",
            "payment_method_details": {
                "card": {
                    "brand": "visa",
                    "checks": {
                        "address_line1_check": null,
                        "address_postal_code_check": null,
                        "cvc_check": null
                    },
                    "country": "US",
                    "exp_month": 8,
                    "exp_year": 2020,
                    "fingerprint": "Xt5EWLLDS7FJjR1c",
                    "funding": "credit",
                    "installments": null,
                    "last4": "4242",
                    "network": "visa",
                    "three_d_secure": null,
                    "wallet": null
                },
                "type": "card"
            },
            "receipt_email": null,
            "receipt_number": null,
            "receipt_url": "https://pay.stripe.com/receipts/acct_1032D82eZvKYlo2C/ch_1FSNhf2eZvKYlo2CodbBPmwQ/rcpt_FyKMJVAk8reFPxol3uqojWqKWDWCRsv",
            "refunded": false,
            "refunds": {
                "object": "list",
                "data": [],
                "has_more": false,
                "total_count": 0,
                "url": "/v1/charges/ch_1FSNhf2eZvKYlo2CodbBPmwQ/refunds"
            },
            "review": null,
            "shipping": null,
            "source": {
                "id": "card_1FSNha2eZvKYlo2CtZjDglzU",
                "object": "card",
                "address_city": null,
                "address_country": null,
                "address_line1": null,
                "address_line1_check": null,
                "address_line2": null,
                "address_state": null,
                "address_zip": null,
                "address_zip_check": null,
                "brand": "Visa",
                "country": "US",
                "customer": null,
                "cvc_check": null,
                "dynamic_last4": null,
                "exp_month": 8,
                "exp_year": 2020,
                "fingerprint": "Xt5EWLLDS7FJjR1c",
                "funding": "credit",
                "last4": "4242",
                "metadata": {},
                "name": null,
                "tokenization_method": null
            },
            "source_transfer": null,
            "statement_descriptor": null,
            "statement_descriptor_suffix": null,
            "status": "succeeded",
            "transfer_data": null,
            "transfer_group": null
        }
    })
});

const listener = app.listen(3001, function() {
    console.log("Your app is listening on port " + listener.address().port);
});
