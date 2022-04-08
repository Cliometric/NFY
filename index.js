const fs = require("fs");
const discordRPC = require('discord-rpc');
const rpc = new discordRPC.Client({ transport: 'ipc' });
const path = require('path');
const EventEmitter = require("events");

const playlist = require("./playlist.js");

const clientId = '961150717748445245';
discordRPC.register(clientId);

const throttle = (func, limit) => {
    let lastFunc
    let lastRan
    return function() {
        const context = this
        const args = arguments
        if (!lastRan) {
            func.apply(context, args)
            lastRan = Date.now()
        } else {
            clearTimeout(lastFunc)
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args)
                    lastRan = Date.now()
                }
            }, limit - (Date.now() - lastRan))
        }
    }
}

const client = new EventEmitter();

var PLAYING = false;
var IN_PLAYLIST = false; //;
var LOOPING = false

let songBuffer = null; // rip

var i = 0;
var max = 0;

function parse_time(t_in_seconds) {
    let time = t_in_seconds;
    let _t = "";
    var minutes = ~~((time % 3600) / 60);;
    var seconds = parseInt(time % 60);
    if (seconds == NaN) { seconds = 0 }
    let secs = ""

    _t += parseInt(minutes.toString()) + ":";

    if (seconds < 10) {
        secs += "0";
    }

    secs += seconds.toString();

    if (secs == NaN) {
        secs = "00";
    }

    _t += secs;


    return _t;
}

setTimeout(function() {

    var play_button = document.getElementById("play_button");
    var Songs = null;

    if (!fs.existsSync("./songs/")) {
        fs.mkdirSync("./songs/");
    }
    Songs = fs.readdirSync("./songs")



    function PlayMusicWrap() {
        songBuffer = null;
        client.emit("playMusic");
    }

    var nfyPlaylist = new playlist(Songs, function(newIndex) {

        if (nfyPlaylist.getCurrentSong() !== null || nfyPlaylist.getCurrentSong() !== undefined) { // hmm,
            if (songBuffer !== null) {
                songBuffer = null;
                PlayMusicWrap();
            }
        } else {
            nfyPlaylist.setIndex(0);
            songBuffer = null;
            PlayMusicWrap();
        }

    });
    client.on('MovePlaylist', () => {
        if (nfyPlaylist.peekNext() === null) {
            nfyPlaylist.setIndex(0)
            songBuffer = null
            client.emit('playMusic')
        }
        if (songBuffer !== null) {
            songBuffer.pause();
            PLAYING = false;
            play_button.innerText = "play"
        }
        songBuffer = null
        if (nfyPlaylist.peekNext() !== null || nfyPlaylist.peekNext() !== undefined) {
            if (nfyPlaylist.peekNext() === undefined || nfyPlaylist.peekNext() === null) {
                nfyPlaylist.setIndex(0);
                songBuffer = null;
                client.emit("playMusic")
            } else {
                nfyPlaylist.moveByOne();
                songBuffer = null;
                client.emit('playMusic');
            }
        } else {

            nfyPlaylist.setIndex(0);
            songBuffer = null;
            client.emit('playMusic');
        }


    })



    client.on('playMusic', () => {

        if (nfyPlaylist.getCurrentSong() == null) {
            nfyPlaylist.setIndex(0);
            songBuffer = null
            client.emit('playMusic')
        }

        let song = `./songs/${nfyPlaylist.getCurrentSong()}`;

        var song_name_element = document.getElementById("song_name");
        var song_nameWE = path.parse(path.basename(song)).name;

        song_name_element.innerText = song_nameWE;

        if (songBuffer !== null && PLAYING) songBuffer.pause();
        // ye that's it
        fs.exists(song, () => {
            if (!PLAYING) {

                if (songBuffer == null) {
                    songBuffer = new Audio(song);

                    songBuffer.play();

                    PLAYING = true
                    play_button.innerText = "stop";
                } else {
                    if (songBuffer != null) {
                        songBuffer.play();
                        play_button.innerText = "stop";
                    }

                    PLAYING = true;
                }

                songBuffer.addEventListener('timeupdate', function() {
                    let p = document.getElementById("time_handler");
                    if (nfyPlaylist.getCurrentSong() === null) {
                        nfyPlaylist.setIndex(0);
                        PlayMusicWrap();
                    }
                    if (songBuffer) {
                        let time = parse_time(songBuffer.currentTime) + " - " + parse_time(songBuffer.duration);

                        p.innerText = time;
                        rpc.setActivity({
                            details: `${song_nameWE}`,
                            state: time,
                            largeImageKey: 'real'
                        })
                    }
                });



                songBuffer.onended = function() {
                    if (LOOPING) {
                        songBuffer.play();
                    } else if (nfyPlaylist.nextExists()) {

                        nfyPlaylist.moveByOne();

                        songBuffer = null;

                        PlayMusicWrap();
                        l.innerText = "loop";
                    }
                }


            } else {

                PLAYING = false;
                if (songBuffer != null) {
                    songBuffer.pause();
                    play_button.innerText = "play";
                    rpc.setActivity({
                        details: 'Idle',
                        largeImageKey: 'real'
                    })
                } else {
                    // songBuffer.pause();
                }

            }
        })
    })

    client.on('loopClicked', () => {
        let l = document.getElementById("loop_button");
        if (LOOPING === true) {
            LOOPING = false;
            l.innerText = "loop";
        } else {
            LOOPING = true;
            l.innerText = "unloop";
        }
    })

    client.on('openDir', () => { //
        require('child_process').exec('start "" ".\\songs"');
        if (fs.existsSync("./songs/")) { require('child_process').exec('start "" ".\\songs"'); } else {
            fs.mkdirSync("./songs/");
            require('child_process').exec('start "" ".\\"');
        }
    })

}, 0);

rpc.login({ clientId });