# PlayerRoutes Web

Real-time 2D map viewer for the PlayerRoutes Minecraft mod. Track player movements across Overworld, Nether, and End dimensions.

![PlayerRoutes Web](https://img.shields.io/badge/Next.js-15-black) ![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Features

### Interactive Map
- **Canvas-based Rendering**: Smooth pan, zoom, and navigation
- **Auto-rendered Tiles**: Chunks rendered as PNG tiles by the mod
- **Multi-dimension Support**: Switch between Overworld, Nether, and End
- **Smart Tile Loading**: Only loads tiles within explored world bounds
- **Grid Overlay**: Coordinate grid with adaptive density based on zoom level
- **Double-click to Center**: Quick navigation to any point

### Player Tracking
- **Real-time Updates**: Live position updates via WebSocket
- **Player Markers**: Colored dots for each online player with names
- **Route Visualization**: View player movement paths (shown when player is selected)
- **Click-to-Follow**: Click a player to center map and show their route
- **Dimension Badges**: See how many players are in each dimension

### Session History
- **Historical Sessions**: Browse past player sessions
- **Session Statistics**: Distance traveled, duration, points recorded
- **Offline Player Routes**: Optionally show routes from offline players

### Teleport System
- **Teleport to Player**: Select target from dropdown menu
- **Teleport to Coordinates**: Enter X, Y, Z manually
- **Command Preview**: See the exact `/tp` command before executing
- **Copy or Execute**: Copy command to clipboard or execute directly via mod
- **Visual Feedback**: Success/error messages after execution

### Display Customization
- **Route Width**: Adjust line thickness (1-10px)
- **Route Opacity**: Control transparency (10-100%)
- **Route Color**: 9 preset colors + custom color picker
- **Marker Size**: Player dot size (3-15px)
- **Glow Effect**: Outer glow around markers (0-20px)
- **Label Size**: Player name font size (8-18px)
- **Toggle Labels**: Show/hide player names
- **Toggle Offline Paths**: Show/hide inactive session routes
- **Persistent Settings**: All settings saved to localStorage

### World Info
- **World Time**: Current Minecraft time with day/night indicator
- **Mouse Coordinates**: Real-time X, Z position under cursor
- **Connection Status**: Visual indicator with reconnect option

### Map Controls
| Control | Action |
|---------|--------|
| Scroll | Zoom in/out |
| Drag | Pan the map |
| Double-click | Center on position |
| `+` / `-` | Zoom buttons |
| `O` | Fit entire explored map in view |
| `P` | Center on active player (4x zoom) |
| `R` | Refresh map tiles |
| Sliders icon | Open display settings |

## Requirements

- The web app **must run on the same server** as the Minecraft mod
- Node.js 18+
- PlayerRoutes mod installed and running

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure (optional)

Create `.env.local` if you need to customize the data directory:

```env
# Path to mod's data directory (default: ../playerroutes-mod/playerroutes-data)
JSON_STORAGE_DIR=/path/to/minecraft-server/playerroutes-data
```

### 3. Run

```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

### 4. Connect

1. Open `http://your-server:3000` in your browser
2. Enter your admin token (configured in `playerroutes-server.toml` of the mod)
3. The web app auto-detects the WebSocket URL based on your browser's hostname

## Authentication

Authentication is handled by the **Minecraft mod's WebSocket**, not the web app.

- The token you enter must match the one in `playerroutes-server.toml`
- The web validates by attempting to connect to the mod's WebSocket
- If the mod accepts the connection, you're authenticated
- No need to configure tokens in `.env.local`

## Architecture

```
Browser ──WebSocket──> Minecraft Mod (port 8765)
   │                        │
   │                        ├── Real-time player positions
   │                        ├── Session start/end events
   │                        └── Teleport commands
   │
   └──HTTP──> Next.js Web (port 3000)
                   │
                   ├── /api/tiles     → Serves map tile images
                   ├── /api/sessions  → Lists historical sessions
                   └── /api/players   → Lists players
```

**Important**: The web app reads tile images and session data from the local filesystem. This is why both must run on the same server.

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main application
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── api/
│       ├── players/          # Player list API
│       ├── sessions/         # Session history API
│       └── tiles/            # Tile image serving
├── components/
│   ├── AuthGate.tsx          # Login & authentication
│   ├── MapCanvas.tsx         # Interactive canvas map
│   ├── MapSettings.tsx       # Display settings panel
│   ├── PlayerList.tsx        # Player sidebar
│   ├── SessionDetails.tsx    # Session info & teleport
│   ├── ConnectionStatus.tsx  # WebSocket status
│   ├── DimensionSelector.tsx # Dimension tabs
│   ├── WorldTime.tsx         # In-game time display
│   └── SettingsModal.tsx     # Settings modal
├── hooks/
│   └── useWebSocket.ts       # WebSocket connection
├── lib/
│   ├── auth.ts               # Auth utilities
│   └── storage.ts            # Session data storage
└── types/
    └── index.ts              # TypeScript definitions
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/tiles/{dimension}/{x}/{z}` | Get chunk tile image |
| `GET /api/sessions` | List all sessions |
| `GET /api/sessions/{id}` | Get specific session |
| `GET /api/players` | List all players |
| `POST /api/tiles/refresh` | Trigger tile re-render |

All endpoints require a token via `Authorization: Bearer <token>` header or `?token=<token>` query param.

## Tech Stack

- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Styling
- **Canvas API** - Map rendering

## Development

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Run production server
npm run lint     # Run ESLint
```

## Troubleshooting

### "Connection failed" error
- Make sure the Minecraft server is running with the PlayerRoutes mod
- Check that the WebSocket port (8765) is accessible
- Verify your token matches `playerroutes-server.toml`

### Map tiles not loading
- Ensure `JSON_STORAGE_DIR` points to the correct directory
- Check that the mod has generated tile images
- Try clicking the `R` button to refresh tiles

### "Invalid token" error
- The token must match exactly what's in `playerroutes-server.toml`
- Use the eye icon to verify you typed it correctly

## Support the Project

If you find PlayerRoutes useful, consider supporting its development:

[![PayPal](https://img.shields.io/badge/PayPal-Donate-blue?logo=paypal)](https://paypal.me/alfonsovlog)

Your support helps maintain and improve the project!

## License

MIT

## See Also

- [PlayerRoutes Mod](../playerroutes-mod) - NeoForge server mod
