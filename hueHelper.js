const axios = require('axios');
const config = process.env.hasOwnProperty('CONFIG') ? JSON.parse(process.env.CONFIG) : require('./config.js');


const localHueApi = axios.create({
  baseURL: `http://${config.HUE_BRIDGE_ADDRESS}/api/${config.HUE_BRIDGE_USERNAME}`,
  headers: {
    'Content-Type': 'application/json'
  }
});

function sleep(sec) {
  return new Promise(resolve => setTimeout(resolve, sec * 1000));
}

const log = (msg) => {
  console.log(`${new Date()} - ${msg}`);
}

//returns an object where key is groupID and value is the name of the room
const getRoomList = async () => {
  let masterLightList = await getLightNames();
  let response = await localHueApi.get('/groups');
  let rooms = []
  for (let [key, value] of Object.entries(response.data)) {
    if (value.type.toLowerCase() == 'room') {
      rooms.push({
        name: value.name,
        lights: sortLights(masterLightList, value.lights, value.name)
      });
    }
  }
  return rooms;
}

const getLightNames = async () => {
  let response = await localHueApi.get('/lights');
  let lights = {}
  for (let [key, value] of Object.entries(response.data)) {
    lights[key] = value.name;
  }
  return lights;
}

/*
  hue light IDs won't necessarily be in the same order as the lights are installed
  e.g.
  16 = Dining 4
  17 = Dining 1
  18 = Dining 3
  19 = Dining 2
  20 = Dining 5

  assuming that the user named their lights sequentially, sort the lights to
  correspond to the order the lights are actually installed in

  CONFIG file allows for override of light order
  (for when light names are not naturally sortable)
*/
const sortLights = (masterLightList, roomLightList, roomName) => {
  let orderedLights = [];

  let i = config.ROOM_LIGHT_ORDER_OVERRIDES.findIndex(room => room.roomName == roomName);
  if (i > -1) {
    //if the room has a light order override in the config, use it
    orderedLights = config.ROOM_LIGHT_ORDER_OVERRIDES[i].lightsOrder;
  } else {
    //otherwise sort the lights as presented from the room

    //get the names of the lights in this room
    let roomLightNames = [];
    roomLightList.forEach(id => {
      roomLightNames.push(masterLightList[id])
    });

    //sort the lights by their name
    roomLightNames.sort();

    //get the ids of these lights
    roomLightNames.forEach(lightName => {
      for (let [key, value] of Object.entries(masterLightList)) {
        if (lightName == value) {
          orderedLights.push(key);
        }
      }
    });
  }

  return orderedLights;
}

const setLightColor = async (lightId, colorState, transitionTimeSec) => {
  transitionTimeHue100ms = Math.floor(transitionTimeSec) * 10;//hue api uses int multiples of 100ms
  localHueApi.put(`/lights/${lightId}/state`, {
    ...colorState,
    "transitiontime": transitionTimeHue100ms,
    "alert": "none"
  });
}

const setLightAlert = async (lightId, durationSec) => {
  //lselect alert last for 15 seconds: https://developers.meethue.com/develop/hue-api/lights-api/#set-light-state
  //setting alert to none will interrupt the 15 second alert
  let response = await localHueApi.put(`/lights/${lightId}/state`, {
    "alert": "lselect"
  });
  log(JSON.stringify(response.data));

  await sleep(durationSec);

  response = await localHueApi.put(`/lights/${lightId}/state`, {
    "alert": "none"
  });
  log(JSON.stringify(response.data));

}

module.exports = {
  getRoomList,
  getLightNames,
  setLightColor,
  setLightAlert
}
