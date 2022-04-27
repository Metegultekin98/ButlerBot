console.log('Bot Hazirlaniyor...');

const Discord = require('discord.js');
const client = new Discord.Client();
const DisTube = require('distube');
const StreamLinks = require('./streamlinks.json');
const Authorization = require('./auth.js');
const FileSystem = require('fs');
const { link } = require('ffmpeg-static');
const config = {prefix: "<", token: process.env.token || "dc token here"};

const distube = new DisTube(client, { searchSongs: 0, emitNewSongOnly: true});

client.on('ready', () => {
    console.log(`${client.user.tag} olarak giris yapildi!`);
});



function AddStream(testResult, url, name, message) {
    if(testResult === "success") {
        StreamLinks[name] = url;
        FileSystem.writeFile('./streamLinks.json', JSON.stringify(StreamLinks), err => { });
        message.channel.send(`Added '${url}' to your stream collection as '${name}', master.`);
    }
    else {
        message.channel.send(`I think the link is invaild, master. Maybe you should check it again?`);
    }
}

async function LinkTest(url, message, func, param) {
    const testServer = client.guilds.get(Authorization.getTestServerId);
    const testVC = client.channels.get(Authorization.getTestId);
    if (testServer.me.channel === testVC) {
        return message.send("There is already a test happening. Please try again later, master.");
    }
    var connection = await testVC.join()
    var isSuccess = false;
    const dispatcher = connection.playArbitraryInput(url);
    dispatcher.on('speaking', val => {
        if (val === true) {
            func("success", url, param, message);
            isSuccess = true;
            testVC.leave()
        }
    });
    dispatcher.on('end', () => {
        if (isSuccess === false) {
            func("fail", url, param, message);
            testVC.leave()
        }
    });
}

client.on("message", async (message) => {
    if (message.author.bot) 
        return;
    if (!message.content.startsWith(config.prefix)) 
        return;
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const command = args.shift();

    if (command == "play")
        distube.play(message, args.join(" "));

    if (["repeat", "loop"].includes(command)) {
        distube.setRepeatMode(message, parseInt(args[0]));
        message.channel.send("You want to repeat this song, master? Indeed it is an elegant song.");
    }    

    if (command == "stop") {
        message.member.voice.channel.leave(message);
        distube.stop(message);
        message.channel.send("I stopped the music, master.");
    }

    if (command == "skip") {
        distube.skip(message);
        message.channel.send("Perhaps this song didn't match your taste? Let me skip it for you, master.");
    }    

    if (command == "queue") {
        let queue = distube.getQueue(message);
        message.channel.send('Current queue:\n' + queue.songs.map((song, id) =>
            `**${id + 1}**. ${song.name} - \`${song.formattedDuration}\``
        ).slice(0, 10).join("\n"));
    }

    if (command == "pause") {
        distube.pause(message);
        message.channel.send("I paused the music, master. Perhaps you want to resume later?")
    }

    if(command == "resume") {
        distube.resume(message);
        message.channel.send("Are in a mood to continue your music, master? Let me resume the music for you.");
    }

    if (command == "autoplay") {
        let mode = distube.toggleAutoplay(message);
        message.channel.send("Autoplay has been set to `" + (mode ? "On" : "Off") + "`, master.");
    }
    
    if (command == "volume") {
        let queue = distube.setVolume(message, args[0]);
        message.channel.send(`Volume of the music has been set to\`${queue.volume}%\`, master.`);
    }
    
    if (command == "shuffle") {
        distube.shuffle(message);
        message.channel.send("Oh! Do want to be surprised a little bit then let me shuffle the queue for you, master.");
    }
    
    if(command == "add") {
        if(typeof args[2] === 'undefined' || typeof link === 'undefined') {
            return message.channel.send("Please provide both a link and a name to add to your radio collection, master");
        }
        if (Object.values(StreamLinks).includes(link)) {
            return message.channel.send(`This link already exists under your radio collection with name '${Object.keys(StreamLinks).find(key => StreamLinks[key] === link)}', master.`);
        }
        if (typeof StreamLinks[args[2]] !== 'undefined') {
            return message.channel.send("Provided name already has a link that is saved in your collection, master.")
        }
        message.channel.send("Validating the stream link. Just a minute, master...").then(message => {
            LinkTest(link, message, AddStream, args[2]);
        })
    }
    if(command == "radio") {
        var musicType = args[0].trim();
        var link = args[1];
        if (musicType === 'link') {
            if (message.member.voice.channel) {
                message.member.voice.channel.join()
                    .then(connection => {
                        try {
                            const dispatcher = connection.play(link);
                            return message.channel.send(`Started playing music on ${link}, master.`);
                        } catch (error) {
                            return message.reply(`Could not resolve the stream on link, master.`);
                        }

                    })
                    .catch(console.log);
            } else {
                message.reply('You need to join a voice channel, master.');
            }
        }
        else if (message.member.voice.channel) {
            message.member.voice.channel.join()
                .then(connection => { 
                    try {
                        const dispatcher = connection.play(StreamLinks[musicType]);
                        dispatcher.on('error', err => { console.log(err.message) })
                        return message.reply(`Started playing ${musicType} stream, master.`);
                    } catch (error) {
                        return message.reply(`That radio type still isn't at your collection, master. These are available music types: ${Object.keys(StreamLinks)}`);
                    }

                })
                .catch(console.log);
        } else {
            message.reply('You need to join a voice channel, master.');
        }
    }
});

const status = (queue) => `Volume: \`${queue.volume}%\` | Loop: \`${queue.repeatMode ? queue.repeatMode == 2 ? "All Queue" : "This Song" : "Off"}\` | Autoplay: \`${queue.autoplay ? "On" : "Off"}\``;

distube
    .on("playSong", (message, queue, song) =>  message.channel.send(
        `Playing \`${song.name}\` - \`${song.formattedDuration}\`, master.\n${status(queue)}`
    ))
    .on("addSong", (message, queue, song) => message.channel.send(
        `${song.name} - \`${song.formattedDuration}\` has been added to the queue, master. As you requested it.\n${status(queue)}`
    ))
    .on("playList", (message, queue, playlist, song) => message.channel.send(
        `Play \`${playlist.name}\` playlist (${playlist.songs.length} songs).\nNow playing \`${song.name}\` - \`${song.formattedDuration}\`, master.\n${status(queue)}`
    ))
    .on("addList", (message, queue, playlist) => message.channel.send(
        `Added \`${playlist.name}\` playlist (${playlist.songs.length} songs) to queue, master.\n${status(queue)}`
    ));

client.login(config.token);