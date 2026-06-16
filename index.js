require('dotenv').config();
const { Client, GatewayIntentBits, Events, PermissionsBitField } = require('discord.js');
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
const ADMIN_USERS = ['754329330602999968'];
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
        const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!ADMIN_USERS.includes(message.author.id) && !isAdmin) {
            return message.reply('You do not have permission to use this command.');
        }
        const guildId = message.guild.id;
        if (connections[guildId]) {
            connections[guildId].connection.destroy();
            delete connections[guildId];
            message.reply('Disconnected');
        }
    }
});

client.login(process.env.TOKEN);
