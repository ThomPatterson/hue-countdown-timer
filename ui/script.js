document.addEventListener("DOMContentLoaded", async (event) => {
  initialLoad();
});

let rooms = [];

const initialLoad = async () => {
  let response = await fetch('/rooms');
  roomData = await response.json();

  rooms = roomData.map(room => room.name);

  //populate the rooms drop down
  createRoomDropdown(rooms);

  //show any running animations
  await updateRunningList();

  //attach events
  document.getElementById('startTimer').addEventListener('click', startTimer);
  document.getElementById('stopTimer').addEventListener('click', stopTimer);
}

const createRoomDropdown = (roomSet) => {
  let roomSelect = document.getElementById('roomList');

  roomSet.forEach(room => {
    let option = document.createElement('option');
    option.value = room;
    option.innerText = room;
    roomSelect.appendChild(option);
  });
}


const updateRunningList = async () => {
  let response = await fetch('/existingTimers');
  let runningTimers = await response.json();

  let runningList = document.getElementById('runningList');
  runningList.innerHTML = '';

  runningTimers.forEach(timer => {
    let option = document.createElement('option');
    option.value = timer.room;
    option.innerText = `${timer.room} - ${parseInt(timer.durationSec)/60} min`;
    runningList.appendChild(option);
  });
}

const startTimer = async () => {
  let room = document.getElementById('roomList').value;
  let direction = document.getElementById('directionList').value;
  let durationMin = document.getElementById('durationMin').value;

  durationSec = durationMin * 60;

  await fetch(`/startTimer?room=${room}&durationSec=${durationSec}&direction=${direction}`);

  //update the list of running animations
  await updateRunningList();
}

const stopTimer = async () => {
  let room = document.getElementById('runningList').value;

  await fetch(`/stopTimer?room=${room}`);

  //update the list of running animations
  await updateRunningList();
}
