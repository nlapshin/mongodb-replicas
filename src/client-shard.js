const { MongoClient } = require('mongodb');

// Connection URL
const url = 'mongodb://localhost:40100';
const client = new MongoClient(url);

async function start() {
  await client.connect();
  console.log('Connected successfully to server');
  
  return {
    client,
    async stop() {
      await client.close();
    },
    collections: {
      tickets: client.db('bank').collection('tickets')
    } 
  }
}

module.exports = {
  start
};
