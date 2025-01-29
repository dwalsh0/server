#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const axios = require('axios');
const inquirer = require('inquirer');
const inquirerAutocomplete = require('inquirer-autocomplete-prompt');
inquirer.registerPrompt('autocomplete', inquirerAutocomplete);
const { spawn, execSync } = require('child_process');
const chalk = require('chalk');

/**
 * Fetch servers from Vultr
 */
async function getVultrServers() {
  try {
    const response = await axios.get('https://api.vultr.com/v2/instances', {
      headers: {
        Authorization: `Bearer ${process.env.VULTR_API_KEY}`,
      },
    });

    const instances = response.data.instances || [];
    return instances.map((instance) => ({
      provider: 'vultr',
      id: instance.id,
      name: instance.label || `Vultr-${instance.id}`, // Fallback if label is not set
      ip: instance.main_ip,
      tags: instance.tags || [], /
    }));
  } catch (error) {
    console.error('Error fetching Vultr servers:', error.message);
    return [];
  }
}

/**
 * Fetch servers from BinaryLane
 */
async function getBinarylaneServers() {
  try {
    const response = await axios.get('https://api.binarylane.com.au/v2/servers', {
      headers: {
        Authorization: `Bearer ${process.env.BINARYLANE_API_KEY}`,
      },
    });

    const servers = response.data.servers || [];
    return servers.map((server) => ({
      provider: 'binarylane',
      id: server.id,
      name: server.name || `BL-Server-${server.id}`,
      ip: server.networks?.v4?.[0]?.ip_address || null,
    }));
  } catch (error) {
    console.error('Error fetching BinaryLane servers:', error.message);
    return [];
  }
}

/**
 * Prompt user to pick a server
 */
async function promptForServer(servers) {
  // Combine name and IP in a nice display format
  const choices = servers.map((server) => {
    const providerColor = server.provider === 'vultr' ? 'cyan' : 'magenta';
    // Add tags display for Vultr servers
    const tagsDisplay = server.provider === 'vultr' && server.tags?.length > 0 
      ? ` ${chalk.gray('{')}${chalk.blue(server.tags.join(', '))}${chalk.gray('}')}` 
      : '';
    return {
      name: `${chalk.green(server.name)} ${chalk.gray('(')}${chalk.yellow(server.ip)}${chalk.gray(')')} ${chalk.gray('[')}${chalk[providerColor](server.provider)}${chalk.gray(']')}${tagsDisplay}`,
      value: server,
      searchValue: `${server.name} ${server.ip} ${server.provider} ${server.tags?.join(' ')}`.toLowerCase(), // Add searchable text
    };
  });

  // Add a cancel option at the end
  choices.push({
    name: chalk.red('Cancel'),
    value: null,
    searchValue: 'cancel'
  });

  const { selectedServer } = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'selectedServer',
      message: chalk.blue('Search and select a server (or Cancel to exit):'),
      choices,
      pageSize: 20,
      source: (answers, input = '') => {
        return new Promise((resolve) => {
          const filtered = choices.filter(choice => 
            !input || choice.searchValue.includes(input.toLowerCase())
          );
          resolve(filtered);
        });
      }
    },
  ]);

  return selectedServer;
}

/**
 * Get the SSH port configuration file path
 */
function getPortConfigPath() {
  return path.join(os.homedir(), '.ssh_ports.json');
}

/**
 * Load saved port configurations
 */
function loadPortConfigs() {
  try {
    const configPath = getPortConfigPath();
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.error(chalk.red('Error loading port configurations:'), error.message);
  }
  return {};
}

/**
 * Save port configuration for a server
 */
function savePortConfig(ip, port) {
  try {
    const configPath = getPortConfigPath();
    const configs = loadPortConfigs();
    configs[ip] = port;
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
  } catch (error) {
    console.error(chalk.red('Error saving port configuration:'), error.message);
  }
}

