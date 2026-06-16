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

client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

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

        const silence = Buffer.alloc(3840, 0);
        const stream = new Readable({
            read() {
                this.push(silence);
            }
        });
        const resource = createAudioResource(stream, { inputType: 'raw' });
        player.play(resource);

        player.on(AudioPlayerStatus.Idle, () => {
            const s = Buffer.alloc(3840, 0);
            const st = new Readable({
                read() {
                    this.push(s);
                }
            });
            player.play(createAudioResource(st, { inputType: 'raw' }));
        });

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

    if (command === 'dc') {
        const guildId = message.guild.id;
        if (connections[guildId]) {
            connections[guildId].connection.destroy();
            delete connections[guildId];
            message.reply('Disconnected');
        } else {
            message.reply('Not in a voice channel.');
        }
    }
});

client.login(process.env.TOKEN);
