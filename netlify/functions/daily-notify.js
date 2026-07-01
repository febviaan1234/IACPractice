// Netlify serverless function: sends daily IAC Practice notifications via OneSignal
// Called by cron-job.org every day at 6 PM

exports.handler = async function(event) {
  // Simple security: check for secret key
  const secret = event.queryStringParameters && event.queryStringParameters.key;
  const expectedSecret = process.env.NOTIFY_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const APP_ID = process.env.ONESIGNAL_APP_ID;
  const API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!APP_ID || !API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing OneSignal config' }) };
  }

  // Rotate messages to keep it fresh
  const streakMessages = [
    "Keep up your {{streak_days}}-day streak! Open the app and hit your daily goal.",
    "{{streak_days}} days strong! Don't break the chain.",
    "Your {{streak_days}}-day streak is on the line. 10 questions keeps it alive!",
    "Day {{streak_days}} and counting! Jump in and keep your streak going.",
  ];
  const noStreakMessages = [
    "Ready to start a streak? Just 10 questions and you're on your way!",
    "Today is a great day to start studying. Jump in!",
    "Your future self will thank you. Start a streak today!",
    "A new streak starts with one session. Let's go!",
  ];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const results = [];

  // Notification 1: users WITH a streak
  try {
    const res1 = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + API_KEY,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        headings: { en: 'IAC Practice' },
        contents: { en: pick(streakMessages) },
        filters: [
          { field: 'tag', key: 'streak_days', relation: '>', value: '0' }
        ],
        url: 'https://iacpractice.netlify.app',
      }),
    });
    const data1 = await res1.json();
    results.push({ segment: 'streakers', status: res1.status, id: data1.id || null, errors: data1.errors || null });
  } catch (e) {
    results.push({ segment: 'streakers', error: e.message });
  }

  // Notification 2: users WITHOUT a streak
  try {
    const res2 = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + API_KEY,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        headings: { en: 'IAC Practice' },
        contents: { en: pick(noStreakMessages) },
        filters: [
          { field: 'tag', key: 'streak_days', relation: '=', value: '0' },
          { operator: 'OR' },
          { field: 'tag', key: 'streak_days', relation: 'not_exists' }
        ],
        url: 'https://iacpractice.netlify.app',
      }),
    });
    const data2 = await res2.json();
    results.push({ segment: 'no_streak', status: res2.status, id: data2.id || null, errors: data2.errors || null });
  } catch (e) {
    results.push({ segment: 'no_streak', error: e.message });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ sent: true, time: new Date().toISOString(), results }),
  };
};
