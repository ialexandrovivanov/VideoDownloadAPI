const fs = require("fs");
const fetch = require('node-fetch');
const childProcess = require("child_process");
const keys = require(__dirname + "/keys.json");
const express = require("express");
const app = express();

app.use(express.json());  // parsing json objects from client
app.use(express.urlencoded({ extended: true }));

// ROUTING

app.get("/", (req, res) => { 
    
    res.sendFile(__dirname + "/index.html");
});

app.post("/", async (req, res) => {
    
    const validCaptcha = await validateCaptcha(req);    
    if (!validCaptcha) { renderCaptchaPage(res); return; }  
    const validUrl = await validateUrl(req);
    if (!validUrl) { renderUnablePage(res); return; }               
    const videoFileName = await getVideoFileName(req);          
    if (videoFileName) renderVideoPage(res, videoFileName); 
    else {                                                  
        const success =  await downloadFile(req); 
        if(success) {
            const videoFileName = await getVideoFileName(req); 
            if (videoFileName) renderVideoPage(res, videoFileName);        
            else renderUnablePage(res);
        } 
        else renderUnablePage(res);                         
    }
});

app.get("/video", (req, res) => {

    res.sendFile(__dirname + `/${req.query.filename}`);
});

app.get("/icon", (req, res) => {

    res.sendFile(__dirname + "/favicon.ico");
});

app.listen(80, () => { 

    console.clear();
    console.log("Listening on port 80");
});

// HELPER FUNCTIONS

async function getVideoFileName(req, res) {

    try {

        const allFiles = await getFiles();
        const file = allFiles.find(f => f.startsWith(/v=(.*)/.exec(req.body.link)[1]));
        return file;
    } 
    catch (err) {

        await logger(err);
        return undefined;
    }
}

async function validateCaptcha(req) {

    const captchaKey = req.body["g-recaptcha-response"];
    if (captchaKey === undefined || captchaKey === null || captchaKey === "") return false;
    else {
        const secretKey = keys.secret;
        const verifyUrl = "https://www.google.com/recaptcha/api/siteverify"
        const response = await fetch(verifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `secret=${secretKey}&response=${captchaKey}`,
        });
        const resJson = await response.json();
        if (resJson.success === true) return true;
        return false;
   }
}

async function validateUrl(req) {

    if (req.body.link.startsWith("https://www.youtube.com/watch?v=")) return true;
    return false;
}

async function renderVideoPage(res, videoFileName) {

    const original = await fs.readFileSync("video.html", "utf8");
    const rendered = original.replace(/src="(.*)"/, `src="/video?filename=${videoFileName}"`); 
    res.writeHead(200, {'Content-type' : 'text/html'});
    res.write(rendered);
    res.end();
}

function renderUnablePage(res) {

    res.sendFile(__dirname + "/unable.html");
}

async function getFiles() {

    return fs.readdirSync(__dirname);
}

async function renderCaptchaPage(res) {

    res.sendFile(__dirname + "/captcha.html");
}

async function downloadFile(req) {

    await updateItdl();

    try {

        childProcess.execSync(`ytdl --id ${req.body.link}`, async (err, stdout, stderr) => { 
            await logger(err, stdout, stderr); 
        });
        return true;
    } 
    catch (err) { 

        await logger(err); 
        return false; 
    }
}

async function logger(err, stdout, stderr) {
    
    console.log(err, stdout, stderr);
}

async function updateItdl() {

    try {

        childProcess.execSync("ytdl --update", async (err, stdout, stderr) => { 
            await logger(err, stdout, stderr); 
        });
        return true;
    } 
    catch (err) { 

        await logger(err); 
        return false; 
    }    
}