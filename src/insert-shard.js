const { randomInt } = require('crypto');
const { start } = require('./client-shard');

;(async() => {
  const { collections, stop } = await start();

  console.log('begin warm up collection');

  const chunk = [];
  let count = 0;

  for (var i = 0; i < 1000; i++) {
    const chunk = [];

    for (var j = 0; j < 1000; j++) {
      chunk.push({
        name: "Max ammout of cost tickets", 
        amount: randomInt(0, 100)
      });
    }

    await collections.tickets.insertMany(chunk);
    count = count + chunk.length;
    console.log(count);
    chunk.length = 0;
  }

  console.log('end warm up collection');

  await stop();
})();
