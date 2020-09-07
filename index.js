const express = require('express');
const app = express();
const uuid = require('short-uuid');
const hueHelper = require('./hueHelper.js');

const config = process.env.hasOwnProperty('CONFIG') ? JSON.parse(process.env.CONFIG) : require('./config.js');
let existingTimers = [];

function sleep(sec) {
  return new Promise(resolve => setTimeout(resolve, sec * 1000));
}

const log = (msg) => {
  console.log(`${new Date()} - ${msg}`);
}

const startTimer = async (roomName, durationSec, direction) => {

  let timerObj = {
    room: roomName,
    durationSec: durationSec,
    timeouts: []
  }


  let roomList = await hueHelper.getRoomList();
  let room = roomList.find(room => room.name == roomName);
  let lightList = room.lights;

  if (direction == "backward") {
    lightList.reverse();
  }

  await setAllToWhite(lightList);

  let perLightDuration = durationSec / lightList.length;


  for (let i = 0; i < lightList.length; i++) {
    timerObj.timeouts.push(setTimeout(() => {
      doSingleLightSequence(lightList[i], perLightDuration)
    }, i * perLightDuration * 1000));
  }

  //add the final red blink
  timerObj.timeouts.push(setTimeout(() => {
    lightList.forEach(lightId => {
      hueHelper.setLightAlert(lightId, 10);
    });
    let existingTimerIndex = existingTimers.findIndex(timer => timer.room == roomName);
    stopTimer(existingTimerIndex);
    log(`${roomName} timer completed!`);
  }, durationSec * 1000));


  existingTimers.push(timerObj);
};

const setAllToWhite = async (lightList) => {
  lightList.forEach(async lightId => {
    await hueHelper.setLightColor(lightId, config.WHITE, 0);
  })
}

const doSingleLightSequence = async (lightId, duration) => {
  let colorTransitionTime = (duration - 2) / 2;
  await hueHelper.setLightAlert(lightId, 2); //this will take 2 seconds
  await hueHelper.setLightColor(lightId, config.YELLOW, colorTransitionTime);
  await sleep(colorTransitionTime);
  await hueHelper.setLightColor(lightId, config.RED, colorTransitionTime);
}

const stopTimer = (i) => {
  for (let j = 0; j < existingTimers[i].timeouts.length; j++) {
    clearTimeout(existingTimers[i].timeouts[j]);
  }
  existingTimers = [
    ...existingTimers.slice(0, i),
    ...existingTimers.slice(i + 1, existingTimers.length)
  ]
}



app.get('/rooms', async (req, res) => {
  let roomList = await hueHelper.getRoomList();
  return res.send(roomList);
});

app.get('/lights', async (req, res) => {
  let lightList = await hueHelper.getLightNames();
  return res.send(lightList);
});

app.get('/startTimer', async (req, res) => {
  try {
    let room = (req.query.hasOwnProperty('room')) ? req.query.room : false;
    let durationSec = (req.query.hasOwnProperty('durationSec')) ? req.query.durationSec : false;
    let direction = (req.query.hasOwnProperty('direction')) ? req.query.direction : config.DEFAULT_DIRECTION;

    if (!room) {
      return res.status(400).send('Missing required parameter: room');
    }
    if (!durationSec) {
      return res.status(400).send('Missing required parameter: room');
    }

    await startTimer(room, durationSec, direction)

    res.send("done");
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }

});


app.get('/existingTimers', async (req, res) => {
  let cleanedExistingTimers = existingTimers.map(timer => {
    return {
      room: timer.room,
      durationSec: timer.durationSec,
    }
  });
  return res.send(cleanedExistingTimers);
});

app.get('/stopTimer', async (req, res) => {
  let room = (req.query.hasOwnProperty('room')) ? req.query.room : false;

  if (!room) {
    return res.status(400).send('Missing required parameter: room');
  }

  let existingTimerIndex = existingTimers.findIndex(timer => timer.room == room);
  if (existingTimerIndex < 0) {
    return res.status(400).send(`room ${room} not recognized as an existing animation`);
  }

  stopTimer(existingTimerIndex);

  res.send("done");
});

app.use(`/ui`, express.static('ui'));

//fire it up
app.listen(8080);
console.log('Listening on port 8080');