/**
 * Spawns an SSH session in the current terminal
 */
function sshIntoServer(ipAddress, sshUser = 'root') {
  const portConfigs = loadPortConfigs();
  const defaultPort = 22;
  let port = portConfigs[ipAddress] || defaultPort;

  const trySSHConnection = async (port) => {
    console.log(`\n${chalk.blue('Attempting SSH into')} ${chalk.green(`${sshUser}@${ipAddress}`)} ${chalk.gray(`on port ${port}`)}...`);
    console.log(chalk.gray('(Use Ctrl+D or type "exit" to disconnect)\n'));

    const sshProcess = spawn('ssh', ['-p', port, `${sshUser}@${ipAddress}`], { stdio: 'inherit' });

    return new Promise((resolve) => {
      sshProcess.on('error', (err) => {
        console.error(chalk.red('Failed to start SSH process:'), err);
        resolve(false);
      });

      sshProcess.on('close', (code) => {
        // Connection refused or other connection errors typically return code 255
        if (code === 255) {
          resolve(false);
        } else {
          // Any other code (including 0 and 1) is considered a successful connection
          // that was later terminated
          console.log(chalk.green('SSH session ended.'));
          resolve(true);
        }
      });
    });
  };

  const promptForPort = async () => {
    const { newPort } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newPort',
        message: chalk.yellow('Enter the SSH port number:'),
        default: String(defaultPort),
        validate: (input) => {
          const port = parseInt(input);
          return port > 0 && port < 65536 ? true : 'Please enter a valid port number (1-65535)';
        },
      },
    ]);
    return parseInt(newPort);
  };

  (async () => {
    let success = await trySSHConnection(port);
    
    if (!success) {
      console.log(chalk.yellow('\nConnection failed. The server might be using a different port.'));
      port = await promptForPort();
      success = await trySSHConnection(port);
      
      if (success) {
        // Save the successful port configuration
        savePortConfig(ipAddress, port);
        console.log(chalk.green(`Port ${port} has been saved for future connections to ${ipAddress}`));
      }
    }
  })();
}

/**
 * Ensures ssh-agent is running and key is added
 */
function setupSSHAgent() {
  try {
    // Check if ssh-agent is running
    try {
      execSync('ssh-add -l', { stdio: 'ignore' });
    } catch (error) {
      // If ssh-agent isn't running, this will throw an error
      console.log(chalk.blue('Starting ssh-agent...'));
      execSync('eval "$(ssh-agent -s)"', { shell: true });
    }

    // Try to add the default SSH key if it exists
    try {
      execSync('ssh-add -l', { stdio: 'ignore' });
    } catch (error) {
      console.log(chalk.blue('Adding SSH key...'));
      execSync('ssh-add', { stdio: 'inherit' });
    }
  } catch (error) {
    console.error(chalk.red('Error setting up SSH agent:'), error.message);
  }
}

/**
 * Main CLI flow
 */
async function main() {
  // Setup SSH agent before doing anything else
  setupSSHAgent();

  // 1. Fetch all servers
  const [vultrServers, blServers] = await Promise.all([
    getVultrServers(),
    getBinarylaneServers(),
  ]);

  // 2. Combine into one array
  const allServers = [...vultrServers, ...blServers].filter((s) => s.ip);

  if (allServers.length === 0) {
    console.log(chalk.red('No servers found from either Vultr or BinaryLane.'));
    return;
  }

  // 3. Prompt user to select a server
  const selectedServer = await promptForServer(allServers);

  // Exit if user selected Cancel
  if (!selectedServer) {
    console.log(chalk.yellow('Operation cancelled'));
    return;
  }

  // 4. SSH into the selected server
  //    Customize the default SSH user if needed (e.g. "ubuntu" or "root")
  sshIntoServer(selectedServer.ip, 'root');
}

// Run the script if executed from the command line
if (require.main === module) {
  main();
}
