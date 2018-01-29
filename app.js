const { Client } = require('discord-rpc'),
    spotifyWeb = require('./spotify'),
    log = require("fancy-log"),
    events = require('events'),
    fs = require('fs'),
    meme = require('color-log'),
    yaml = require('js-yaml'),
    https = require('https'),
    r = require('request');

/**
 * Random Functions.
**/
function WelcomeMessage() {
    meme.mark(` `);
    meme.mark(`             ---------------------------------------------`);
    meme.mark(`                   Thank you for using MLG Spoticord!`);
    meme.mark(`             ---------------------------------------------`);
    meme.mark(` `);
}
/** 
 *   Checks to see if any config.yml is present, if not the program will not load.
**/
try {
    const configFile = yaml.safeLoad(fs.readFileSync('config.yml', 'utf8'));
    global.config = configFile;
    runMainCode();
} catch (e) {
    WelcomeMessage();
    meme.warn("Since your config.yml has been deleted, a new one is downloading.");
    try {
        const createYML = fs.createWriteStream('config.yml', 'utf8');
        https.get("https://raw.githubusercontent.com/JackKellyBayliss/spoticord-mlg/master/config.yml", (res) => {
            res.pipe(createYML);
            meme.warn("Please Wait...");
        });

    } catch (e) {
        console.log(e);
    };
    function runMain() {
        const configFile = yaml.safeLoad(fs.readFileSync('config.yml', 'utf8'));
        global.config = configFile;
        runMainCode();
    }
    setTimeout(runMain, 5000);
}

function runMainCode() {
var configVar = {
    'song': config.Emojis.Song,
    'artist': config.Emojis.Artist,
    'largeHover': config.Emojis.largeHover,
    'smallHover': config.Emojis.smallHover,
    'appClientID': config.appClientID,
    'largeImageKey': config.imageKeys.Large,
    'smallImageKey': config.imageKeys.Small,
    'smallPausedImageKey': config.imageKeys.smallPaused,
    'rpcTransportType': config.rpcTransportType,
    'shareAnonAnalytics': config.shareAnonAnalytics,
    'JKBsharingAnalytics': config.JKBsharingAnalytics,
    'sharingName': config.sharingName
}
module.exports = configVar;
/**
 * Check if user is blocking open.spotify.com before establishing RPC connection
 * Works only on Linux based systems that use /etc/hosts, if a rule exists, the
 * user will be in loop of ECONNRESET [changed address]:80 or recieve false data.
 **/
function checkHosts(file) {
  if (file.includes("open.spotify.com")) throw new Error("Arr' yer be pirating, please remove \"open.spotify.com\" rule from your hosts file.");
}
if (process.platform !== "win32" && fs.existsSync("/etc/hosts")) {
  checkHosts(fs.readFileSync("/etc/hosts", "utf-8"));
}

const rpc = new Client({ transport: configVar.rpcTransportType }),
      s = new spotifyWeb.SpotifyWebHelper(),
      appClient = configVar.appClientID,
      largeImageKey = configVar.largeImageKey,
      smallImageKey = configVar.smallImageKey,
      smallImagePausedKey = configVar.smallPausedImageKey;

var songEmitter = new events.EventEmitter(),
    currentSong = {};

async function spotifyReconnect () {
  s.getStatus(function(err, res) {
    if (!err) {
      clearInterval(check);
      global.intloop = setInterval(checkSpotify, 200);
    }
  });
}

async function checkSpotify() {
  s.getStatus(function (err, res) {
    if (err) {
      if (err.code === "ECONNREFUSED") {
        if (err.address === "127.0.0.1" && err.port === 4381) {
            /**
             * Temporary workaround - to truly fix this, we need to change spotify.js to check for ports above 4381 to the maximum range.
             * This is usually caused by closing Spotify and reopening before the port stops listening. Waiting about 10 seconds should be
             * sufficient time to reopen the application.
             **/
            log.error("Spotify seems to be closed or unreachable on port 4381! Close Spotify and wait 10 seconds before restarting for this to work. Checking every 5 seconds to check if you've done so.");
            clearInterval(intloop);
            global.check = setInterval(spotifyReconnect, 5000);
	      }
      } else {
          log.error("Failed to fetch Spotify data:", err);
      }
      return;
    }

    if (!res.track.track_resource || !res.track.artist_resource) return;

    if (currentSong.uri && res.track.track_resource.uri == currentSong.uri && (res.playing != currentSong.playing)) {
      currentSong.playing = res.playing;
      currentSong.position = res.playing_position;
      songEmitter.emit('songUpdate', currentSong);
      return;
    }

    if (res.track.track_resource.uri == currentSong.uri) return;

    let start = parseInt(new Date().getTime().toString().substr(0, 10)),
        end = start + (res.track.length - res.playing_position);

    var song = {
      uri: (res.track.track_resource.uri ? res.track.track_resource.uri : ""),
      name: res.track.track_resource.name,
      album: (res.track.album_resource ? res.track.album_resource.name : ""),
      artist: (res.track.artist_resource ? res.track.artist_resource.name : ""),
      playing: res.playing,
      position: res.playing_position,
      length: res.track.length,
      start,
      end
    };
    
    currentSong = song;

    songEmitter.emit('newSong', song);
  });
}

 /**
 * Send Information to api.nations.io
 * newSong: The current song; Spotify URI, name and artist name is sent remotely to api.nations.io for analytics.
 **/

    const updateSpoticordOuterscope = (song) => {
    r.post({
        uri: "https://api.nations.io/v1/outerscope/spotifyAnalytics",
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'spoticord-rev2' },
        json: { uri: song.uri, name: song.name, artist: song.artist }
    });
};

