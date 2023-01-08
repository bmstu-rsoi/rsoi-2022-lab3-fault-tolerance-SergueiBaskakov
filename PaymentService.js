'use strict';
const express = require('express');
const uuid = require('uuid');
const { Pool, Client } = require('pg');
// Constants
const PORT = 8060;
const HOST = '0.0.0.0';
// App
const app = express();

const client = new Client({
  user: 'program',
  host: 'postgres',
  database: 'payments',
  password: 'test',
  port: 5432,
});

client.connect();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.listen(PORT, HOST);

console.log(`Running on http://${HOST}:${PORT}`);

init()

app.get('/', (req, res) => {
  res.send('Payment Service');
});

app.get('/manage/health', (req, res) => {
  res.statusCode = 200
  res.send(JSON.stringify());
});

app.get('/api/v1/payment', (req, res) => {
  let querySQL = `
  SELECT payment_uid as paymentUid,
          status,
          price
  FROM payment WHERE payment_uid = $1
`
  let values = [req.query.paymentUid]
  client.query(querySQL, values, (err, result)=>{
    res.setHeader('Content-Type', 'application/json')
    if(!err){
      res.statusCode = 200
      res.send(JSON.stringify(result.rows));
    }
    else {
      res.statusCode = 404
      res.end(JSON.stringify({ message: err.message}));
    }
  });
});

app.get('/api/v1/payments', (req, res) => {
  var params = [];
  let values = req.query.paymentUids.split(',')
  for(var i = 1; i <= values.length; i++) {
    params.push('$' + i);
  }
  let querySQL = `
  SELECT payment_uid as paymentUid,
          status,
          price
  FROM payment WHERE payment_uid in (${params.join(',')})
`
  client.query(querySQL, values, (err, result)=>{
    res.setHeader('Content-Type', 'application/json')
    if(!err){
      res.statusCode = 200
      res.send(JSON.stringify(result.rows));
    }
    else {
      res.statusCode = 404
      res.end(JSON.stringify({ message: err.message}));
    }
  });
});

app.get('/api/v1/payment:paymentUid', (req, res) => {
  res.send('Gateway Service');
});

app.delete('/api/v1/payment/:paymentUid', (req, res) => {
  let querySQL = `
    UPDATE payment
    SET status = CANCELED
    WHERE payment_uid = $1
`
  let values = [req.params.paymentUid]
  client.query(querySQL, values, (err, result)=>{
    res.setHeader('Content-Type', 'application/json')
    if(!err){
      res.statusCode = 204
      res.send();
    }
    else {
      res.statusCode = 404
      res.end(JSON.stringify({ message: err.message}));
    }
  });
});

app.post('/api/v1/pay', (req, res) => {
  let querySQL = `
  INSERT INTO payment (payment_uid, status, price)
  VALUES ($1, $2, $3)
  RETURNING payment_uid, status, price
`
  console.log("req.query.price", req.query.price)
  let values = [uuid.v4(), 'PAID', req.query.price]
  
  client.query(querySQL, values, (err, result)=>{
    res.setHeader('Content-Type', 'application/json')
    if(!err){
      res.statusCode = 200
      if (result.rowCount > 0) {
        res.send(JSON.stringify(result.rows[0]));
      }
      else {
        res.end();
      }
    }
    else {
      res.statusCode = 404
      console.log("pay", err.message)
      res.end(JSON.stringify({ message: err.message}));
    }
  });
});

function init() {
  let querySQL = `
  CREATE TABLE IF NOT EXISTS payment
(
  id SERIAL PRIMARY KEY,
  payment_uid uuid NOT NULL,
  status VARCHAR(20) NOT NULL
      CHECK (status IN ('PAID', 'CANCELED')),
  price INT NOT NULL
);
`
  client.query(querySQL, (err, result)=>{
    if(!err){
      console.log(result)
    }
    else {
      console.log(err.message)
    }
  })
}

