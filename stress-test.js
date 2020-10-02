import http from 'k6/http';

export let options = {
    stages: [
      { duration: '1m', target: 100 }, // simulate ramp-up of traffic from 1 to 100 users over 5 minutes.
    ]
  };

export default function() {
    const url = 'http://host.docker.internal:1337/event';

    const headers = {'Content-Type': 'application/json'};
    
    const data = {
        order: Math.floor(Math.random() * (5000 - 1)) + 1,
        truck: 1,
        eventType: "SEND_TO_WAREHOUSE"
    };

    http.post(url, JSON.stringify(data), {headers});
}