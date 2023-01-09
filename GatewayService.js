'use strict';
const utf8 = require('utf8');
const express = require('express');
const { Pool, Client } = require('pg');
const axios = require('axios');
const CircuitBreaker = require('opossum');

// Constants
const PORT = 8080;
const HOST = '0.0.0.0';
const HOST2 = 'host.docker.internal';
// App
const app = express();

const client = new Client({
  user: 'program',
  host: 'postgres',
  database: 'reservations',
  password: 'test',
  port: 5432,
});

client.connect();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.listen(PORT, HOST);

console.log(`Running on http://${HOST}:${PORT}`);

const options = {
  timeout: 3000, // If our function takes longer than 3 seconds, trigger a failure
  errorThresholdPercentage: 50, // When 50% of requests fail, trip the circuit
  resetTimeout: 30000 // After 30 seconds, try again.
};

const breakerReservationGet = new CircuitBreaker(axios.get, options);
const breakerReservationPost = new CircuitBreaker(axios.post, options);

const breakerLoyaltyGet = new CircuitBreaker(axios.get, options);
const breakerPaymentGet = new CircuitBreaker(axios.get, options);



app.get('/', (req, res) => {
  res.send('Gateway Service');
});

app.get('/manage/health', (req, res) => {
  res.statusCode = 200
  res.send(JSON.stringify());
});

app.get('/api/v1/hotels', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  //axios.get(`http://${HOST}:8070/api/v1/hotels`, {
  //  params: {
  //    page: req.query.page,
  //    size: req.query.size
  //  }
  //})
  breakerReservationGet.fire(`http://${HOST2}:8070/api/v1/hotels`, {
      params: {
        page: req.query.page,
        size: req.query.size
      }
    })
  .then((response) => {
    // handle success
    res.statusCode = response.status
    response.status == 200 ? res.send(response.data) : res.end();
  })
  .catch((error) => {
    // handle error
    console.log(error)
    if (error.code == "EOPENBREAKER" || error.code == "ECONNREFUSED") {
      res.statusCode = 503
      console.log(error)
      res.end(JSON.stringify({ message: error.message}));
    }
    else {
      res.statusCode = 400
      console.log(error)
      res.end(JSON.stringify({ message: error.message}));
    }
    
  })
  .finally(() => {
    // always executed
  });
  //breakerReservationGet.fallback(() => Error('Sorry, out of service right now'));
  //breakerReservationGet.on('fallback', (result) => reportFallbackEvent(result))

});

function reportFallbackEvent(result) {
  console.log("reportFallbackEvent")
  console.log(result)
}

app.get('/api/v1/loyalty', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  breakerLoyaltyGet.fire(`http://${HOST2}:8050/api/v1/loyalty`, {
    params: {
      username: req.header("X-User-Name"),
    }
  })
  .then((response) => {
    // handle success
    res.statusCode = response.status
    response.status == 200 ? res.send(response.data) : res.end();
  })
  .catch((error) => {
    // handle error
    if (error.code == "EOPENBREAKER" || error.code == "ECONNREFUSED") {
      res.statusCode = 503
      console.log(error)
      res.end(JSON.stringify({ message: "Loyalty Service unavailable"}));
    }
    else {
      res.statusCode = 400
      res.end(JSON.stringify({ message: error.message}));
    }
    
  })
});

app.get('/api/v1/reservations/:reservationUid', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  axios.get(`http://${HOST2}:8070/api/v1/reservations/${req.params.reservationUid}`, {
    params: {
      username: req.header("X-User-Name"),
    }
  })
  .then((reservationResponse) => {
    // handle success
      axios.get(`http://${HOST2}:8060/api/v1/payment`, {
      params: {
        paymentUid: reservationResponse.data.payment,
      }
      })
      .then((paymentResponse) => {
        // handle success
        var payment = paymentResponse.data[0]
        var reservation = reservationResponse.data
        delete payment.paymentuid
        reservation.payment = payment
        reservation.startDate = reservation.startDate.split("T")[0]
        reservation.endDate = reservation.endDate.split("T")[0]
        res.statusCode = 200
        res.send(JSON.stringify(reservation))
      })
      .catch((error) => {
        // handle error
        res.statusCode = 400
        res.end(JSON.stringify({ message: error.message}));
      })
      .finally(() => {
        // always executed
      });
  })
  .catch((error) => {
    // handle error
    res.statusCode = 400
    res.end(JSON.stringify({ message: error.message}));
  })
  .finally(() => {
    // always executed
  });
});

