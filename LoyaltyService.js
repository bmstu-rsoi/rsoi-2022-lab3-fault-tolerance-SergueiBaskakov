'use strict';
const express = require('express');
const { Pool, Client } = require('pg');
// Constants
const PORT = 8050;
const HOST = '0.0.0.0';
// App
const app = express();

const client = new Client({
  user: 'program',
  host: 'postgres',
  database: 'loyalties',
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
  res.send('Loyalty Service');
});

app.get('/manage/health', (req, res) => {
  res.statusCode = 200
  res.send(JSON.stringify());
});

app.get('/api/v1/loyalty', (req, res) => {
  let querySQL = `
  SELECT reservation_count as "reservationCount",
        status,
        discount
  FROM loyalty WHERE username = $1
`
  let values = [req.query.username]
  client.query(querySQL, values, (err, result)=>{
    if(!err){
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = 200
      if (result.rowCount > 0) {
        res.send(JSON.stringify(result.rows[0]))
      }
      else {
        res.end()
      }
    }
    else {
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = 404
      res.end(JSON.stringify({ message: err.message}));
    }
  });
});

app.post('/api/v1/loyalty', (req, res) => {
  let querySQL = `
  UPDATE loyalty SET reservation_count = reservation_count + 1 WHERE username = $1
`
  let values = [req.query.username]
  client.query(querySQL, values, (err, result)=>{
    if(!err){
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = 200
      if (result.rowCount > 0) {
        res.send(JSON.stringify(result.rows[0]))
      }
      else {
        res.end()
      }
    }
    else {
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = 404
      res.end(JSON.stringify({ message: err.message}));
    }
  });
});

function init() {
  let querySQL = `
  CREATE TABLE IF NOT EXISTS loyalty
(
  id                SERIAL PRIMARY KEY,
  username          VARCHAR(80) NOT NULL UNIQUE,
  reservation_count INT         NOT NULL DEFAULT 0,
  status            VARCHAR(80) NOT NULL DEFAULT 'BRONZE'
      CHECK (status IN ('BRONZE', 'SILVER', 'GOLD')),
  discount          INT         NOT NULL
);
`

let queryInsert = `
INSERT INTO loyalty (id, username, reservation_count, status, discount) 
VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO NOTHING;
`

  let values = [
    1, 
    "Test Max", 
    25,
    "GOLD", 
    10
    ]

  client.query(querySQL, (err, result)=>{
    if(!err){
      console.log(result)
    }
    else {
      console.log(err.message)
    }
  })

  client.query(queryInsert, values, (err, result)=>{
    if(!err){
      console.log(result)
    }
    else {
      console.log(err.message)
    }
  })
}