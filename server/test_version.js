const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Node Version: ' + process.version + '\n');
});
server.listen(9000);
console.log('Test server running on port 9000');
