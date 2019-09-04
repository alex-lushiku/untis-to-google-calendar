# Untis to Google Calendar
Import your timetable from WebUntis / Untis Mobile into Google Calendar. Your schedule will be updated every day at **03:00**, **07:00**, **18:00** and **22:00**.

## How to use
There is currently no GUI available, so if you want to keep this running, you will have to:
1. Clone this repository (preferably onto a server)
2. Run `npm i` in the project's root directory
3. Run `node app`

If you want to run this program forever, consider cloning the repository onto a server and install `pm2`.

1. Run `npm i pm2@latest -g`
2. Run `pm2 start app.js --name untis-to-google-calendar`
  (the name property is optional)

## License
[MIT](LICENSE)