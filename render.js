const fs = require('fs');
const Handlebars = require('handlebars');

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