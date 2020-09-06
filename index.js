const express = require('express');
const app = express();
const uuid = require('short-uuid');
const hueHelper = require('./hueHelper.js');

const config = process.env.hasOwnProperty('CONFIG') ? JSON.parse(process.env.CONFIG) : require('./config.js');
let existingTimers = {};

function sleep(sec) {
  return new Promise(resolve => setTimeout(resolve, sec * 1000));
}

const log = (msg) => {
  console.log(`${new Date()} - ${msg}`);
}

const startTimer = async (roomName, durationSec, direction) => {

  let roomList = await hueHelper.getRoomList();
  let room = roomList.find(room => room.name == roomName);
  let lightList = room.lights;

  if (direction == "backwards") {
    lightList.reverse();
  }

  await setAllToWhite(lightList);

  let perLightDuration = durationSec / lightList.length;

  existingTimers[roomName] = [];
  for (let i = 0; i < lightList.length; i++) {
    existingTimers[roomName].push(setTimeout(() => {
      doSingleLightSequence(lightList[i], perLightDuration)
    }, i * perLightDuration * 1000));
  }

  //add the final red blink
  existingTimers[roomName].push(setTimeout(() => {
    lightList.forEach(lightId => {
      hueHelper.setLightAlert(lightId, 10);
    });
    log(`${roomName} timer completed!`);
  }, lightList.length * perLightDuration * 1000));

};

const setAllToWhite = async (lightList) => {
  lightList.forEach(async lightId => {
    await hueHelper.setLightColor(lightId, config.WHITE, 0);
  })
}

const doSingleLightSequence = async (lightId, duration) => {

  log(`Executing single light sequence for lightId ${lightId} for ${duration} seconds`);

  let colorTransitionTime = (duration - 2) / 2;

  log(`BLINK START`);
  await hueHelper.setLightAlert(lightId, 2); //this will take 2 seconds
  log(`BLINK COMPLETE`);

  log('YELLOW START')
  await hueHelper.setLightColor(lightId, config.YELLOW, colorTransitionTime);
  log(`YELLOW STARTED`);

  await sleep(colorTransitionTime);

  log('RED START')
  await hueHelper.setLightColor(lightId, config.RED, colorTransitionTime);
  log(`RED STARTED`);
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
    let direction = (req.query.hasOwnProperty('direction')) ? req.query.durationSec : config.DEFAULT_DIRECTION;

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

app.get('/startAnimation', async (req, res) => {
  try {
    let sceneId = (req.query.hasOwnProperty('sceneid')) ? req.query.sceneid : false;
    let transitionTime = (req.query.hasOwnProperty('transitiontime')) ? parseInt(req.query.transitiontime) : config.DEFAULT_TRANSITION_TIME;
    let transitionDelay = (req.query.hasOwnProperty('transitiondelay')) ? parseInt(req.query.transitiondelay) : config.DEFAULT_TRANSITION_DELAY;
    let animation = (req.query.hasOwnProperty('animation')) ? req.query.animation.toLowerCase() : config.DEFAULT_ANIMATION;

    if (!sceneId) {
      return res.status(400).send('Missing required parameter: sceneId');
    }

    let roomSceneList = await hueHelper.getRoomSceneList();
    let roomScene = roomSceneList.find(roomScene => roomScene.sceneId == sceneId);
    if (!roomScene) {
      return res.status(400).send(`sceneid ${sceneId} does not match any known scene.  Value must me one of:\n\n${JSON.stringify(roomSceneList, null, 2)}`);
    }

    if (supportedAnimationTypes.indexOf(animation) < 0) {
      return res.status(400).send(`animation must be one of: ${supportedAnimationTypes.join(', ')}`);
    }

    let initialLightStates = await hueHelper.getSceneLightStates(sceneId);
    let sortedInitialLightStates = await hueHelper.sortSceneLights(initialLightStates, roomScene.groupId);

    if (animation == 'evenodd') {
      if (initialLightStates.length < 2) {
        return res.status(400).send('evenodd animation requires at least 2 lights in scene');
      }
    }

    //stop any animations already running for this roomName
    let existingAnimationIndex = existingAnimations.findIndex(anim => anim.roomName == roomScene.room);
    if (existingAnimationIndex > -1) {
      stopAnimation(existingAnimationIndex);
    }

    startAnimation(sortedInitialLightStates, transitionTime, transitionDelay, animation, roomScene);

    res.send("done");

  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

app.get('/existingAnimations', async (req, res) => {
  let cleanedExistingAnimations = existingAnimations.map(anim => {
    return {
      id: anim.id,
      sceneName: anim.sceneName,
      roomName: anim.roomName
    }
  });
  return res.send(cleanedExistingAnimations);
});

app.get('/stopAnimation', async (req, res) => {
  let id = (req.query.hasOwnProperty('id')) ? req.query.id : false;

  if (!id) {
    return res.status(400).send('Missing required parameter: id');
  }

  let existingAnimationIndex = existingAnimations.findIndex(anim => anim.id == id);
  if (existingAnimationIndex < 0) {
    return res.status(400).send(`id ${id} not recognized as an existing animation`);
  }

  stopAnimation(existingAnimationIndex);

  res.send("done");
});

app.use(`/ui`, express.static('ui'));

//fire it up
app.listen(8080);
console.log('Listening on port 8080');
