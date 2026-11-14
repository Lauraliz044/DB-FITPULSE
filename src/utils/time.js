const settings = require('../config/settings');

function businessDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: settings.timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(value);
  const values = {};
  for (const part of parts) values[part.type] = part.value;
  return `${values.year}-${values.month}-${values.day}`;
}

function utcDate(value) {
  return new Date(`${value.replace(' ', 'T')}Z`);
}

module.exports = { businessDate, utcDate };
