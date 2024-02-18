<!-- bind-all-ip + firewall выше + ssl + авторизация -->

Ситуация.

У нас один инстанс. База большая, нужно восстановить данные из бекапа.

Был пример с другой бд, которая в один инстанс. Раз в день, теряются данные, растет нагрузка - снимался дамп. Решение - сделать репликацию.

У нас есть Москва и Новосиб - сделать два дата-центра - один 


// --replSet my-replica-set - это предконфигурация


## Replica set

### Запуск

`docker-compose -f ./docker-compose.rs.yml up -d`

### Инициализация

```

db.adminCommand( {
   "setDefaultRWConcern" : 1,
   "defaultWriteConcern" : {"w":1}
})

// rs без арбитр
rs.initiate({
  "_id" : "my-replica-set", // другое значение ошибка 
  members : [
    {"_id" : 0, host : "mongo-rs-1:30001"}, // либо IP адрес, domen
    {"_id" : 1, host : "mongo-rs-2:30002"},
    {"_id" : 2, host : "mongo-rs-3:30003"}
  ]
})

db.adminCommand( {
   "setDefaultRWConcern" : 1,
   "defaultWriteConcern" : {"w":1}
})

Может сделать сервер, который только голосует для кворума. Служебный

Достаточно иметь 1 primary и 1 secondary + arbiter(может быть дешевым)


writeConcern - majority - большая часть инстансов потвердила
writeConcern - 1 хотя бы один
и 0 - без потверждение

// compass
// robo3t
// datalab
// mongosh - mongosh

```

### Команды

rs.status() - статус
rs.add("mongo-rs-4:30004")
rs.addArb("mongo-rs-4:30004") //если добавить арбитра
rs.remove("mongo-rs-4:30004")
db.isMaster()

rs.secondaryOk() // Самый старый вариант slaveOk. 
cursor.readPref(mode, tagSet) // readPref настраивать.
https://www.mongodb.com/docs/v4.0/core/read-preference/#replica-set-read-preference-tag-sets

conf = rs.conf();
conf.members[0].tags = { "dc": "east", "usage": "production" };
conf.members[1].tags = { "dc": "east", "usage": "reporting" };
conf.members[2].tags = { "dc": "west", "usage": "production" };
rs.reconfig(conf);

Пока у нас голосование - запись не осуществляет

### Тесты

db.getCollection("test").insert({ key: "value" }, { writeConcern: { w: "majority", j: true } })

db.getCollection("test").find().readPref("secondary", [
      { "datacenter": "B" },    // First, try matching by the datacenter tag
      { "region": "West"},      // If not found, then try matching by the region tag
      { }                       // If not found, then use the empty document to match all eligible members
   ])

## Shard Replica set

Большая колекция. В один сервер.

У нас будет три replicaSet:
- первый - это конфиг сервера(3 штуки)
- вторый - это первый шардированный кластер(3 штуки)
- третрий - это второй шардированный кластер(3 штуки)
- mongos - отдельный сервис

### Запуск

`docker-compose -f ./docker-compose.shard.yml up -d`

### Инициализация

```
// Инциализируем первую конфиг реплику
rs.initiate({
  "_id" : "config-replica-set", 
  members : [
    {"_id" : 0, host : "mongo-configsvr-1:40001"},
    {"_id" : 1, host : "mongo-configsvr-2:40002"},
    {"_id" : 2, host : "mongo-configsvr-3:40003" }
  ]
});

// Инициализируем шардинги

rs.initiate({
  "_id" : "shard-replica-set-1", 
  members : [
    {"_id" : 0, host : "mongo-shard-1-rs-1:40011"},
    {"_id" : 1, host : "mongo-shard-1-rs-2:40012"},
    {"_id" : 2, host : "mongo-shard-1-rs-3:40013" }
  ]
});

rs.initiate({
  "_id" : "shard-replica-set-2", 
  members : [
    {"_id" : 0, host : "mongo-shard-2-rs-1:40021"},
    {"_id" : 1, host : "mongo-shard-2-rs-2:40022"},
    {"_id" : 2, host : "mongo-shard-2-rs-3:40023" }
  ]
});

docker exec -it mongos-shard bash

> sh.addShard("shard-replica-set-1/mongo-shard-1-rs-1:40011,mongo-shard-1-rs-2:40012,mongo-shard-1-rs-3:40013")
> sh.addShard("shard-replica-set-2/mongo-shard-2-rs-1:40021,mongo-shard-2-rs-2:40022,mongo-shard-2-rs-3:40023")
> sh.status()

```

