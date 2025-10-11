# HSM-TERA

A modern Electron application with HTML rendering support, featuring a beautiful UI, secure architecture, and cross-platform compatibility.

## Features

- 🚀 **Fast Performance** - Built with Electron for native desktop performance
- 🔒 **Secure** - Context isolation and secure IPC communication
- 🎨 **Modern UI** - Beautiful, responsive interface with dark/light themes
- ⚡ **Cross Platform** - Works on Windows, macOS, and Linux
- 📱 **Responsive Design** - Adapts to different screen sizes
- 🎯 **Interactive Demo** - Built-in demo functionality
- ⌨️ **Keyboard Shortcuts** - Convenient keyboard navigation

## Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

## Installation

1. Clone or download this project
2. Navigate to the project directory:
   ```bash
   cd HSM-TERA
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```
This will start the app with developer tools open.

### Production Mode
```bash
npm start
```

## Building the Application

### Build for Current Platform
```bash
npm run build
```

### Create Distribution Packages
```bash
npm run dist
```

This will create platform-specific installers in the `dist` folder.

## Project Structure

```
HSM-TERA/
├── scripts/main.js      # Main Electron process
├── scripts/preload.js   # Preload script for secure IPC
├── pages/index.html     # Main HTML file
├── components/          # UI components
├── scripts/renderer.js  # Renderer process JavaScript
├── package.json         # Project configuration
└── README.md           # This file
```

## Key Features Explained

### Security
- **Context Isolation**: Enabled to prevent renderer process from accessing Node.js APIs directly
- **Preload Script**: Secure bridge between main and renderer processes
- **CSP**: Content Security Policy implemented for additional security

### Theming
- **Dark/Light Mode**: Toggle between themes with the button in the header
- **CSS Variables**: Easy theme customization through CSS custom properties
- **Persistent**: Theme preference is saved in localStorage

### Interactive Elements
- **Demo Section**: Interactive area to test functionality
- **Modal Dialog**: Information modal with smooth animations
- **Notifications**: Toast notifications for user feedback

### Menu Integration
- **Native Menus**: Full application menu with keyboard shortcuts
- **IPC Communication**: Secure communication between menu and renderer

## Keyboard Shortcuts

- `Ctrl/Cmd + T`: Toggle theme
- `Escape`: Close modal dialogs
- `Enter`: Trigger demo action (when input is focused)

## Customization

### Adding New Features
1. Add HTML elements to `index.html`
2. Style them in `styles.css`
3. Add functionality in `renderer.js`
4. Use `preload.js` for secure IPC if needed

### Theming
Modify CSS variables in `styles.css`:
```css
:root {
  --primary-color: #your-color;
  --bg-primary: #your-bg-color;
  /* ... other variables */
}
```

### Menu Items
Add new menu items in `main.js` in the `createMenu()` function.

## Development Tips

1. **DevTools**: Use `npm run dev` to automatically open DevTools
2. **Hot Reload**: For faster development, consider adding electron-reload
3. **Debugging**: Use `console.log()` in both main and renderer processes
4. **Performance**: Monitor performance with built-in DevTools

## Troubleshooting

### Common Issues

1. **App won't start**: Ensure Node.js and npm are properly installed
2. **Dependencies issues**: Delete `node_modules` and run `npm install` again
3. **Build failures**: Check that all required files are present

### Getting Help

- Check the console for error messages
- Use DevTools to debug renderer process issues
- Refer to [Electron documentation](https://www.electronjs.org/docs)

## License

MIT License - feel free to use this project as a starting point for your own Electron applications.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

Built with ❤️ using Electron, HTML, CSS, and JavaScript.