app.get('/api/v1/reservations', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  axios.get(`http://${HOST2}:8070/api/v1/reservations`, {
    params: {
      username: req.header("X-User-Name"),
    }
  })
  .then((reservationResponse) => {
    // handle success
    console.log("reservationResponse.data.map", reservationResponse.data.map((val) => {
      return val.payment
    }).join(','))
        axios.get(`http://${HOST2}:8060/api/v1/payments`, {
        params: {
          paymentUids: reservationResponse.data.map((val) => {
            return val.payment
          }).join(','),
        }
        })
        .then((paymentResponse) => {
          // handle success
          var payments = paymentResponse.data
          var reservations = reservationResponse.data
          reservations = reservations.map((val) => {
            var payment = payments.find(p => {
              return p.paymentuid == val.payment
            })
            delete payment.paymentuid
            val.payment = payment
            val.startDate = val.startDate.split("T")[0]
            val.endDate = val.endDate.split("T")[0]
            return val
          })
          res.statusCode = 200
          res.send(JSON.stringify(reservations))
        })
        .catch((error) => {
          // handle error
          res.statusCode = 400
          res.end(JSON.stringify({ message: error.message}));
        })
        .finally(() => {
          // always executed
        });
  })
  .catch((error) => {
    // handle error
    res.statusCode = 400
    res.end(JSON.stringify({ message: error.message}));
  })
  .finally(() => {
    // always executed
  });
});

app.get('/api/v1/me', (req, res) => {
  res.setHeader('Content-Type', 'application/json')

  breakerLoyaltyGet.fire(`http://${HOST2}:8050/api/v1/loyalty`, {
    params: {
      username: req.header("X-User-Name"),
    }
  }).then((loyaltyResponse) => {
    const loyalty = loyaltyResponse
    
    breakerReservationGet.fire(`http://${HOST2}:8080/api/v1/reservations`, {
      headers: {
        "X-User-Name": req.header("X-User-Name")
      }
    }).then((reservationResponse) => {
      const reservations = reservationResponse
      res.send(JSON.stringify({ "loyalty": loyalty.data, "reservations": reservations.data}));
      // use/access the results 
    }).catch(reservationError => {
      // react on errors.
      res.send(JSON.stringify({ "loyalty": loyalty.data, "reservations": {} }));
    })
    // use/access the results 
  }).catch(loyaltyError => {
    // react on errors.
    const loyalty = {}
    
    breakerReservationGet.fire(`http://${HOST2}:8080/api/v1/reservations`, {
      headers: {
        "X-User-Name": req.header("X-User-Name")
      }
    }).then((reservationResponse) => {
      const reservations = reservationResponse
      res.send(JSON.stringify({ "loyalty": loyalty, "reservations": reservations.data}));
      // use/access the results 
    }).catch(reservationError => {
      // react on errors.
      res.send(JSON.stringify({ "loyalty": loyalty, "reservations": {} }));
    })
  })
});

app.post('/api/v1/reservations', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  let date_1 = new Date(req.body.startDate);
  let date_2 = new Date(req.body.endDate);
  let difference = date_2.getTime() - date_1.getTime();
  let days = Math.ceil(difference / (1000 * 3600 * 24))
  let hotelRequest = axios.get(`http://${HOST2}:8070/api/v1/hotels/${req.body.hotelUid}`, {
    params: {
      username: req.header("X-User-Name"),
    }
  })
  let avaibilityRequest = axios.get(`http://${HOST2}:8070/api/v1/avaibility`, {
    params: {
      username: req.header("X-User-Name"),
      hotelUid: req.body.hotelUid,
      endDate: req.body.endDate,
      startDate: req.body.startDate
    }
  })

  axios.all([hotelRequest, avaibilityRequest]).then(axios.spread((...responses) => {
    const hotel = responses[0]
    const avaibility = responses[1]
    console.log("avaibility", avaibility.data.available)
    if (avaibility.data.available) {
      console.log("payValues", hotel.data, days)
      breakerLoyaltyGet.fire(`http://${HOST2}:8050/api/v1/loyalty`, {
        params: {
          username: req.header("X-User-Name"),
        }
      }).then((loyaltyResponse) => {
        const loyalty = loyaltyResponse
        pay(req, res, hotel.data, days, loyalty.data)
        // use/access the results 
      }).catch(error => {
        // react on errors.
        if (error.code == "EOPENBREAKER" || error.code == "ECONNREFUSED") {
          res.statusCode = 503
          console.log(error)
          res.end(JSON.stringify({ message: "Loyalty Service unavailable"}));
        }
        else {
          res.statusCode = 400
          res.end(JSON.stringify({ message: error.message}));
        }
      })
      
      //res.send(JSON.stringify({ "hotel": hotel.data, "avaibility": avaibility.data}));
    }
    else {
      res.statusCode = 201
      res.end();
    }
    // use/access the results 
  })).catch(errors => {
    // react on errors.
    res.statusCode = 400
    res.end(JSON.stringify({
      "message": errors.message,
      "errors": errors
    }))
  })

});

