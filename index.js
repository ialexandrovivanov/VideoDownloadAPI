const fs = require("fs");
const fetch = require('node-fetch');
const childProcess = require("child_process");
const express = require("express");
const app = express();

app.use(express.json());  // needed for parsing json objects from client
app.use(express.urlencoded({ extended: true }));
app.listen(8000, () => console.log("Listening on port 8000!"));

app.get("/", (req, res) => { 
    res.sendFile(__dirname + "/index.html");
});

app.post("/", async (req, res) => {
    const validCaptcha = await validateCaptcha(req);    
    if (!validCaptcha) { renderCaptchaPage(res); return; }  // validate google captcha
    const validUrl = await validateUrl(req);
    if (!validUrl) { renderUnablePage(res); return; }       // validate provided link        
    const videoFileName = await getVideoFileName(req);      // gets requested file from file system or undefined    
    if (videoFileName) renderVideoPage(res, videoFileName); // video is already on server 
    else {                                                  // new download
        const success =  await downloadFile(req); 
        if(success) {
            const videoFileName = await getVideoFileName(req); // newly created file could be mp4 or mkv
            if (videoFileName) {
                await ClearUserInputForm();
                renderVideoPage(res, videoFileName);        // render video page with the name of the video file
            }
            else 
                renderUnablePage(res);
        } 
        else renderUnablePage(res);                         // if error when download render unable page
    }
});

app.get("/video", (req, res) => {
    res.sendFile(__dirname + `/${req.query.filename}`);
});

app.get("/icon", (req, res) => {
    res.sendFile(__dirname + "/favicon.ico");
});

async function getVideoFileName(req, res) {
    try {
        const allFiles = await getFiles(); // array of files with extensions (full names)
        // returns full name of the first file which starts with requested id or undefined
        return allFiles.find(f => f.startsWith(/v=(.*)/.exec(req.body.link)[1])); // first wich starts with id
    } catch (err) {
        logger(err);
        return undefined;
    }
}

async function validateCaptcha(req) {
    const captchaKey = req.body["g-recaptcha-response"];
    if (captchaKey === undefined || captchaKey === null || captchaKey === "") 
        return false;
    else {
        const secretKey = "6LctKq8aAAAAADQ_om2Qt_aFlzBUMysGkRPl69oR";
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

function renderVideoPage(res, videoFileName) {
    const original = fs.readFileSync("video.html", "utf8");
    // dynamicaly inserts requested file as query parameter to video source 
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
    try {
        await childProcess.execSync(`ytdl --id ${req.body.link}`, async (err, stdout, stderr) => 
            { await logger(err, stdout, stderr); });
        return true;
    } catch (err) { 
        logger(err); 
        return false; 
    }
}

async function logger(err, stdout, stderr) {
    console.log(err, stdout, stderr);
}