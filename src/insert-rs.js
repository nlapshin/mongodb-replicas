const { start } = require('./client-rs');

;(async() => {
  const { collections, stop } = await start();

  console.log('begin insert one');

  await collections.test.insertOne({
    key: 1
  },
  { 
    writeConcern: { w: 1, wtimeout: 2000 } 
  });

  console.log('end insert one');

  await stop();
})();
