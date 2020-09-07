# Hue Countdown Timer

This is a simple app to interact with your [Philips Hue Bridge](https://www.philips-hue.com/en-us/p/hue-bridge/046677458478).  The Web UI lets you pick a room and a duration.  The app then finds the lights in that room, sorts them, and begins a countdown where the duration is spread across all the lights in that room.

First it sets all the lights to white.

Then the first light in the sequence will blink briefly, then transition to yellow, then transition to red.

Once a light is red, the next light in the sequence will activate.

When all the lights in the room are red, they will all blink together for 10 seconds indicating that time is up.

## Setup

Update the config.js file with your bridge address and bridge username.  If this is your first time interacting with the API on your bridge, you can [follow the steps here](https://developers.meethue.com/develop/get-started-2/) to create your bridge username.

`npm start` gets you up and running.  Serves on `8080`.

If you prefer running something like this in docker, check out [hue-countdown-timer-docker](https://github.com/ThomPatterson/hue-countdown-timer-docker).

## Changing the colors

You can change the colors in [config.js](config.js).  I blieve [this is the color space](https://en.wikipedia.org/wiki/CIE_1931_color_space) that Hue uses.  Rather than figuring that out I just change the light to whatever color I want in the app, and then query it (e.g. `http://{BRIDGE_IP}/api/{BRIDGE_USERNAME}/lights/{LIGHT_ID}`) with the Hue API to get its current X,Y values.  Pop those in the config and Bob's your uncle.

## Web UI

Served on port `8080` at `/ui`

## API Endpoints

### Start a Timer
`/startTimer?room=Dining&durationSec=60&direction=backward`

Starts a countdown timer in a specified room for a specified duration.

Supported Query String Params
* `room` - The name of one of your rooms.
* `durationSec` - integer, how many seconds the countdown should take
* `direction` - either `backward` or `forward`.  The order that the lights perform the countdown.

&nbsp;

`/existingTimers`

Lists existing running timers.

&nbsp;

`/stopTimer?room=Dining`

Stops a timer that is in progress.

Supported Query String Params
* `room` - The name of one of your rooms.

&nbsp;

`/rooms`

Returns a list of the rooms in your Hue Bridge and the sorted lights in that room.

&nbsp;

`/lights`

Returns a list of all the lights in the Hue Bridge.  Provides their ID and Name.

## Sorting Lights

Hue light IDs won't necessarily be in the same order as the lights are installed.  For example:
* 16 = Dining 4
* 17 = Dining 1
* 18 = Dining 3
* 19 = Dining 2
* 20 = Dining 5

Assuming that the user named their lights sequentially, the app will sort the lights based on their name.  

If the light names in a room are not naturally sortable, or you want to specify the order yourself, the can do so with an override in the CONFIG file.  I left an example in there which should be self explanatory, and you can use the API endpoints specified above to get the info you need (i.e. Room Name and Light IDs).
