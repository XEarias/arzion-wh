NodeJs erbium Sails based API rest. 	:rocket:

### Technologies

The project uses Postgres 12 and [Postgis 3](https://postgis.net/)

### Database
![der](https://i.ibb.co/MghR5Tt/DER.png)
![database](https://i.ibb.co/4TXGhcP/db.png)

### Docs

The project comes with a complete endpoints doc:
* swagger.yml file ([open api v3](https://github.com/OAI/OpenAPI-Specification)) 
* postman.json file ([postman](https://github.com/postmanlabs/postman-docs))


### Docker/Docker Compose :whale:

You can build a compose:
```
$ docker-compose up --build
```

#### Initial DB
The project comes with a fully loaded db, have around 5000 packages/orders to test.

![orders](https://i.ibb.co/R7dGfy4/orders.png)

Orders's indexes between 100 - 5000 are valid, for example:

```
{
    order: 199 // # 100 - 5000 are valid 
}
```

The order have 10 possible addresses inside Argentina:
![address](https://i.ibb.co/N3PY78K/customer.png)

Same with the warehouses, 10 different addresses:
![wh1](https://i.ibb.co/YdyKMg6/cities.png)
![wh2](https://i.ibb.co/QkDnd69/cities-2.png)

### Environment Variables

| Name                                               
| :-----------          
| **POSTGRES_URL**      
| **POSTGRES_USER**     
| **POSTGRES_PASSWORD** 
| **POSTGRES_DB**       
| **GOOGLE_API_KEY**    

### Unit Tests :beetle:

You can run test using npm scripts:

```
$ npm ci 
$ npm run test
```
Tests with [Jest](https://jestjs.io/)

### Stress Tests :bomb:

You can run stress test using [K6](https://k6.io/docs/getting-started/running-k6) tool:

```
$ docker run -i loadimpact/k6 run - <stress-test.js
```
Remember to start the server first :wink:

### TODO:

* Swagger server
* Redis cache
* Sonarqube spec file
* Kubernetes/Openshift/Rancher spec file
* Logs with ElasticSearch
