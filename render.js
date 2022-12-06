const fs = require('fs');
const glob = require("glob");
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

const files = glob.sync('rglLogs/**/**/*_output.json');

files.forEach(filepath => {
  let data = JSON.parse(fs.readFileSync(`./${filepath}`, 'utf8'));
 // let result = render('./templates/statsTable.hbs', data);
 // Handlebars.registerPartial(`${filepath.replaceAll('/', '-')}_table`, result);

  try {
    let renderedStats = render('./templates/statsPage.hbs', data);
    let splitFilepath = filepath.split('/');
    let filename = splitFilepath.splice(-1);
    filepath = splitFilepath.join('/');

    fs.mkdirSync(`public/${filepath}`, { recursive: true }, (err) => {
      if (err) throw err;
    });

    filename = `${filepath}/${filename}`;
    fs.writeFileSync(`public/${filename}.html`, renderedStats);
  } catch (err) {
    console.log(err.message);
  }
});

let index = render('./templates/index.hbs');
fs.writeFileSync(`public/index.html`, index);