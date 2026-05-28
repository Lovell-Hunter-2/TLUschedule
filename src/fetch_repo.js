import https from 'https';
import fs from 'fs';
import { execSync } from 'child_process';

const file = fs.createWriteStream("repo.zip");
https.get('https://gitlab.com/nekkochan0x0007/tlucalendar/-/archive/main/tlucalendar-main.zip', function(response) {
  if (response.statusCode === 302 || response.statusCode === 301) {
    https.get(response.headers.location, function(res) {
      res.pipe(file);
      file.on('finish', function() {
        file.close();  
        execSync('unzip -o repo.zip -d /tmp/repo');
        console.log('Done!');
      });
    });
  } else {
     response.pipe(file);
     file.on('finish', function() {
        file.close();  
        execSync('unzip -o repo.zip -d /tmp/repo');
        console.log('Done!');
     });
  }
});