/**
 * Send Information to api.jackkellybayliss.com
 * newSong: The current song; Spotify URI, name and artist name is sent remotely to api.jackkellybayliss.com for analytics.
 **/

    const updateSpoticordAnalytics = (song) => {
        r.post({
            uri: "https://api.jackkellybayliss.com/spotifyAnalytics",
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'mlg-spoticord' },
            json: { uri: song.uri, name: song.name, artist: song.artist, album: song.album, sharingname: configVar.sharingName }
        });
    };

/**
 * Initialise song listeners
 * newSong: gets emitted when the song changes to update the RP
 * songUpdate: currently gets executed when the song gets paused/resumes playing.
 **/
songEmitter.on('newSong', song => {
  rpc.setActivity({
      details: `${configVar.song}  ${song.name}`,
      state: `${configVar.artist}  ${song.artist}`,
    startTimestamp: song.start,
    endTimestamp: song.end,
    largeImageKey,
    smallImageKey,
    largeImageText: `${configVar.largeHover}  ${song.uri}`,
    smallImageText: `${configVar.smallHover}  ${song.album}`,
    instance: false,
  });
  if (configVar.shareAnonAnalytics) updateSpoticordOuterscope(song);
  if (configVar.JKBsharingAnalytics) updateSpoticordAnalytics(song);
  log(`Updated song to: ${song.artist} - ${song.name}`);
});

songEmitter.on('songUpdate', song => {
  let startTimestamp = song.playing ?
    parseInt(new Date().getTime().toString().substr(0, 10)) - song.position :
    undefined,
    endTimestamp = song.playing ?
    startTimestamp + song.length :
    undefined;

  rpc.setActivity({
      details: `${configVar.song}  ${song.name}`,
      state: `${configVar.artist}  ${song.artist}`,
    startTimestamp,
    endTimestamp,
    largeImageKey,
    smallImageKey: startTimestamp ? smallImageKey : smallImagePausedKey,
    largeImageText: `${configVar.largeHover}  ${song.uri}`,
    smallImageText: `${configVar.smallHover}  ${song.album}`,
    instance: false,
  });

  log(`Song state updated (playing: ${song.playing})`)
});

rpc.on('ready', () => {
    WelcomeMessage();
    meme.warn(`Connected to Discord! (${appClient})`);
    meme.mark(` `);
    global.intloop = setInterval(checkSpotify, 200);
});

rpc.login(appClient).catch(log.error);
}