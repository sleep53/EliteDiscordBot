import fs from 'fs';
import { Client, Intents, Collection, ApplicationCommandDataResolvable, ApplicationCommandData } from 'discord.js';
import * as config from './config.json';
import { Command } from './classes/Command';
import DataHandler from './classes/Database';

const proccessArgs = process.argv.slice(2);

export const client = new Client({ 
	intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES],
	partials: ['CHANNEL']
});

export const commands = new Collection<string, Command>();

/* 
* There is surely a better way to load these, but this is fine for now
* as it only runs once on startup and allows you to only create a new file.
*/
(async function() {
	const filter = (fileName: string) => fileName.endsWith('.ts');

	const commandFiles = fs.readdirSync('./commands/').filter(filter);

	for (const file of commandFiles) {
		const command = await import(`./commands/${file}`);
		commands.set(command.default.name, command.default);
	}

	const buttonFiles = fs.readdirSync('./buttons/').filter(filter);

	for (const file of buttonFiles) {
		const command = await import(`./buttons/${file}`);
		commands.set(command.default.name, command.default);
	}
	
	const eventFiles = fs.readdirSync('./events/').filter(filter);
	
	for (const file of eventFiles) {
		const event = await import(`./events/${file}`);
		client.on(file.split('.')[0], event.default);
	}
}()); 


client.once('ready', async () => {
	if (client.user) {
		client.user.setActivity('skyblock players', { type: 'WATCHING' });
	}

	DataHandler.syncTables();

	console.log('Ready!');
	
	if (proccessArgs[0] === 'deploy') {
		console.log('Deploying slash commands...');
		deploySlashCommands();
	}
});

client.login(config.token);

process.on('unhandledRejection', (reason, p) => {
	console.error(reason, 'Unhandled Rejection at Promise', p);
}).on('uncaughtException', err => {
	console.error(err, 'Uncaught Exception thrown');
	process.exit(1);
});

/*
*  ===================================================================
*	Command arguments on startup of script to do one-time operations
*
*		"deploy global" 	 - updates slash commands globally
*		"deploy <server id>" - updates slash commands in that server
*		Append "clear" to remove slash commands from a server
*  ===================================================================
*/

function deploySlashCommands() {
	const slashCommandsData: ApplicationCommandData[] = [];

	for (const [, command ] of commands) {
		if (command.type === 'AUTOCOMPLETE' || command.type === 'BUTTON') continue;

		if (command.slash) slashCommandsData.push(command.slash);
	}

	if (proccessArgs[1] === 'global') {
		setTimeout(async function() {
			await client.application?.commands.set([]);
			await client.application?.commands.set(slashCommandsData as ApplicationCommandDataResolvable[]);
			console.log('Probably updated slash commands globally');
		}, 3000);
	} else if (proccessArgs[1]) {
		setTimeout(async function() {
			const guild = await client.guilds.fetch('' + proccessArgs[1]);
			const guildCommands = guild.commands;
			if (proccessArgs[2] !== 'clear') {
				guildCommands.set(slashCommandsData as ApplicationCommandDataResolvable[]);
			} else {
				guildCommands.set([]);
			}
			console.log('Probably updated slash commands on that server');
		}, 3000);
	}
}
