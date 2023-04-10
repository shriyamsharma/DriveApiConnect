const express = require('express');
const fs = require('fs');

const app = express();

const multer = require('multer');

const {google} = require('googleapis');
const {GoogleAuth} = require('google-auth-library');

const OAuth2Data = require('./credentials.json');
const res = require('express/lib/response');

const CLIENT_ID = OAuth2Data.web.client_id;
const CLIENT_SECRET = OAuth2Data.web.client_secret;
const REDIRECT_URI = OAuth2Data.web.redirect_uris[0];

var name;

const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

var authed = false;

function capatalize(str){
    var CapStr = "";
    var flag = true;
    for(let i = 0; i<str.length; i++){
        if(flag){
            CapStr += str.charAt(i).toUpperCase();
            flag = false;
        } else if(str.charAt(i) == " "){
            CapStr += " ";
            flag = true;
        } else {
            CapStr += str.charAt(i);
        }
    }
    return CapStr;
}

// File Upload
var Storage = multer.diskStorage({
    destination: function(req, file, callback){
        callback(null, './images');
    },
    filename: function(req, file, callback) {
        callback(null, file.fieldname + "_" + Date.now() + "_" + file.originalname)
    }
})

var upload = multer({
    storage: Storage
}).single("file");

const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive";


app.set("view engine", "ejs");

app.get('/', (req, res) => {
    if(!authed){
        var url = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES
        });
        console.log(url);

        res.render("index", {url:url});
    } else{
        var oauth2 = google.oauth2({
            auth:oAuth2Client,
            version:'v2'
        });

        // user info
        oauth2.userinfo.get(function(err, response) {
            if(err) throw err

            console.log(response.data);

            name = capatalize(response.data.name);

            res.render("success", {name: name, success:false});
        })
        
    }
});

app.get('/google/callback', (req, res) => {
    const code = req.query.code;

    if(code){
        //get an access token

        oAuth2Client.getToken(code, function(err, tokens){
            if(err){
                console.log("Error In Authenticating");
                console.log(err);
            } else {
                console.log("Successfully Authenticated");
                console.log(tokens);
                oAuth2Client.setCredentials(tokens);
              
                authed = true;

                res.redirect('/');
            }
        })
    }
})

app.post('/upload', (req, res) => {
    upload(req, res, function(err){
        if(err) throw err
        console.log(req.file.path)

        const drive = google.drive({
            version: 'v3',
            auth: oAuth2Client
        });

        const filemetadata = {
            name: req.file.name
        }

        const media = {
            mimeType: req.file.mimetype,
            body: fs.createReadStream(req.file.path)
        }

        drive.files.create({
            resource: filemetadata,
            media: media,
            fields:"id"
        }, (err, file) => {
            if(err) throw err

            //delete the file in images folder

            fs.unlinkSync(req.file.path);
            res.render("success", {name: name, picture: picture, success:true});

        })
    })
});

app.get('/getfiles', async (req, res) => {
    const drive = google.drive({
        version: 'v3',
        auth: oAuth2Client
    });

    const files = [];

    try {
        const resp = await drive.files.list({
          q: 'mimeType=\'image/jpeg\'',
          fields: 'nextPageToken, files(id, name)',
          spaces: 'drive',
        });
        resp.data.files.forEach(function(file) {
          console.log('Found file:', file.name, file.id);
          files.push(file);
        });

        // console.log(resp.data.files)
        
        // console.log(files)
        
        // return res.send({files: resp.data.files});
        // return res.send(files[0]);
        res.render('fileslist', {files});
      } catch (err) {
        throw err;
      } 
});

app.get('/download/:fileId', async (req, res) => {
    const drive = google.drive({
        version: 'v3',
        auth: oAuth2Client
      });
    
      const fileId = req.params.fileId;
    
      try {
        const file = await drive.files.get({
          fileId: fileId,
          alt: 'media',
        }, { responseType: 'blob' });
    
        res.set({
          'Content-Type': file.headers['content-type'],
          'Content-Length': file.headers['content-length'],
          'Content-Disposition': `attachment; filename="${file.data.name}"`
        });
    
        res.send(file.data);
      } catch (err) {
        console.error('Error getting file:', err);
        res.status(500).send({ error: 'Error getting file' });
      }
});

app.get('/thanks', (req, res) => {
    const message = `<h1 style="text-align: center;"> Thank You for Visiting this Website!</h1>`;
    res.send(message);
});

app.get('/logout', (req, res) => {
    authed: false;
    res.redirect('/thanks');
});


app.listen(3000, () => {
    console.log("App is running on port 3000");
})