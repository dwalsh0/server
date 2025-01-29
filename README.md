# Cloud Server SSH Manager

A command-line tool that provides an interactive way to connect to your cloud servers hosted on Vultr and BinaryLane. The tool features a searchable server list with color-coded output and automatic SSH port detection.

## Features

- 🔍 Interactive search across all your cloud servers
- 🎨 Color-coded server listings for easy identification
- 🏷️ Display of Vultr server tags
- 🔐 Automatic SSH agent setup and key management
- 🚪 Smart SSH port detection and persistence
- 🔄 Supports multiple cloud providers (Vultr and BinaryLane)

## Prerequisites

- Node.js installed on your system
- SSH client installed (We test this on Mac OSX)
- API keys for your cloud providers
- SSH key pair configured for your servers

## Installation

1. Clone this repository
2. Install dependencies:
3. Create a `.env` file in the project root with your API keys:
VULTR_API_KEY=your_vultr_api_key_here
BINARYLANE_API_KEY=your_binarylane_api_key_here
4. Make the package globally accessible:
sudo npm link
After linking the package, you can run it from anywhere using:

server

## How It Works

1. The script fetches servers from both Vultr and BinaryLane APIs
2. Displays an interactive, searchable list of all your servers
3. Shows server details including:
   - Server name
   - IP address
   - Provider (color-coded: cyan for Vultr, magenta for BinaryLane)
   - Tags (for Vultr servers)
4. Automatically handles SSH connection with:
   - SSH agent setup
   - Key management
   - Port detection and persistence
   - Custom port configuration

## SSH Port Configuration

The tool automatically saves successful SSH port configurations to `~/.ssh_ports.json` for future connections. If a connection fails on the default port (22), it will prompt for an alternative port and save it for subsequent connections.

## Features in Detail

### Server Search
- Fuzzy search through server names, IPs, providers, and tags
- Real-time filtering as you type
- Supports keyboard navigation

### Visual Formatting
- Color-coded provider names
- Clear separation between server details
- Tag display for Vultr servers
- Status messages in appropriate colors

### SSH Management
- Automatic SSH agent startup
- SSH key addition if needed
- Graceful handling of connection failures
- Custom port management

## Error Handling

The tool includes comprehensive error handling for:
- API connection failures
- SSH connection issues
- Configuration file access
- Invalid port numbers
- SSH agent setup problems

## Contributing

Feel free to submit issues and enhancement requests!