/*
app.post('/api/v1/reservations', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  let date_1 = new Date(req.body.startDate);
  let date_2 = new Date(req.body.endDate);
  let difference = date_2.getTime() - date_1.getTime();
  let days = Math.ceil(difference / (1000 * 3600 * 24))
  let hotelRequest = axios.get(`http://${HOST}:8070/api/v1/hotels/${req.body.hotelUid}`, {
    params: {
      username: req.header("X-User-Name"),
    }
  })
  let avaibilityRequest = axios.get(`http://${HOST}:8070/api/v1/avaibility`, {
    params: {
      username: req.header("X-User-Name"),
      hotelUid: req.body.hotelUid,
      endDate: req.body.endDate,
      startDate: req.body.startDate
    }
  })

  let loyaltyRequest = axios.get(`http://${HOST}:8050/api/v1/loyalty`, {
    params: {
      username: req.header("X-User-Name"),
    }
  })

  axios.all([hotelRequest, avaibilityRequest, loyaltyRequest]).then(axios.spread((...responses) => {
    const hotel = responses[0]
    const avaibility = responses[1]
    const loyalty = responses[2]
    console.log("avaibility", avaibility.data.available)
    if (avaibility.data.available) {
      console.log("payValues", hotel.data, days)
      pay(req, res, hotel.data, days, loyalty.data)
      //res.send(JSON.stringify({ "hotel": hotel.data, "avaibility": avaibility.data}));
    }
    else {
      res.statusCode = 201
      res.end();
    }
    // use/access the results 
  })).catch(errors => {
    // react on errors.
    res.statusCode = 400
    res.end(JSON.stringify({
      "message": errors.message,
      "errors": errors
    }))
  })

});
*/

app.delete('/api/v1/reservations/:reservationUid', (req, res) => {
  axios.delete(`http://${HOST2}:8070/api/v1/reservations/${req.params.reservationUid}`, {
    params: {
      username: req.header("X-User-Name")
    }
  })
  .then((reservationResponse) => {
    console.log("reservationResponse", reservationResponse)
    res.statusCode = 204
    res.send()
  })
  .catch((error) => {
    // handle error
    res.statusCode = 404
    res.end(JSON.stringify({ message: error.message}));
  })
  .finally(() => {
    // always executed
  });
});

function pay(req, res, hotel, days, loyalty) {
  axios.post(`http://${HOST2}:8060/api/v1/pay`, null, {
        params: {
          price: ((hotel.price * days) - ((hotel.price * days) * loyalty.discount / 100))
        }
      })
      .then((payResponse) => {
        // handle success
        if (payResponse.status == 200) {
          console.log("payResponse", payResponse)
          reservation(req, res, payResponse.data.payment_uid, hotel, payResponse.data, loyalty)
        }
        else {
          console.log("payResponse", 201)
          res.statusCode = 201
          res.end();
        }
      })
      .catch((error) => {
        // handle error
        res.statusCode = 400
        res.end(JSON.stringify({
          "message": error.message,
          "errors": error
        }))
      })
}

function reservation(req, res, paymentUid, hotel, payData, loyalty) {
    axios.post(`http://${HOST2}:8070/api/v1/reservations`, null, {
      params: {
        username: req.header("X-User-Name"),
        paymentUid: paymentUid,
        hotelId: hotel.id,
        status: payData.status,
        startDate: req.body.startDate,
        endDate: req.body.endDate
      }
    })
    .then((reservationResponse) => {
      // handle success
          axios.post(`http://${HOST2}:8050/api/v1/loyalty`, null, {
            params: {
              username: req.header("X-User-Name")
            }
          })
          .then((loyaltyResponse) => {
            // handle success
            console.log("reservationResponse", reservationResponse)
            res.statusCode = reservationResponse.status
            if (reservationResponse.status == 200) {
              delete payData.payment_uid
              var data = reservationResponse.data
              data["hotelUid"] = hotel.hotelUid
              data["startDate"] = data.startDate.split("T")[0]
              data["endDate"] = data.endDate.split("T")[0]
              data["payment"] = payData
              data["discount"] = loyalty.discount
              res.send(data)
            }
            else {
              res.end()
            }
          })
          .catch((error) => {
            // handle error
            res.statusCode = 400
            res.end(JSON.stringify({
              "message": error.message,
              "errors": error
            }))
          })
    })
    .catch((error) => {
      // handle error
      res.statusCode = 400
      res.end(JSON.stringify({
        "message": error.message,
        "errors": error
      }))
    })
}
