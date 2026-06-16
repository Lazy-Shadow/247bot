require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

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
        const conn = connections[guildId];
        if (!conn) return;
        const botChannelId = conn.connection.joinConfig.channelId;
        const userChannelId = message.member?.voice.channelId;
        if (!userChannelId || userChannelId !== botChannelId) {
            return message.reply('You must be in the same voice channel as the bot to disconnect it.');
        }
        conn.connection.destroy();
        delete connections[guildId];
        message.reply('Disconnected');
    }
});

client.login(process.env.TOKEN);
