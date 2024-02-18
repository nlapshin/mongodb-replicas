const { MongoClient } = require('mongodb');

// Connection URL
const url = 'mongodb://localhost:30001,localhost:30002,localhost:30003/test?replicaSet=my-replica-set';
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
      test: client.db('test').collection('test')
    } 
  }
}

module.exports = {
  start
};
