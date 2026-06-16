require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { Readable } = require('stream');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

const PREFIX = '.';
const connections = {};
const processed = new Set();

client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX) || processed.has(message.id)) return;
    processed.add(message.id);

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'vcjn') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('You must be in a voice channel!');

        const guildId = voiceChannel.guild.id;

        if (connections[guildId]) {
            connections[guildId].connection.destroy();
        }

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        const opusSilence = Buffer.from([0xFC, 0xFF, 0xFE]);
        const stream = new Readable({
            read() {
                this.push(opusSilence);
            }
        });
        const resource = createAudioResource(stream, { inputType: 'opus' });
        player.play(resource);

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signing, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch {
                connection.destroy();
                delete connections[guildId];
            }
        });

        connections[guildId] = { connection, player };
        message.reply(`Joined **${voiceChannel.name}**`);
    }

    if (command === 'dcn') {
        const guildId = message.guild.id;
        if (connections[guildId]) {
            connections[guildId].connection.destroy();
            delete connections[guildId];
            message.reply('Disconnected');
        }
    }
});

client.login(process.env.TOKEN);