### Тесты

```
use bank
sh.enableSharding("bank")

use config
 db.settings.updateOne(
   { _id: "chunksize" },
   { $set: { _id: "chunksize", value: 10 } },
   { upsert: true }
)

use bank
for (var i=0; i<100; i++) { db.tickets2.insertOne({name: "Max ammout of cost tickets", amount: Math.random()*100}) }

> db.tickets.createIndex({amount: 1})
> db.tickets.stats()
> 
-- use admin
-- db.runCommand({shardCollection: "bank.tickets", key: {amount: 1}})
> sh.status()

> sh.balancerCollectionStatus("bank.tickets")
> sh.splitFind( "bank.tickets", { "amount": "50" } )

Почему timestamp, что увеличивается инкрементально.

```

## Авторизация

sudo mkdir /home/nik/auth_db && sudo chmod 777 /home/nik/auth_db
mongod --dbpath /home/nik/auth_db --port 27005 --fork --logpath /home/nik/auth_db/log.log --pidfilepath /home/nik/auth_db/pid.pid

mongosh --port 27005
db = db.getSiblingDB("admin")
db.createRole(
    {      
     role: "superRoot",      
     privileges:[
        { resource: {anyResource:true}, actions: ["anyAction"]}
     ],      
     roles:[] 
    }
)

db.createUser({      
     user: "companyDBA",      
     pwd: "EWqeeFpUt9*8zq",      
     roles: ["superRoot"] 
})

> use admin
> db.system.roles.find()
> db.system.users.find()
> db.shutdownServer()
-- запускаем сервер с аутентификацией
mongod --dbpath /home/nik/auth_db --port 27005 --fork --logpath /home/nik/auth_db/log.log --pidfilepath /home/nik/auth_db/pid.pid --auth

mongo --port 27005

mongo --port 27005 -u companyDBA -p EWqeeFpUt9*8zq --authenticationDatabase "admin"

show databases



-- вариант разместить простого пользователя и воспользоваться авторизацией

use admin
db.createUser({      
     user: "webapiDBA",      
     pwd: "EWqeeFpUt9*8zq",      
     roles: [{role: "readWrite",db: "webapi"}] 
})
use webapi
db.createUser({      
     user: "webapiDBA2",      
     pwd: "EWqeeFpUt9*8zq",      
     roles: [{role: "readWrite",db: "webapi"}] 
})

mongo webapi --port 27005 -u webapiDBA -p EWqeeFpUt9*8zq --authenticationDatabase "admin"
mongo webapi --port 27005 -u webapiDBA2 -p EWqeeFpUt9*8zq --authenticationDatabase "webapi"


?? аналог .pgpass
-- https://docs.mongodb.com/manual/core/security-x.509/

-- перезапускаем без безопасности
> use admin
> db.shutdownServer()
mongod --dbpath /home/mongo/db5 --port 27005 --fork --logpath /home/mongo/db5/db5.log --pidfilepath /home/mongo/db5/db5.pid

mongo --port 27005




docker stop mongo-shard-1-rs-1 && docker rm mongo-shard-1-rs-1 --volumes
docker stop mongo-shard-1-rs-2 && docker rm mongo-shard-1-rs-2 --volumes
docker stop mongo-shard-1-rs-3 && docker rm mongo-shard-1-rs-3 --volumes
docker stop mongo-shard-2-rs-1 && docker rm mongo-shard-2-rs-1 --volumes
docker stop mongo-shard-2-rs-2 && docker rm mongo-shard-2-rs-2 --volumes
docker stop mongo-shard-2-rs-3 && docker rm mongo-shard-2-rs-3 --volumes


// Всю статистику показать.
