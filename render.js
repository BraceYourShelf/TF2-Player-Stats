const fs = require('fs');
const Handlebars = require('handlebars');

Handlebars.registerHelper('splitLogs', function(logString) {
  var logs = logString.split(", ");

  let logList = '';
  for (const logId of logs) {
    logList += `<a href="https://logs.tf/${logId}">${logId}</a>, `
  }
  return logList;
});

function render(filename, data)
{
  let source   = fs.readFileSync(filename,'utf8').toString();
  let template = Handlebars.compile(source);
  let output = template(data);
  return output;
}

let data = JSON.parse(fs.readFileSync("./totalPlayerStats.json", 'utf8'));
let result = render('./templates/index.hbs', data);
fs.writeFileSync("public/index.html", result);