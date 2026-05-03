// INSTALL:
// npm init -y
// npm install discord.js dotenv

require('dotenv').config();
console.log('ENV token loaded:', process.env.TOKEN ? 'yes' : 'no');
const { Client, GatewayIntentBits, Partials, PermissionsBitField, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message]
});

let prefix = '+';

// Stockage simple (remplace par DB en prod)
const owners = new Set();
const blacklist = new Set();
const warns = new Map();
const mutes = new Set();
const snipes = new Map();

client.on('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
});

client.on('error', (error) => console.error('Discord client error:', error));
client.on('warn', (warning) => console.warn('Discord warning:', warning));
client.on('invalidated', () => console.error('Discord session invalidated'));

function isOwner(userId) {
  return owners.has(userId);
}

client.on('messageDelete', (message) => {
  if (!message.channel || !message.guild) return;
  snipes.set(message.channel.id, {
    content: message.content || '[message supprimé]',
    author: message.author ? message.author.tag : 'Utilisateur inconnu',
    authorId: message.author ? message.author.id : null,
    createdAt: message.createdAt,
    attachment: message.attachments.first()?.url || null
  });
});

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // OWNER
  if (cmd === 'owner') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention un membre');
    owners.add(user.id);
    message.reply('Ajouté owner');
  }

  if (cmd === 'unowner') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention un membre');
    owners.delete(user.id);
    message.reply('Retiré owner');
  }

  // BLACKLIST
  if (cmd === 'bl') {
    const user = message.mentions.users.first();
    blacklist.add(user.id);
    message.reply('Ajouté à la blacklist');
  }

  if (cmd === 'unbl') {
    const user = message.mentions.users.first();
    blacklist.delete(user.id);
    message.reply('Retiré de la blacklist');
  }

  if (blacklist.has(message.author.id)) return;

  // BAN
  if (cmd === 'ban') {
    const member = message.mentions.members.first();
    member.ban();
    message.reply('Banni');
  }

  if (cmd === 'unban') {
    const id = args[0];
    await message.guild.members.unban(id);
    message.reply('Débanni');
  }

  // ROLE
  if (cmd === 'addrole') {
    const member = message.mentions.members.first();
    const role = message.mentions.roles.first();
    member.roles.add(role);
    message.reply('Rôle ajouté');
  }

  if (cmd === 'delrole') {
    const member = message.mentions.members.first();
    const role = message.mentions.roles.first();
    member.roles.remove(role);
    message.reply('Rôle retiré');
  }

  // MUTE
  if (cmd === 'mute') {
    const member = message.mentions.members.first();
    mutes.add(member.id);
    member.timeout(10 * 60 * 1000);
    message.reply('Muté');
  }

  if (cmd === 'unmute') {
    const member = message.mentions.members.first();
    mutes.delete(member.id);
    member.timeout(null);
    message.reply('Démuté');
  }

  // WARN
  if (cmd === 'warn') {
    const member = message.mentions.members.first();
    const userWarns = warns.get(member.id) || [];
    userWarns.push('warn');
    warns.set(member.id, userWarns);
    message.reply('Warn ajouté');
  }

  if (cmd === 'warnlist') {
    const list = [...warns.entries()].map(([id, w]) => `${id}: ${w.length}`).join('\n');
    message.reply(list || 'Aucun warn');
  }

  if (cmd === 'clearwarns') {
    const member = message.mentions.members.first();
    warns.delete(member.id);
    message.reply('Warns supprimés');
  }

  // LOCK / UNLOCK
  if (cmd === 'lock') {
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: false
    });
    message.reply('Salon verrouillé');
  }

  if (cmd === 'unlock') {
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: true
    });
    message.reply('Salon déverrouillé');
  }

  // CLEAR
  if (cmd === 'clear') {
    const amount = parseInt(args[0]);
    await message.channel.bulkDelete(amount, true);
    message.reply('Messages supprimés');
  }

  // VOICE MOVE
  if (cmd === 'voicemove') {
    const member = message.mentions.members.first();
    const channel = message.member.voice.channel;
    member.voice.setChannel(channel);
    message.reply('Déplacé');
  }

  // FUN
  if (cmd === 'say') {
    message.channel.send(args.join(' '));
  }

  if (cmd === 'mp') {
    const user = message.mentions.users.first();
    user.send(args.slice(1).join(' '));
  }

  if (cmd === 'banner') {
    const user = message.mentions.users.first() || message.author;
    const banner = await user.fetch();
    message.reply(banner.bannerURL() || 'Pas de bannière');
  }

  if (cmd === 'pic') {
    const user = message.mentions.users.first() || message.author;
    message.reply(user.displayAvatarURL({ size: 512 }));
  }

  if (cmd === 'snipe') {
    const snipe = snipes.get(message.channel.id);
    if (!snipe) return message.reply('Rien à snipe dans ce salon.');

    const snipeEmbed = new EmbedBuilder()
      .setTitle('Snipe')
      .setColor(0xFAA61A)
      .setDescription(snipe.content)
      .addFields(
        { name: 'Auteur', value: snipe.author, inline: true },
        { name: 'Salon', value: `${message.channel}`, inline: true }
      )
      .setFooter({ text: 'Dernier message supprimé dans ce salon' });

    if (snipe.attachment) snipeEmbed.setImage(snipe.attachment);
    return message.reply({ embeds: [snipeEmbed] });
  }

  if (cmd === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('Help - Accueil')
      .setDescription('Bienvenue dans le menu d’aide. Utilisez la sélection ci-dessous pour voir les commandes par catégorie.')
      .setColor(0x5865F2)
      .addFields({ name: 'Prefix', value: `\`${prefix}\``, inline: true });

    const helpRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help-menu')
        .setPlaceholder('Choisis une catégorie')
        .addOptions([
          { label: 'Accueil', value: 'home', description: 'Présentation du bot' },
          { label: 'Modération', value: 'moderation', description: 'Commandes de modération' },
          { label: 'Rôles & Salon', value: 'roles', description: 'Gestion des rôles et salons' },
          { label: 'Fun', value: 'fun', description: 'Commandes fun et utilitaires' }
        ])
    );

    return message.reply({ embeds: [helpEmbed], components: [helpRow] });
  }

  // PREFIX
  if (cmd === 'prefix') {
    prefix = args[0];
    message.reply(`Nouveau prefix: ${prefix}`);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'help-menu') return;

  const category = interaction.values[0];
  let embed;

  if (category === 'home') {
    embed = new EmbedBuilder()
      .setTitle('Help - Accueil')
      .setDescription('Bienvenue dans le menu d’aide. Sélectionne une catégorie pour voir les commandes correspondantes.')
      .setColor(0x5865F2)
      .addFields({ name: 'Prefix', value: `\`${prefix}\``, inline: true });
  } else if (category === 'moderation') {
    embed = new EmbedBuilder()
      .setTitle('Help - Modération')
      .setColor(0xED4245)
      .setDescription('Commandes de modération disponibles')
      .addFields(
        { name: 'ban', value: `\`${prefix}ban @membre\``, inline: true },
        { name: 'unban', value: `\`${prefix}unban <id>\``, inline: true },
        { name: 'mute', value: `\`${prefix}mute @membre\``, inline: true },
        { name: 'unmute', value: `\`${prefix}unmute @membre\``, inline: true },
        { name: 'warn', value: `\`${prefix}warn @membre\``, inline: true },
        { name: 'warnlist', value: `\`${prefix}warnlist\``, inline: true },
        { name: 'clearwarns', value: `\`${prefix}clearwarns @membre\``, inline: true },
        { name: 'snipe', value: `\`${prefix}snipe\``, inline: true }
      );
  } else if (category === 'roles') {
    embed = new EmbedBuilder()
      .setTitle('Help - Rôles & Salon')
      .setColor(0x57F287)
      .setDescription('Commandes de gestion des rôles et des salons')
      .addFields(
        { name: 'addrole', value: `\`${prefix}addrole @membre @role\``, inline: true },
        { name: 'delrole', value: `\`${prefix}delrole @membre @role\``, inline: true },
        { name: 'lock', value: `\`${prefix}lock\``, inline: true },
        { name: 'unlock', value: `\`${prefix}unlock\``, inline: true },
        { name: 'clear', value: `\`${prefix}clear <nombre>\``, inline: true },
        { name: 'voicemove', value: `\`${prefix}voicemove @membre\``, inline: true }
      );
  } else if (category === 'fun') {
    embed = new EmbedBuilder()
      .setTitle('Help - Fun')
      .setColor(0x5865F2)
      .setDescription('Commandes fun et utilitaires')
      .addFields(
        { name: 'say', value: `\`${prefix}say <texte>\``, inline: true },
        { name: 'mp', value: `\`${prefix}mp @membre <texte>\``, inline: true },
        { name: 'banner', value: `\`${prefix}banner [@membre]\``, inline: true },
        { name: 'pic', value: `\`${prefix}pic [@membre]\``, inline: true },
        { name: 'prefix', value: `\`${prefix}prefix <nouveau_prefix>\``, inline: true }
      );
  }

  await interaction.update({ embeds: [embed] });
});

client.login(process.env.TOKEN).catch((error) => console.error('Login failed:', error));

// .env file:
// TOKEN=TON_TOKEN_ICI
