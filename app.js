const fs = require('fs');
const cron = require('node-cron');
const readline = require('readline');
const WebUntis = require('webuntis');
const { google } = require('googleapis');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

const TOKEN_PATH = 'token.json'; /// Automatically created on first authorization

const user = '156132';
const pass = 'vavo';
const school = 'ROC Horizon College'; // id == 1202500
const server = 'neilo';

const untis = new WebUntis(
  school, user, pass, `${server}.webuntis.com`
);

function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function importEvents(auth) {
  /// Start and End date of range
  var startDate = new Date();
  var endDate = new Date();
  endDate.setDate(startDate.getDate() + 14);

  untis.login()
    .then(() => {
      return untis.getOwnTimetableForRange(startDate, endDate);
    })
    .then(timetable => {
      const gcalendar = google.calendar({version: 'v3', auth});

      const calendar = {
        'summary': 'Untis',
        'timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      }

      gcalendar.calendarList
        .list()
        .then((calendars) => {
          const res = calendars.data.items
            .filter(cal => cal.summary == calendar.summary);
          
          if (!res || res.length == 0) {
            gcalendar.calendars
              .insert({
                auth: auth,
                resource: calendar
              })
              .then(calendar => {
                gcalendar.calendarList
                  .insert({
                    auth: auth,
                    resource: calendar,
                  })
                  .then(calendar => {
                    calendar.data.backgroundColor = '#FF9800';
                    calendar.data.foregroundColor = '#FF9800';
                  });
              });

              fs.readFile('credentials.json', (e, content) => {
                if (e) return console.error('Error loading client secret:', e);
                authorize(JSON.parse(content), importEvents);
              });
          } else {
            let calendarID = res[0].id;

            // Clear events
            gcalendar.events
              .list({calendarId: calendarID})
              .then(events => {
                events.data.items.forEach(event => {
                  gcalendar.events.delete({
                    calendarId: calendarID,
                    eventId: event.id
                  });
                });
              });

            // Add events
            for (let i = 0;i < timetable.length;i++) {
              var event = classToEvent(JSON.stringify(timetable[i]));

              gcalendar.events
                .insert({
                  auth: auth,
                  calendarId: res[0].id,
                  resource: event
                }, function (e, event) {
                  if (e) {
                    console.log(e); 
                    return;
                  }
                })
            }
          }
        });
    });
}

/// Calendar API

fs.readFile('credentials.json', (e, content) => {
  if (e) return console.error('Error loading client secret:', e);
  authorize(JSON.parse(content), importEvents);
});

cron.schedule('0 3,7,18,22 * * *', () => {
  fs.readFile('credentials.json', (e, content) => {
    if (e) return console.error('Error loading client secret:', e);
    authorize(JSON.parse(content), importEvents);
  });
});
  
function classToEvent(lessonObj) {
  var lesson = JSON.parse(lessonObj);

  var startTime = lesson['startTime'].toString();
  var endTime = lesson['endTime'].toString();

  if (startTime.length == 3) {
    startTime = '0' + startTime;
  }

  if (endTime.length == 3) {
    endTime = '0' + endTime;
  }

  var startDateTime = new Date(
    lesson['date'].toString().substring(0, 4),
    lesson['date'].toString().substring(4, 6),
    lesson['date'].toString().substring(6, 8),
    startTime.substring(0, 2)[0] == '0' ? startTime.substring(1, 2) : startTime.substring(0, 2),
    startTime.substring(1, 3)[0] == '0' ? startTime.substring(3, 4) : startTime.substring(2, 4),
  );

  var endDateTime = new Date(
    lesson['date'].toString().substring(0, 4),
    lesson['date'].toString().substring(4, 6),
    lesson['date'].toString().substring(6, 8),
    endTime.substring(0, 2)[0] == '0' ? endTime.substring(1, 2) : endTime.substring(0, 2),
    endTime.substring(2, 4)[0] == '0' ? endTime.substring(3, 2) : endTime.substring(2, 4)
  ); 

  startDateTime.setMonth(startDateTime.getMonth() - 1);
  endDateTime.setMonth(endDateTime.getMonth() - 1);

  var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  var event = {
    'summary': lesson['lstext'],
    'location': '',
    'description': lesson['activityType'],
    'start': {
      'dateTime': startDateTime,
      'timeZone': timezone
    },
    'end': {
      'dateTime': endDateTime,
      'timeZone': timezone
    }
  }

  return event;
}