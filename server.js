const http = require("http");
const fs = require("fs");
const path = require("path");

// Path to your PFX file and password
//const pfxPath = "C:/Users/Charlie/Documents/Projects/Personal/basis for thing/cert/localhost.pfx";
//const pfxPassword = "YourPasswordHere";
//
//const options = {
//  pfx: fs.readFileSync(pfxPath),
//  passphrase: pfxPassword
//};

const server = http.createServer((req,res)=>{
    const filePath = path.join(__dirname, req.url);

  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.statusCode = 404;
      res.end('File not found');
      return;
    }

    // Get file stats
    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.statusCode = 500;
        res.end('Server error');
        return;
      }

      // Set appropriate headers
      res.setHeader('Content-Length', stats.size);

      const type_dict = {
        "js":"text/javascript",
        "html":"text/html",
        "wgsl":"text/wgsl",
        "jpg":"image/jpeg"
      };
      console.log(filePath)
      var type = type_dict[filePath.split(".").at(-1).toLowerCase()];
      res.setHeader('Content-Type', type);

      // Create read stream and pipe to response
      const stream = fs.createReadStream(filePath);

      // Handle errors
      stream.on('error', (err) => {
        console.error('Error reading file:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Error reading file');
        }
      });

      // Pipe the file to the response
      stream.pipe(res);
    });
  });
})

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`File server running at https://localhost:${PORT}/`);
});