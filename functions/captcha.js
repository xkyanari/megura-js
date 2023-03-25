const { Captcha } = require('captcha-canvas');
const { writeFileSync } = require('fs');

module.exports = async () => {
    const captcha = new Captcha(); //create a captcha canvas of 100x300.
    captcha.async = false; //Sync
    captcha.addDecoy(); //Add decoy text on captcha canvas.
    captcha.drawTrace(); //draw trace lines on captcha canvas.
    captcha.drawCaptcha(); //draw captcha text on captcha canvas.

    console.log(captcha.text); //log captcha text.
    // writeFileSync('captcha.png', captcha.png);
};